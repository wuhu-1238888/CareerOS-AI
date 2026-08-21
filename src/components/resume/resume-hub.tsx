"use client";
// 简历页状态枢纽(4.3):上传/粘贴 → AI 解析 → 核对修正。镜像 profile-hub 状态机:
// 解析态统一轮询 resume.latestRun(intent: "parse-resume")(700ms,进度事件已随执行落库),刷新页面按最近 run 恢复;
// 失败态「重试」:会话内直接重跑 parse(原文在库),刷新后服务端从 AgentRun.input 重放(retryParse);「重新上传」返回上传视图。
// 4.4 起「开始优化」触发改写管线并进入结果阶段;4.5 接入 resume-result。
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";
import { ResumeUpload } from "./resume-upload";
import { ResumeReview } from "./resume-review";
import { AnalysisView } from "@/components/profile/analysis-view";
import type { ParsedResume } from "@/lib/resume/analysis-schemas";

function friendlyError(err: unknown): string {
  return err instanceof Error ? err.message : "操作失败,请稍后重试";
}

export function ResumeHub() {
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const resume = trpc.resume.get.useQuery();
  const profile = trpc.profile.get.useQuery();
  const parse = trpc.resume.parse.useMutation();
  const retryParse = trpc.resume.retryParse.useMutation();
  const saveParsed = trpc.resume.saveParsedData.useMutation();

  // 本次会话提交状态:submitted=true 表示解析 mutation 在途;parseError 为失败文案(驱动失败视图);
  // uploadMode:用户主动返回上传视图(失败视图「重新上传」),忽略历史 failed run(刷新后仍按失败恢复)
  const [submitted, setSubmitted] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState(false);
  const finishedRef = useRef(false);

  const hasParsed = !!resume.data?.parsedData;

  // 跟踪最近一次解析 run:无解析结果(首建/恢复)或提交在途时启用;仅 running/在途时轮询 700ms
  const latestRun = trpc.resume.latestRun.useQuery(
    { intent: "parse-resume" },
    {
      enabled: !resume.isLoading && !!resume.data && (!hasParsed || submitted),
      refetchInterval: (query) =>
        submitted || query.state.data?.status === "running" ? 700 : false,
    }
  );

  // 恢复路径:刷新后 run 已 succeeded(管线已完成)→ 刷新简历进入核对视图
  useEffect(() => {
    if (!hasParsed && latestRun.data?.status === "succeeded" && !finishedRef.current) {
      finishedRef.current = true;
      void utils.resume.get.invalidate();
    }
  }, [hasParsed, latestRun.data?.status, utils]);

  // 简历行切换(重传/粘贴产生新行):清空解析会话痕迹
  useEffect(() => {
    finishedRef.current = false;
    setParseError(null);
    setUploadMode(false);
  }, [resume.data?.id]);

  if (me.isLoading || resume.isLoading || profile.isLoading || !me.data) {
    return (
      <div className="mx-auto w-full max-w-[640px] space-y-4 px-4 py-6" aria-label="加载中">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const recovering = !parseError && !hasParsed && latestRun.data?.status === "running";
  const failedRun =
    !uploadMode && !parseError && latestRun.data?.status === "failed" ? latestRun.data : null;

  // 在途提交时忽略历史 run(避免把上次失败的旧 run 当作本次状态),等待轮询发现新 run
  const runForView =
    submitted && latestRun.data && latestRun.data.status !== "running"
      ? null
      : (latestRun.data ?? null);

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

  // 「开始优化」(4.3):先把核对结果落库;4.4 起在此触发改写管线进入结果阶段
  async function handleStartOptimize(parsed: ParsedResume, direction: string) {
    if (!resume.data?.id) return;
    await saveParsed.mutateAsync({ resumeId: resume.data.id, parsedData: parsed });
    await utils.resume.get.invalidate();
    toast.info(`已保存(目标方向:${direction}),优化能力即将在下一步接入`);
  }

  // careerPaths 为 Prisma Json 列(tRPC 序列化后为深递归类型),经 unknown 桥接避免 TS2589
  const careerPaths: string[] =
    (profile.data?.careerPaths as unknown as { directionName: string }[] | undefined)?.map(
      (p) => p.directionName
    ) ?? [];

  let view: React.ReactNode;
  if (!resume.data || uploadMode) {
    // 无简历 / 用户主动重新上传(含提取失败后的粘贴降级)
    view = <ResumeUpload />;
  } else if (!hasParsed && resume.data.extractError) {
    // 提取失败行(无原文,无法解析):粘贴补全或重传
    view = <ResumeUpload />;
  } else if (submitted || recovering || parseError) {
    // 解析在途或本次会话失败:优先级高于核对视图
    view = (
      <AnalysisView
        run={runForView}
        error={parseError}
        onRetry={handleRetry}
        onEdit={() => setUploadMode(true)}
        agentName="简历解析师"
        icon={FileText}
        runningDescription="正在解析你的简历,提取教育、技能与经历等信息"
        failedDescription="这次解析没有完成,你可以重试或重新上传简历"
        editLabel="重新上传"
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
          onEdit={() => setUploadMode(true)}
          agentName="简历解析师"
          icon={FileText}
          runningDescription="正在解析你的简历,提取教育、技能与经历等信息"
          failedDescription="这次解析没有完成,你可以重试或重新上传简历"
          editLabel="重新上传"
        />
      );
    } else {
      // 简历已就绪,待触发解析
      view = (
        <div className="mx-auto w-full max-w-[640px] px-4 py-6">
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
  } else {
    // 解析完成:核对修正 + 目标方向选择 + 开始优化
    view = (
      <ResumeReview
        resumeId={resume.data.id}
        initial={resume.data.parsedData}
        careerPaths={careerPaths}
        onStartOptimize={handleStartOptimize}
      />
    );
  }

  return <>{view}</>;
}
