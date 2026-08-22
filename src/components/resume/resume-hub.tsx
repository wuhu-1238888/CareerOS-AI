"use client";
// 简历页状态枢纽(4.3):上传/粘贴 → AI 解析 → 核对修正。镜像 profile-hub 状态机:
// 解析态统一轮询 resume.latestRun(intent: "parse-resume")(700ms,进度事件已随执行落库),刷新页面按最近 run 恢复;
// 失败态「重试」:会话内直接重跑 parse(原文在库),刷新后服务端从 AgentRun.input 重放(retryParse);「上传新简历」返回上传视图。
// 4.4-4.5 优化阶段:「开始优化」保存核对结果并触发改写管线 → 改写中 AnalysisView(简历优化师)→ 成功后结果对比视图;
// 会话内改写失败重试 = 用 lastOptimizeInput 重跑;刷新后无会话输入 → 重试返回核对表单(无 retryRewrite 端点,计划已定)。
// 4.12:活跃简历 = URL 参数 ?resumeId=(设置页「查看」);?upload=1 直接进上传视图(设置页「+ 新增简历」);
// 上传成功后清参 → resume.get 回落最新行(新行)→ 行切换 effect 自动复位并进入新简历,旧行数据不动。
// 4.13:上传视图「从已有简历继续」→ handleSelectResume 切活跃行(?resumeId=);结果视图显示当前简历名(resumeName)。
// 4.14:上传视图退出体验 —— ?upload=1&from=resumes 记住来源(简历中心);handleExitUpload 按来源动态返回
// (来源为简历中心或无可返回的结果视图 → /resumes;否则退 uploadMode 回原视图);行切换 effect 首帧守卫防冷加载误复位。
// 4.15:来源为简历中心时退出改为后退(上一历史条目即简历中心),避免 replace 产生两条相邻 /resumes
// 历史,导致简历中心「← 返回」后退到同一页观感失效。
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";
import { goBackOrFallback } from "@/lib/client-back";
import { ResumeUpload } from "./resume-upload";
import { ResumeReview } from "./resume-review";
import { ResumeResult } from "./resume-result";
import { AnalysisView } from "@/components/profile/analysis-view";
import type { ParsedResume } from "@/lib/resume/analysis-schemas";

function friendlyError(err: unknown): string {
  return err instanceof Error ? err.message : "操作失败,请稍后重试";
}

export function ResumeHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 活跃简历(4.12):?resumeId= 查看指定行(未传 = 最新行);?upload=1 进入上传视图(新增简历)
  const resumeId = searchParams.get("resumeId") ?? undefined;
  const uploadRequested = searchParams.get("upload") === "1";
  // 4.14:来源参数(from=resumes = 简历中心「新增简历」);以值捕获,effect 依赖值而非 searchParams 对象
  const uploadFromParam = searchParams.get("from");
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const resume = trpc.resume.get.useQuery({ resumeId });
  const profile = trpc.profile.get.useQuery();
  const parse = trpc.resume.parse.useMutation();
  const retryParse = trpc.resume.retryParse.useMutation();
  const saveParsed = trpc.resume.saveParsedData.useMutation();
  const rewrite = trpc.resume.rewrite.useMutation();

  // 解析会话状态:submitted=true 表示解析 mutation 在途;parseError 为失败文案(驱动失败视图);
  // uploadMode:用户主动进入上传视图(失败视图「上传新简历」),忽略历史 failed run(刷新后仍按失败恢复)
  const [submitted, setSubmitted] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState(false);
  // 4.14:上传视图来源(简历优化 / 简历中心「新增简历」),决定退出去向;仅 uploadMode 期间有意义
  const [uploadFrom, setUploadFrom] = useState<"resume" | "resumes">("resume");
  const finishedRef = useRef(false);
  // 4.14:上一活跃行 id —— 行切换 effect 首帧守卫(undefined → 值 是数据加载,不是行切换)
  const prevIdRef = useRef<string | undefined>(undefined);

  // 优化会话状态:rewriteSubmitted=改写 mutation 在途;rewriteError=失败文案;backToReview=返回核对表单;
  // lastOptimizeInput 供会话内失败重试重跑(刷新后为 null → 重试回到核对表单)
  const [rewriteSubmitted, setRewriteSubmitted] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const [backToReview, setBackToReview] = useState(false);
  const rewriteFinishedRef = useRef(false);
  const lastOptimizeInput = useRef<{ parsed: ParsedResume; direction: string } | null>(null);
  // 优化在途(保存核对结果 + 改写全程):禁用「开始优化」防双击(本次修订)
  const [optimizing, setOptimizing] = useState(false);

  const hasParsed = !!resume.data?.parsedData;
  const hasVersion = !!resume.data?.version;

  // 跟踪最近一次解析 run:无解析结果(首建/恢复)或提交在途时启用;仅 running/在途时轮询 700ms
  const latestRun = trpc.resume.latestRun.useQuery(
    { intent: "parse-resume" },
    {
      enabled: !resume.isLoading && !!resume.data && (!hasParsed || submitted),
      refetchInterval: (query) =>
        submitted || query.state.data?.status === "running" ? 700 : false,
    }
  );

  // 跟踪最近一次改写 run:无优化版本或提交在途时启用
  const latestRewrite = trpc.resume.latestRun.useQuery(
    { intent: "rewrite-resume" },
    {
      enabled: !resume.isLoading && !!resume.data && (!hasVersion || rewriteSubmitted),
      refetchInterval: (query) =>
        rewriteSubmitted || query.state.data?.status === "running" ? 700 : false,
    }
  );

  // 行归属护栏(本次修订):latestRun 按 userId+intent 查、不按 resumeId;重新上传/粘贴会创建新简历行,
  // 旧行 run 不得驱动新行的失败/恢复视图(否则旧行失败 → 新行误显失败;重试还会把解析结果写回旧行,形成死循环)。
  // 旧 run 无 resumeId(历史数据)→ 视为当前行,向后兼容。
  const parseRun =
    latestRun.data?.resumeId && latestRun.data.resumeId !== resume.data?.id
      ? null
      : (latestRun.data ?? null);
  const rewriteRun =
    latestRewrite.data?.resumeId && latestRewrite.data.resumeId !== resume.data?.id
      ? null
      : (latestRewrite.data ?? null);

  // 恢复路径(解析):刷新后 run 已 succeeded(管线已完成)→ 刷新简历进入核对视图
  useEffect(() => {
    if (!hasParsed && parseRun?.status === "succeeded" && !finishedRef.current) {
      finishedRef.current = true;
      void utils.resume.get.invalidate();
    }
  }, [hasParsed, parseRun?.status, utils]);

  // 恢复路径(改写):刷新后 run 已 succeeded → 刷新简历进入结果视图
  useEffect(() => {
    if (!hasVersion && rewriteRun?.status === "succeeded" && !rewriteFinishedRef.current) {
      rewriteFinishedRef.current = true;
      void utils.resume.get.invalidate();
    }
  }, [hasVersion, rewriteRun?.status, utils]);

  // 简历行切换(重传/粘贴产生新行):清空解析与优化会话痕迹。
  // 4.14 首帧守卫:冷加载时 id 从 undefined → 值 属数据加载而非行切换,不得复位
  // ?upload=1 effect 刚设置的 uploadMode(否则冷加载直达上传视图会被秒关)。
  useEffect(() => {
    const id = resume.data?.id;
    if (id === undefined) return; // 加载中/refetch:不动
    if (prevIdRef.current === undefined) {
      prevIdRef.current = id; // 首次加载:只记录,不执行行切换复位
      return;
    }
    if (id === prevIdRef.current) return;
    prevIdRef.current = id;
    finishedRef.current = false;
    rewriteFinishedRef.current = false;
    lastOptimizeInput.current = null;
    setParseError(null);
    setRewriteError(null);
    setUploadMode(false);
    setBackToReview(false);
  }, [resume.data?.id]);

  // ?upload=1(4.12)+ from(4.14):进入上传视图并去参(刷新/返回不会再落入上传视图);
  // from=resumes(简历中心「新增简历」)时记住来源,退出上传视图时返回简历中心。
  useEffect(() => {
    if (uploadRequested) {
      setUploadFrom(uploadFromParam === "resumes" ? "resumes" : "resume");
      setUploadMode(true);
      router.replace("/resume");
    }
  }, [uploadRequested, uploadFromParam, router]);

  // ?resumeId 失效护栏(4.12):行已删/越权时 get 已回退最新行 → 去参,防止 stale 参数误导后续操作
  useEffect(() => {
    if (resumeId && resume.data && resume.data.id !== resumeId) {
      router.replace("/resume");
    }
  }, [resumeId, resume.data, router]);

  if (me.isLoading || resume.isLoading || profile.isLoading || !me.data) {
    return (
      <div className="w-full space-y-4 py-6" aria-label="加载中">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const recovering = !parseError && !hasParsed && parseRun?.status === "running";
  const failedRun =
    !uploadMode && !parseError && parseRun?.status === "failed" ? parseRun : null;

  // —— 改写视图判定(2026-08 修复,方案 A1):完成判定以权威数据(run 终态 + 落库版本)为准,
  // mutation 仅作触发与本次会话错误提示。此前 rewriteSubmitted 会把视图钉死在分析中:
  // 一次被刷新中断/长时间未返回的 mutation 会让「后端已完成、前端仍分析中」永久卡住(轮询数据不参与完成判定)。
  const rewriteRunning = rewriteRun?.status === "running";
  const rewriteFailed = rewriteRun?.status === "failed";
  const rewriteSucceeded = rewriteRun?.status === "succeeded";
  // 权威完成态:run succeeded 且版本已落库(version 经恢复 effect invalidate 后由 resume.get 带回)
  const rewriteDone = rewriteSucceeded && hasVersion;
  // 会话内 mutation 错误:仅当权威状态既未失败也未成功、且不在 running 时展示(权威优先)
  const showRewriteError =
    !!rewriteError && !rewriteRunning && !rewriteFailed && !rewriteSucceeded;
  // 分析中:run 确在 running,或 mutation 在途且尚无权威终态(新 run 未创建/未落终态)
  const showRewriting =
    (rewriteSubmitted || rewriteRunning) && !rewriteFailed && !rewriteDone && !rewriteSucceeded;
  // 已成功但版本尚未刷新到位:停留分析视图展示已完成事件(防核对表单闪现),refetch 到位后自动进结果视图
  const showRewriteFinishing = !showRewriting && rewriteSucceeded && !hasVersion && !showRewriteError;
  // 失败视图:权威失败(刷新后恢复 / mutation 在途即已落 failed,不等 mutation 返回)
  const rewriteFailedRun =
    !backToReview && !hasVersion && rewriteFailed ? rewriteRun : null;
  // 分析视图的 run 数据:仅在确在 running 或成功过渡时展示事件列表(在途尚无 run/会话错误为 null)
  const rewriteViewRun = rewriteRunning || showRewriteFinishing ? rewriteRun : null;

  // 在途提交时忽略历史 run(避免把上次失败的旧 run 当作本次状态),等待轮询发现新 run
  const runForView =
    submitted && parseRun && parseRun.status !== "running" ? null : parseRun;

  async function handleStartParse() {
    if (!resume.data?.id) return;
    finishedRef.current = false;
    setParseError(null);
    setSubmitted(true);
    try {
      await parse.mutateAsync({ resumeId: resume.data.id });
      await utils.resume.get.invalidate();
    } catch (err) {
      setParseError(friendlyError(err));
    } finally {
      setSubmitted(false);
    }
  }

  async function handleRetry() {
    // 会话内失败:原文仍在库,直接重跑 parse
    if (!failedRun) {
      if (resume.data?.id) {
        await handleStartParse();
      } else {
        setParseError("请先上传或粘贴简历");
      }
      return;
    }
    // 刷新后恢复:服务端从失败 run 的 input 重放解析
    finishedRef.current = false;
    setParseError(null);
    setSubmitted(true);
    try {
      await retryParse.mutateAsync({ runId: failedRun.id });
      await utils.resume.get.invalidate();
    } catch (err) {
      setParseError(friendlyError(err));
    } finally {
      setSubmitted(false);
    }
  }

  // 触发改写管线:保存会话输入供失败重试,轮询 latestRun(rewrite-resume) 直至落版本
  async function runRewrite(parsed: ParsedResume, direction: string) {
    if (!resume.data?.id) return;
    rewriteFinishedRef.current = false;
    lastOptimizeInput.current = { parsed, direction };
    setBackToReview(false);
    setRewriteError(null);
    setRewriteSubmitted(true);
    try {
      await rewrite.mutateAsync({
        resumeId: resume.data.id,
        parsedData: parsed,
        targetDirection: direction,
      });
      await utils.resume.get.invalidate();
    } catch (err) {
      setRewriteError(friendlyError(err));
    } finally {
      setRewriteSubmitted(false);
    }
  }

  // 「开始优化」(4.4):先落核对结果,再触发改写进入结果阶段。
  // 本次修订:全程 optimizing 禁用按钮防双击(此前按钮 disabled 绑定表单自身 saveParsed 实例,
  // 与 Hub 实际执行的实例脱节,双击会并发两次保存 + 两次 LLM 改写)
  async function handleStartOptimize(parsed: ParsedResume, direction: string) {
    if (!resume.data?.id) return;
    setOptimizing(true);
    try {
      try {
        await saveParsed.mutateAsync({ resumeId: resume.data.id, parsedData: parsed });
        await utils.resume.get.invalidate();
      } catch (err) {
        toast.error(friendlyError(err));
        return;
      }
      await runRewrite(parsed, direction);
    } finally {
      setOptimizing(false);
    }
  }

  // 改写失败「重试」:会话内有输入直接重跑;刷新后无输入 → 返回核对表单重新发起
  function handleRewriteRetry() {
    const input = lastOptimizeInput.current;
    if (input) {
      void runRewrite(input.parsed, input.direction);
      return;
    }
    setRewriteError(null);
    setBackToReview(true);
  }

  // 「返回核对」:从改写失败视图回核对表单(回填当前版本目标方向,initialDirection)
  function handleBackToReview() {
    setRewriteError(null);
    setBackToReview(true);
  }

  // 「重新分析」:用已保存的核对结果 + 当前版本目标方向再跑改写(生成新版本)
  function handleReanalyze() {
    const parsed = resume.data?.parsedData;
    const version = resume.data?.version;
    if (!parsed || !version) return;
    if (!version.targetDirection) {
      handleBackToReview();
      return;
    }
    void runRewrite(parsed, version.targetDirection);
  }

  // 进入上传视图(4.14):来源视为「简历优化」—— 退出时回原视图
  function enterUploadMode() {
    setUploadFrom("resume");
    setUploadMode(true);
  }

  // 「上传新简历」(4.11/4.12/4.13):进入上传视图新增一份简历。复用既有 uploadMode —— 只切视图不删数据:
  // 上传视图 = 「上传新简历」,上传走既有链路建新行,行 id 变化 effect 统一复位会话状态并自动切换到新简历;
  // 旧行与优化结果保留(简历中心可查看/继续优化/删除)。
  function handleReupload() {
    enterUploadMode();
  }

  // 「从已有简历继续」(4.13):切换到指定简历行 —— 显式退上传视图(选当前行时 id 不变,行切换 effect 不触发),
  // 再以 ?resumeId= 切换活跃行(get 取该行 → 行切换 effect 复位会话状态 → 展示该行自己的阶段视图)。
  function handleSelectResume(id: string) {
    setUploadFrom("resume"); // 4.14:维持「uploadFrom 仅在 uploadMode 期间有意义」的不变式
    setUploadMode(false);
    router.replace(`/resume?resumeId=${id}`);
  }

  // 可返回的结果视图:该行存在且不是「提取失败从未解析成功」(后者无解析数据可展示,归属简历中心「待补全」)
  const hasResultView = !!resume.data && !(resume.data.extractError && !hasParsed);
  // 面包屑父级与退出目标一致(4.14)
  const crumbParent = uploadFrom === "resumes" || !hasResultView ? "简历中心" : "简历优化";

  // 退出上传视图(4.14):按来源动态返回 —— 简历中心进入或无可返回的结果视图 → 简历中心;
  // 否则退 uploadMode 回原视图(URL 已是 /resume 或 /resume?resumeId=X,结果/失败视图会正确复现)。
  function handleExitUpload() {
    if (uploadFrom === "resumes") {
      // 4.15:来源是简历中心「新增简历」(上一历史条目即简历中心)→ 后退回到它,不 replace,
      // 避免两条相邻 /resumes 历史让简历中心「← 返回」后退到同一页(观感失效)
      goBackOrFallback(router, "/resumes");
      return;
    }
    if (!hasResultView) {
      router.replace("/resumes");
      return;
    }
    setUploadMode(false);
  }

  // careerPaths 为 Prisma Json 列(tRPC 序列化后为深递归类型),经 unknown 桥接避免 TS2589
  const careerPaths: string[] =
    (profile.data?.careerPaths as unknown as { directionName: string }[] | undefined)?.map(
      (p) => p.directionName
    ) ?? [];

  let view: React.ReactNode;
  if (!resume.data || uploadMode) {
    // 无简历 / 用户主动上传新简历(4.12/4.13:上传视图 = 「上传新简历」+「从已有简历继续」,每次上传建新行,旧行保留)
    view = (
      <ResumeUpload
        resumeId={resume.data?.id}
        onUploaded={() => router.replace("/resume")}
        onSelectResume={handleSelectResume}
        onExit={handleExitUpload}
        crumbParent={crumbParent}
      />
    );
  } else if (!hasParsed && resume.data.extractError) {
    // 提取失败行(无原文,无法解析):粘贴补全或上传新简历(可从已有简历继续切换)
    view = (
      <ResumeUpload
        resumeId={resume.data.id}
        onUploaded={() => router.replace("/resume")}
        onSelectResume={handleSelectResume}
        onExit={handleExitUpload}
        crumbParent={crumbParent}
      />
    );
  } else if (showRewriting || showRewriteFinishing || showRewriteError) {
    // 改写流程:提交在途 / 轮询 running / 成功后的短暂过渡 / 本次会话失败(优先级高于解析与核对视图)
    view = (
      <AnalysisView
        run={rewriteViewRun}
        error={showRewriteError ? rewriteError : null}
        onRetry={handleRewriteRetry}
        onEdit={handleBackToReview}
        agentName="简历优化师"
        icon={Sparkles}
        runningDescription="正在逐段优化你的简历表达,围绕目标方向重建叙事"
        failedDescription="这次优化没有完成,你可以重试或返回核对信息"
        editLabel="返回核对"
      />
    );
  } else if (submitted || recovering || parseError) {
    // 解析在途或本次会话失败:优先级高于核对视图
    view = (
      <AnalysisView
        run={runForView}
        error={parseError}
        onRetry={handleRetry}
        onEdit={enterUploadMode}
        agentName="简历解析师"
        icon={FileText}
        runningDescription="正在解析你的简历,提取教育、技能与经历等信息"
        failedDescription="这次解析没有完成,你可以重试或上传新简历"
        editLabel="上传新简历"
      />
    );
  } else if (!hasParsed) {
    if (failedRun) {
      // 刷新后恢复历史失败 run:失败视图(重试走 retryParse 重放)
      view = (
        <AnalysisView
          run={failedRun}
          error={failedRun.error}
          onRetry={handleRetry}
          onEdit={enterUploadMode}
          agentName="简历解析师"
          icon={FileText}
          runningDescription="正在解析你的简历,提取教育、技能与经历等信息"
          failedDescription="这次解析没有完成,你可以重试或上传新简历"
          editLabel="上传新简历"
        />
      );
    } else {
      // 简历已就绪,待触发解析
      view = (
        <div className="w-full py-6">
          <div className="flex flex-col items-center gap-4 rounded-card border border-hairline bg-surface p-8 text-center shadow-card">
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-green-100 text-green-600"
            >
              <FileText className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="text-body-lg font-medium text-ink">简历已就绪</p>
              <p className="text-caption text-ink-muted">
                AI 将解析你的简历,提取基本信息、教育、技能与经历;解析完成后请逐项核对修正。
              </p>
            </div>
            <Button type="button" size="lg" onClick={() => void handleStartParse()}>
              开始解析
            </Button>
          </div>
        </div>
      );
    }
  } else if (rewriteFailedRun) {
    // 刷新后恢复历史失败改写 run(无版本):失败视图;重试无会话输入 → 返回核对表单
    view = (
      <AnalysisView
        run={rewriteFailedRun}
        error={rewriteFailedRun.error}
        onRetry={handleRewriteRetry}
        onEdit={handleBackToReview}
        agentName="简历优化师"
        icon={Sparkles}
        runningDescription="正在逐段优化你的简历表达,围绕目标方向重建叙事"
        failedDescription="这次优化没有完成,你可以重试或返回核对信息"
        editLabel="返回核对"
      />
    );
  } else if (resume.data.version && !backToReview) {
    // 优化结果:对比卡列表 + 工具条(4.5);4.13 传入当前简历名(Hero 左区显示)
    view = (
      <ResumeResult
        version={resume.data.version}
        resumeName={resume.data.fileName ?? "粘贴的简历文本"}
        onReanalyze={handleReanalyze}
        onEdit={handleBackToReview}
        onReupload={handleReupload}
      />
    );
  } else {
    // 解析完成:核对修正 + 目标方向选择 + 开始优化(返回核对时回填方向:当前版本方向 →
    // 会话内失败前输入方向 → 失败 run 输入中的方向[刷新恢复];兜底表单回落画像首选)
    view = (
      <ResumeReview
        resumeId={resume.data.id}
        initial={resume.data.parsedData}
        initialDirection={
          backToReview
            ? (resume.data.version?.targetDirection ??
              lastOptimizeInput.current?.direction ??
              rewriteRun?.targetDirection ??
              undefined)
            : undefined
        }
        careerPaths={careerPaths}
        onStartOptimize={handleStartOptimize}
        optimizing={optimizing}
        sectionPlan={resume.data.sectionPlan ?? null}
      />
    );
  }

  return <>{view}</>;
}
