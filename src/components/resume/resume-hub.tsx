"use client";
// 简历页状态枢纽(4.3):上传/粘贴 → AI 解析 → 核对修正。镜像 profile-hub 状态机:
// 解析态统一轮询 resume.latestRun(intent: "parse-resume")(700ms,进度事件已随执行落库),刷新页面按最近 run 恢复;
// 失败态「重试」:会话内直接重跑 parse(原文在库),刷新后服务端从 AgentRun.input 重放(retryParse);「上传新简历」返回上传视图。
// 4.4-4.5 优化阶段:「开始优化」保存核对结果并触发改写管线 → 改写中 AnalysisView(简历优化师)→ 成功后结果对比视图;
// 会话内改写失败重试 = 用 lastOptimizeInput 重跑;刷新后无会话输入 → 重试返回核对表单(无 retryRewrite 端点,计划已定)。
// 4.12:活跃简历 = URL 参数 ?resumeId=(设置页「查看」);?upload=1 直接进上传视图(设置页「+ 新增简历」);
// 上传成功后清参 → resume.get 回落最新行(新行)→ 行切换 effect 自动复位并进入新简历,旧行数据不动。
// 4.13:上传视图「从已有简历继续」→ handleSelectResume 切活跃行(?resumeId=);结果视图显示当前简历名(resumeName)。
// 4.14:上传视图退出体验 —— ?upload=1&from=resumes 记住来源(「我的简历」Tab);handleExitUpload 按来源动态返回
// (来源为我的简历或无可返回的结果视图 → /resume?tab=resumes;否则退 uploadMode 回原视图);行切换 effect 首帧守卫防冷加载误复位。
// 4.15:来源为「我的简历」Tab 时退出改为后退(上一历史条目即该 Tab,IA 调整 2026-09 后为 /resume?tab=resumes),
// 避免 replace 产生两条相邻同页历史。
// 4.17:修复「分析进度卡 60% 需手动刷新」—— latestRun 查询常开(enabled 不再随 hasParsed/hasVersion
// 早停,否则 mutation 结算瞬间轮询被禁用、缓存冻结在 running);rewriteDone 加权威「版本-运行对应」
// (版本 createdAt 严格晚于 run createdAt ⇔ 管线已完成,不依赖冻结的轮询缓存终态);mutation 结算后
// invalidate latestRun 立即拉终态;恢复 effect 清会话错误、改写恢复不再要求 !hasVersion。
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
import { LinkageBanners } from "@/components/linkage/linkage-banners";
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
  // 4.14:来源参数(from=resumes = 「我的简历」Tab「新增简历」);以值捕获,effect 依赖值而非 searchParams 对象
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
  // 4.14:上传视图来源(简历优化 / 「我的简历」Tab「新增简历」),决定退出去向;仅 uploadMode 期间有意义
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

  // 跟踪最近一次解析 run(4.17 常开):enabled 不再随 hasParsed/submitted 早停 —— 早停会在 mutation
  // 结算瞬间把轮询禁用、缓存冻结在 running(「卡 60% 需手动刷新」根因);仅 running/在途时轮询 700ms
  const latestRun = trpc.resume.latestRun.useQuery(
    { intent: "parse-resume" },
    {
      enabled: !resume.isLoading && !!resume.data,
      refetchInterval: (query) =>
        submitted || query.state.data?.status === "running" ? 700 : false,
    }
  );

  // 跟踪最近一次改写 run(4.17 常开):同上,不再随 hasVersion/rewriteSubmitted 早停
  const latestRewrite = trpc.resume.latestRun.useQuery(
    { intent: "rewrite-resume" },
    {
      enabled: !resume.isLoading && !!resume.data,
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

  // 恢复路径(解析):刷新后 run 已 succeeded(管线已完成)→ 清会话错误并刷新简历进入核对视图
  // (4.17:mutation 响应丢失但服务端完成时,不清错误会把失败视图钉死到刷新)
  useEffect(() => {
    if (!hasParsed && parseRun?.status === "succeeded" && !finishedRef.current) {
      finishedRef.current = true;
      setParseError(null);
      void utils.resume.get.invalidate();
    }
  }, [hasParsed, parseRun?.status, utils]);

  // 恢复路径(改写):run 已 succeeded → 清会话错误并刷新简历进入结果视图。
  // 4.17:去掉 !hasVersion 条件 —— 重新优化(旧版本存在)且 mutation 响应丢失时,服务端完成后
  // 也必须 invalidate 拉新版本,否则旧版本一直显示到刷新。
  useEffect(() => {
    if (rewriteRun?.status === "succeeded" && !rewriteFinishedRef.current) {
      rewriteFinishedRef.current = true;
      setRewriteError(null);
      void utils.resume.get.invalidate();
    }
  }, [rewriteRun?.status, utils]);

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
  // from=resumes(「我的简历」Tab「新增简历」)时记住来源,退出上传视图时返回该 Tab。
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
  // 权威完成态(4.17 修订):版本存在且(无 run / run 已 succeeded / 版本建于该 run 之后)。
  // 版本 createdAt 严格晚于 run createdAt(run 建于管线起点 orchestrator.ts:53,版本建于结束事务
  // pipeline.ts:135),「版本比缓存 run 新」即证明该管线已完成 —— 不依赖冻结的轮询缓存终态
  // (mutation 结算瞬间轮询被禁用后缓存冻结在 running,旧判定 rewriteSucceeded && hasVersion
  // 会永远 false,视图钉死在「分析中」,刷新才恢复)。序列化后 createdAt 运行时为 ISO 字符串,
  // 必须经 new Date(...).getTime() 比较。
  const rewriteDone =
    hasVersion &&
    (!rewriteRun ||
      rewriteSucceeded ||
      (resume.data?.version != null &&
        new Date(resume.data.version.createdAt).getTime() >
          new Date(rewriteRun.createdAt).getTime()));
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
      // 4.17:mutation 结算后 invalidate latestRun(常开查询立即 refetch 拉终态,防缓存冻结)
      void utils.resume.latestRun.invalidate({ intent: "parse-resume" });
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
      // 4.17:同上 —— invalidate latestRun 拉终态
      void utils.resume.latestRun.invalidate({ intent: "parse-resume" });
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
      // 4.17:mutation 结算后 invalidate latestRun(常开查询立即 refetch 拉终态,防缓存冻结)
      void utils.resume.latestRun.invalidate({ intent: "rewrite-resume" });
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
  // 旧行与优化结果保留(「我的简历」Tab 可查看/继续优化/删除)。
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

  // 可返回的结果视图:该行存在且不是「提取失败从未解析成功」(后者无解析数据可展示,归属「我的简历」Tab「待补全」)
  const hasResultView = !!resume.data && !(resume.data.extractError && !hasParsed);
  // 面包屑父级与退出目标一致(4.14;IA 调整 2026-09 父级为「我的简历」)
  const crumbParent = uploadFrom === "resumes" || !hasResultView ? "我的简历" : "简历优化";

  // 退出上传视图(4.14):按来源动态返回 —— 「我的简历」Tab 进入或无可返回的结果视图 → /resume?tab=resumes;
  // 否则退 uploadMode 回原视图(URL 已是 /resume 或 /resume?resumeId=X,结果/失败视图会正确复现)。
  function handleExitUpload() {
    if (uploadFrom === "resumes") {
      // 4.15:来源是「我的简历」Tab「新增简历」(上一历史条目即该 Tab)→ 后退回到它,不 replace,
      // 避免两条相邻同页历史
      goBackOrFallback(router, "/resume?tab=resumes");
      return;
    }
    if (!hasResultView) {
      router.replace("/resume?tab=resumes");
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
    // 优化结果:对比卡列表 + 工具条(4.5);4.13 传入当前简历名(Hero 左区显示);
    // 6.6 传入 resumeId(版本列表/复制/删除按行隔离,多简历不串版本)
    view = (
      <ResumeResult
        version={resume.data.version}
        resumeId={resume.data.id}
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

  return (
    <div className="w-full space-y-4">
      {/* 联动提示(8.1b,进入页面时评估):完成项目可加入简历 / 画像更新后简历可能需重新生成 */}
      <LinkageBanners kinds={["resume_project", "resume_outdated"]} />
      {view}
    </div>
  );
}
