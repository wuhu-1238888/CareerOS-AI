"use client";
// 成长路线页状态枢纽(3.4):方向选择表单 / 生成过程 / 时间线主视图 / 失败恢复。
// 镜像 profile-hub 状态机:生成态统一轮询 navigator.roadmap.latestRun(700ms,进度事件已随执行落库);
// 失败态提供「重试」(会话内用最近一次提交数据;刷新后服务端从 AgentRun.input 重放)与「修改信息」;
// 时间线概要条「重新生成」→ 回到预填表单(方向/周时/阶段自评)。
import { useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";
import { DirectionForm, type DirectionFormInput, type SuggestedDirection } from "./direction-form";
import { RoadmapTimeline } from "./roadmap-timeline";
import { ShareCard } from "@/components/shared/share-card";
import { ShareDialog } from "@/components/shared/share-dialog";
import { AnalysisView } from "@/components/profile/analysis-view";

function friendlyError(err: unknown): string {
  return err instanceof Error ? err.message : "生成失败,请稍后重试";
}

export function NavigatorHub() {
  const utils = trpc.useUtils();
  const profile = trpc.profile.get.useQuery();
  const roadmap = trpc.navigator.roadmap.get.useQuery();
  const generate = trpc.navigator.roadmap.generate.useMutation();
  const retry = trpc.navigator.roadmap.retry.useMutation();
  const updateTask = trpc.navigator.task.updateStatus.useMutation();
  const regenerate = trpc.navigator.stage.regenerate.useMutation();

  // 会话提交状态:submitted=true 表示生成 mutation 在途;generateError 为失败文案(驱动失败视图)
  const [submitted, setSubmitted] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [regenerateMode, setRegenerateMode] = useState(false);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [regeneratingStageId, setRegeneratingStageId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const lastInput = useRef<DirectionFormInput | null>(null);
  const finishedRef = useRef(false);

  const hasRoadmap = !!roadmap.data;

  // 跟踪最近一次 run:无路线图(首建/恢复)或提交在途时启用;仅 running/在途时轮询 700ms
  const latestRun = trpc.navigator.roadmap.latestRun.useQuery(undefined, {
    enabled: !roadmap.isLoading && (!hasRoadmap || submitted),
    refetchInterval: (query) =>
      submitted || query.state.data?.status === "running" ? 700 : false,
  });

  // 恢复路径:刷新后 run 已 succeeded(管线已完成)→ 刷新路线图进入时间线视图
  useEffect(() => {
    if (!hasRoadmap && latestRun.data?.status === "succeeded" && !finishedRef.current) {
      finishedRef.current = true;
      void utils.navigator.roadmap.get.invalidate();
    }
  }, [hasRoadmap, latestRun.data?.status, utils]);

  if (roadmap.isLoading || profile.isLoading) {
    return (
      <div className="w-full space-y-4 py-6" aria-label="加载中">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const recovering = !generateError && !hasRoadmap && latestRun.data?.status === "running";
  const failedRun =
    !regenerateMode && !generateError && latestRun.data?.status === "failed"
      ? latestRun.data
      : null;

  // 在途提交时忽略历史 run(避免把上次失败的旧 run 当作本次状态),等待轮询发现新 run
  const runForView =
    submitted && latestRun.data && latestRun.data.status !== "running"
      ? null
      : (latestRun.data ?? null);

  // careerPaths 为 Prisma Json 列(tRPC 序列化后为深递归类型),经 unknown 桥接避免 TS2589
  const suggestedDirections: SuggestedDirection[] =
    (profile.data?.careerPaths as unknown as SuggestedDirection[] | undefined) ?? [];

  async function submit(input: DirectionFormInput) {
    lastInput.current = input;
    finishedRef.current = false;
    setGenerateError(null);
    setRegenerateMode(false);
    setSubmitted(true);
    try {
      await generate.mutateAsync(input);
      await utils.navigator.roadmap.get.invalidate();
    } catch (err) {
      setGenerateError(friendlyError(err));
      // 向表单抛出以保留错误提示(表单仅在提交成功时离开)
      throw err;
    } finally {
      setSubmitted(false);
    }
  }

  async function handleRetry() {
    // 会话内失败:直接用最近一次提交的数据重试
    if (lastInput.current) {
      await submit(lastInput.current).catch(() => undefined);
      return;
    }
    // 刷新后恢复:服务端从失败 run 的 input 重放生成
    if (!failedRun) {
      setGenerateError("生成任务不存在,请重新填写");
      return;
    }
    finishedRef.current = false;
    setGenerateError(null);
    setSubmitted(true);
    try {
      await retry.mutateAsync({ runId: failedRun.id });
      await utils.navigator.roadmap.get.invalidate();
    } catch (err) {
      setGenerateError(friendlyError(err));
    } finally {
      setSubmitted(false);
    }
  }

  // 重新生成:回到预填表单(方向/周时/阶段自评取自当前路线图),提交走同一生成管线(替换式)
  function handleRegenerate() {
    lastInput.current = null;
    setGenerateError(null);
    setRegenerateMode(true);
  }

  // 3.5 任务三态切换:服务端持久化(mutation 在途禁用该任务,可撤销),失败 toast 报错
  async function handleToggleTask(taskId: string, nextStatus: string) {
    setPendingTaskId(taskId);
    try {
      await updateTask.mutateAsync({
        taskId,
        status: nextStatus as "pending" | "in_progress" | "completed",
      });
      await utils.navigator.roadmap.get.invalidate();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setPendingTaskId(null);
    }
  }

  // 3.5 任务反馈:太难了/已经会了 → 单阶段重生成(该阶段「调整中」+ 按钮禁用),成功后 toast 并刷新
  async function handleFeedbackTask(taskId: string, feedback: "太难了" | "已经会了") {
    const data = roadmap.data;
    if (!data) return;
    const stage = data.stages.find((s) => s.tasks.some((t) => t.id === taskId));
    if (!stage) return;
    setRegeneratingStageId(stage.id);
    try {
      await regenerate.mutateAsync({ roadmapId: data.id, stageId: stage.id, feedback });
      await utils.navigator.roadmap.get.invalidate();
      toast.success("已按你的反馈调整该阶段,内容已更新");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setRegeneratingStageId(null);
    }
  }

  let view: React.ReactNode;
  if (submitted || recovering || generateError) {
    view = (
      <AnalysisView
        run={runForView}
        error={generateError}
        onRetry={handleRetry}
        onEdit={() => {
          setGenerateError(null);
          setRegenerateMode(true);
        }}
        agentName="职业规划师"
        icon={Compass}
        runningDescription="正在规划你的成长路线,拆解阶段与任务"
        failedDescription="这次规划没有完成,你可以重试或修改方向后重新生成"
      />
    );
  } else if (regenerateMode || (!hasRoadmap && !failedRun)) {
    view = (
      <DirectionForm
        suggestedDirections={suggestedDirections}
        onSubmit={submit}
        initial={
          regenerateMode && roadmap.data
            ? {
                direction: roadmap.data.targetDirection,
                weeklyHours: roadmap.data.weeklyHours,
                currentStage: roadmap.data.currentStage,
              }
            : null
        }
      />
    );
  } else if (hasRoadmap && roadmap.data) {
    // 分享卡片(6.8)总进度:与 RoadmapTimeline 概览带同一计算口径(完成任务 / 全部任务)
    const totalTasks = roadmap.data.stages.reduce((sum, stage) => sum + stage.tasks.length, 0);
    const completedTasks = roadmap.data.stages.reduce(
      (sum, stage) => sum + stage.tasks.filter((task) => task.status === "completed").length,
      0
    );
    const sharePercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    view = (
      <>
        <RoadmapTimeline
          roadmap={roadmap.data}
          onRegenerate={handleRegenerate}
          onShare={() => setShareOpen(true)}
          onToggleTask={handleToggleTask}
          onFeedbackTask={handleFeedbackTask}
          regeneratingStageId={regeneratingStageId}
          pendingTaskId={pendingTaskId}
        />
        <ShareDialog open={shareOpen} onOpenChange={setShareOpen} fileName="careeros-路线图分享.png">
          <ShareCard
            data={{
              variant: "roadmap",
              targetDirection: roadmap.data.targetDirection,
              totalDuration: roadmap.data.summary?.totalDuration ?? null,
              finalGoal: roadmap.data.summary?.finalGoal ?? null,
              weeklyHours: roadmap.data.weeklyHours,
              stages: roadmap.data.stages.map((stage) => ({
                name: stage.name,
                goal: stage.goal,
              })),
              percent: sharePercent,
            }}
          />
        </ShareDialog>
      </>
    );
  } else if (failedRun) {
    view = (
      <AnalysisView
        run={failedRun}
        error={failedRun.error}
        onRetry={handleRetry}
        onEdit={() => {
          setGenerateError(null);
          setRegenerateMode(true);
        }}
        agentName="职业规划师"
        icon={Compass}
        runningDescription="正在规划你的成长路线,拆解阶段与任务"
        failedDescription="这次规划没有完成,你可以重试或修改方向后重新生成"
      />
    );
  } else {
    view = (
      <DirectionForm suggestedDirections={suggestedDirections} onSubmit={submit} />
    );
  }

  return <>{view}</>;
}
