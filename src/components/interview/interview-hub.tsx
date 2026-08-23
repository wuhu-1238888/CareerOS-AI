"use client";
// 模拟面试状态枢纽(7.2):无简历引导 / 场次设定 / 出题过程 / 对话作答 / 失败恢复。
// 镜像 matching-hub 状态机:出题态统一轮询 interview.latestRun({intent:"generate-interview-questions"})
// (700ms,进度事件已随执行落库):出题中刷新页面按最近 run 恢复;
// 失败态提供「重试」(会话内用最近一次设定;刷新后服务端从 AgentRun.input 重放)与「修改设定」。
// 对话态(进行中场次)刷新后由 interview.get 直接恢复;结束面试 → 综合报告视图在 7.3 接入
// (Commit 2 先以 toast 占位)。开始新场次覆盖旧场次(单行模型):有进行中场次时经确认 Dialog。
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/trpc/client";
import { InterviewSetup, type InterviewSetupValues } from "./interview-setup";
import { InterviewChat } from "./interview-chat";
import { AnalysisView } from "@/components/profile/analysis-view";

function friendlyError(err: unknown): string {
  return err instanceof Error ? err.message : "出题失败,请稍后重试";
}

export function InterviewHub() {
  const utils = trpc.useUtils();
  const session = trpc.interview.get.useQuery();
  const resume = trpc.resume.get.useQuery();
  // 设定预填:目标岗位优先匹配报告的岗位名,回退路线图目标方向
  const matching = trpc.matching.get.useQuery();
  const roadmap = trpc.navigator.roadmap.get.useQuery();
  const start = trpc.interview.start.useMutation();
  const retry = trpc.interview.retry.useMutation();

  // 本次会话提交状态:submitted=true 表示出题 mutation 在途;startError 为失败文案(驱动失败视图)
  const [submitted, setSubmitted] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [view, setView] = useState<null | "setup" | "running" | "chat">(null);
  // 有进行中场次时提交新设定:先确认覆盖再执行
  const [pendingStart, setPendingStart] = useState<InterviewSetupValues | null>(null);
  const lastInput = useRef<InterviewSetupValues | null>(null);
  const finishedRef = useRef(false);

  // 有效场次 = questions/answers 均通过防御解析(损坏按无场次处理,可重新开始)
  const hasSession = !!session.data?.questions && !!session.data?.answers;
  const hasActiveSession = hasSession && session.data?.status === "in_progress";

  // 跟踪最近一次出题 run:无场次(首建/恢复)或提交在途时启用;仅 running/在途时轮询 700ms
  const latestRun = trpc.interview.latestRun.useQuery(
    { intent: "generate-interview-questions" },
    {
      enabled: !session.isLoading && (!hasSession || submitted),
      refetchInterval: (query) =>
        submitted || query.state.data?.status === "running" ? 700 : false,
    }
  );

  // 恢复路径:刷新后 run 已 succeeded(管线已完成)→ 刷新场次记录进入对话视图
  useEffect(() => {
    if (!hasSession && latestRun.data?.status === "succeeded" && !finishedRef.current) {
      finishedRef.current = true;
      void utils.interview.get.invalidate();
    }
  }, [hasSession, latestRun.data?.status, utils]);


  if (session.isLoading || resume.isLoading || matching.isLoading || roadmap.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[640px] space-y-4 px-4 py-6" aria-label="加载中">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // 无简历引导(7.2 闸门):出题依赖简历快照,上传前不提供表单(双保险,start 服务端亦校验)
  if (!resume.data) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-6">
        <div className="rounded-card border border-hairline bg-surface p-10 text-center shadow-card">
          <h2 className="text-h2 text-ink">先上传简历</h2>
          <p className="mx-auto mt-2 max-w-md text-body text-ink-secondary">
            模拟面试的题目由 AI 面试官结合你的简历内容生成。上传并解析简历后,才能开启针对性面试。
          </p>
          <Button className="mt-6" asChild>
            <Link href="/resumes">去简历中心上传</Link>
          </Button>
        </div>
      </div>
    );
  }

  const recovering = !startError && !hasSession && latestRun.data?.status === "running";
  const failedRun =
    !startError && !hasSession && latestRun.data?.status === "failed" ? latestRun.data : null;

  // 在途提交时忽略历史 run(避免把上次失败的旧 run 当作本次状态),等待轮询发现新 run
  const runForView =
    submitted && latestRun.data && latestRun.data.status !== "running"
      ? null
      : (latestRun.data ?? null);

  async function doStart(values: InterviewSetupValues) {
    lastInput.current = values;
    finishedRef.current = false;
    setStartError(null);
    setSubmitted(true);
    setView("running");
    try {
      await start.mutateAsync(values);
      await utils.interview.get.invalidate();
      setView("chat");
    } catch (err) {
      setStartError(friendlyError(err));
      // 向表单抛出以保留错误提示(表单仅在提交成功时离开)
      throw err;
    } finally {
      setSubmitted(false);
    }
  }

  async function handleStart(values: InterviewSetupValues) {
    // 进行中场次被覆盖(单行模型):确认后执行
    if (hasActiveSession) {
      setPendingStart(values);
      return;
    }
    await doStart(values);
  }

  async function handleRetry() {
    // 会话内失败:直接用最近一次提交的设定重试
    if (lastInput.current) {
      await doStart(lastInput.current).catch(() => undefined);
      return;
    }
    // 刷新后恢复:服务端从失败 run 的 input 重放出题
    if (!failedRun) {
      setStartError("出题任务不存在,请重新选择设定");
      return;
    }
    finishedRef.current = false;
    setStartError(null);
    setSubmitted(true);
    setView("running");
    try {
      await retry.mutateAsync({ runId: failedRun.id });
      await utils.interview.get.invalidate();
      setView("chat");
    } catch (err) {
      setStartError(friendlyError(err));
    } finally {
      setSubmitted(false);
    }
  }

  function enterSetup() {
    setStartError(null);
    setView("setup");
  }

  // 结束面试(7.3 接入 finish 与综合报告视图;Commit 2 以 toast 占位)
  function handleEnd() {
    toast("面试已结束,综合报告功能即将开放");
  }

  const prefill: Partial<InterviewSetupValues> = lastInput.current ?? {
    targetPosition: matching.data?.jdTitle ?? roadmap.data?.targetDirection ?? "",
  };

  let viewNode: React.ReactNode;
  if (view === "running" || submitted || recovering || startError) {
    // 出题在途或本次会话失败:优先级最高
    viewNode = (
      <AnalysisView
        run={runForView}
        error={startError}
        onRetry={handleRetry}
        onEdit={enterSetup}
        agentName="面试出题"
        icon={Bot}
        runningDescription="正在阅读你的简历,生成个性化面试题"
        failedDescription="这次出题没有完成,你可以重试或修改设定后重新开始"
        editLabel="修改设定"
      />
    );
  } else if (view === "setup") {
    viewNode = <InterviewSetup initialValues={prefill} onSubmit={handleStart} />;
  } else if (hasActiveSession && session.data) {
    // 进行中场次(含刷新恢复:view 为 null 时渲染期直接派生,无 setup 闪烁)
    viewNode = <InterviewChat session={session.data} onEnd={handleEnd} />;
  } else if (failedRun) {
    // 无场次时遇历史失败 run:失败恢复视图(刷新后仍可重试)
    viewNode = (
      <AnalysisView
        run={failedRun}
        error={failedRun.error}
        onRetry={handleRetry}
        onEdit={enterSetup}
        agentName="面试出题"
        icon={Bot}
        runningDescription="正在阅读你的简历,生成个性化面试题"
        failedDescription="这次出题没有完成,你可以重试或修改设定后重新开始"
        editLabel="修改设定"
      />
    );
  } else {
    viewNode = <InterviewSetup initialValues={prefill} onSubmit={handleStart} />;
  }

  return (
    <>
      {viewNode}
      <Dialog
        open={pendingStart !== null}
        onOpenChange={(open) => {
          if (!open) setPendingStart(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重新开始面试?</DialogTitle>
            <DialogDescription>
              已有进行中的面试场次,重新开始将清除当前全部作答与进度。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingStart(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                const values = pendingStart;
                setPendingStart(null);
                if (values) void doStart(values).catch(() => undefined);
              }}
            >
              重新开始
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
