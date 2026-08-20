"use client";
// 成长路线时间线主视图(3.4,任务交互 3.5 接线):sticky 概要条(路径文案 + 总进度 + 重新生成)
// + 纵向时间线(节点三态 done/current/future + 连线)+ 阶段卡(默认折叠,展开显示目标/学习内容 Tag/
// 实践项目含产出物/检查点/任务列表)。
// 遵循 DesignSystem「Career Roadmap」与 DesignRules「职业路线页」:无横向甘特图、一屏 ≤4 阶段、
// 无完成弹窗庆祝、无付费课程引导;任务状态符号 + 文字双通道。
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/shared/ai-badge";
import { cn } from "@/lib/utils";

export type TimelineTask = {
  id: string;
  description: string;
  type: string;
  status: string;
  order: number;
};

export type TimelineStageContent = {
  learningContent: string[];
  practiceProjects: { title: string; deliverable: string }[];
  resources: string[];
  checkpoints: string[];
};

export type TimelineStage = {
  id: string;
  name: string;
  goal: string;
  order: number;
  estimatedDuration: string | null;
  content: TimelineStageContent | null;
  tasks: TimelineTask[];
};

export type TimelineRoadmap = {
  id: string;
  targetDirection: string;
  weeklyHours: number | null;
  currentStage: string | null;
  summary: { totalDuration: string; stageCount: number; finalGoal: string } | null;
  stages: TimelineStage[];
};

// 任务三态:符号 + 文字双通道(DesignRules 状态信号要求)
const TASK_STATUS_META = {
  pending: { symbol: "○", label: "待开始", className: "text-ink-faint" },
  in_progress: { symbol: "◐", label: "进行中", className: "text-warning" },
  completed: { symbol: "☑", label: "已完成", className: "text-green-600" },
} as const;

const STAGE_BADGE = {
  done: { label: "已完成", className: "bg-green-50 text-green-700" },
  current: { label: "进行中", className: "bg-warning-bg text-warning" },
  future: { label: "未开始", className: "bg-sunken text-ink-muted" },
} as const;

export function nextTaskStatus(status: string) {
  return status === "pending" ? "in_progress" : status === "in_progress" ? "completed" : "pending";
}

function stageIsDone(stage: TimelineStage): boolean {
  return stage.tasks.length > 0 && stage.tasks.every((task) => task.status === "completed");
}

export function RoadmapTimeline({
  roadmap,
  onRegenerate,
  onToggleTask,
  onFeedbackTask,
  regeneratingStageId,
  pendingTaskId,
}: {
  roadmap: TimelineRoadmap;
  /** 概要条「重新生成」入口(hub 注入);未提供时按钮不显示 */
  onRegenerate?: () => void;
  /** 3.5 接线:任务三态切换(未提供时任务只读) */
  onToggleTask?: (taskId: string, nextStatus: string) => void;
  /** 3.5 接线:任务反馈(太难了/已经会了,触发单阶段重生成) */
  onFeedbackTask?: (taskId: string, feedback: "太难了" | "已经会了") => void;
  /** 3.5 接线:正在重生成的阶段(显示 ai-badge「调整中」) */
  regeneratingStageId?: string | null;
  /** 3.5 接线:状态切换 mutation 在途的任务(禁用其切换按钮) */
  pendingTaskId?: string | null;
}) {
  // 默认展开首个「进行中」阶段(全部完成则展开第一个)——DesignSystem 阶段卡默认折叠
  const doneFlags = roadmap.stages.map(stageIsDone);
  const firstIncomplete = doneFlags.indexOf(false);
  const [openStages, setOpenStages] = useState<Set<string>>(
    () =>
      new Set(
        roadmap.stages.length > 0
          ? [roadmap.stages[firstIncomplete === -1 ? 0 : firstIncomplete]!.id]
          : []
      )
  );

  const totalTasks = roadmap.stages.reduce((sum, stage) => sum + stage.tasks.length, 0);
  const completedTasks = roadmap.stages.reduce(
    (sum, stage) => sum + stage.tasks.filter((task) => task.status === "completed").length,
    0
  );
  const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const statusOf = (index: number): "done" | "current" | "future" => {
    if (doneFlags[index]) return "done";
    return index === firstIncomplete ? "current" : "future";
  };

  function toggleStage(id: string) {
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-6">
      {/* sticky 概要条:路径文案 + 总进度 + 重新生成(DesignSystem 模板「从 X 到 Y」的「从」无数据源,适配为目标方向) */}
      <div className="sticky top-16 z-10 -mx-4 border-b border-hairline bg-canvas px-4 py-3 sm:px-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-body font-medium text-ink">
              成为「{roadmap.targetDirection}」的 {roadmap.summary?.totalDuration ?? "成长"} 路径
            </p>
            {roadmap.summary?.finalGoal ? (
              <p className="mt-0.5 truncate text-caption text-ink-muted">{roadmap.summary.finalGoal}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-20 overflow-hidden rounded-pill bg-sunken" aria-hidden>
                <span
                  className="block h-full rounded-pill bg-green-600 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="text-body-sm text-ink-secondary">总进度 {percent}%</span>
            </div>
            {onRegenerate ? (
              <Button type="button" variant="secondary" onClick={onRegenerate}>
                重新生成
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* 纵向时间线:节点三态 + 连线(已完成段绿/未完成段灰),一屏 ≤4 阶段由 Agent 输出约束保证 */}
      {roadmap.stages.length === 0 ? (
        <p className="mt-10 text-center text-body-sm text-ink-muted">路线图为空,请重新生成</p>
      ) : (
        <ol className="mt-6">
          {roadmap.stages.map((stage, index) => {
            const status = statusOf(index);
            const open = openStages.has(stage.id);
            const doneCount = stage.tasks.filter((task) => task.status === "completed").length;
            const badge = STAGE_BADGE[status];
            return (
              <li key={stage.id} className="flex gap-3">
                {/* 时间线轨道:节点 + 连线 */}
                <div className="flex flex-col items-center" aria-hidden>
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-body-sm",
                      status === "done" && "bg-green-600 text-white",
                      status === "current" && "bg-white ring-2 ring-green-400",
                      status === "future" && "bg-white ring-2 ring-hairline-strong"
                    )}
                  >
                    {status === "done" ? (
                      "✓"
                    ) : status === "current" ? (
                      <span className="size-2.5 rounded-full bg-green-400" />
                    ) : (
                      <span className="size-2.5 rounded-full bg-ink-faint" />
                    )}
                  </span>
                  {index < roadmap.stages.length - 1 ? (
                    <span
                      className={cn(
                        "w-px flex-1",
                        doneFlags[index] ? "bg-green-600" : "bg-hairline"
                      )}
                    />
                  ) : null}
                </div>

                {/* 阶段卡:默认折叠,展开显示目标/内容/项目/检查点/任务 */}
                <div className="mb-4 min-w-0 flex-1">
                  <article className="rounded-card border border-hairline bg-surface shadow-card">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggleStage(stage.id)}
                      className="flex w-full items-center justify-between gap-3 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-body-lg font-medium text-ink">{stage.name}</span>
                        {stage.estimatedDuration ? (
                          <span className="rounded-pill bg-sunken px-2 py-0.5 text-caption text-ink-secondary">
                            {stage.estimatedDuration}
                          </span>
                        ) : null}
                        <span className={cn("rounded-pill px-2 py-0.5 text-caption", badge.className)}>
                          {badge.label}
                        </span>
                        {regeneratingStageId === stage.id ? (
                          <span className="flex items-center gap-1">
                            <AiBadge />
                            <span className="rounded-pill bg-warning-bg px-2 py-0.5 text-caption text-warning">
                              调整中
                            </span>
                          </span>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-caption text-ink-muted">
                          {doneCount}/{stage.tasks.length} 任务
                        </span>
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 text-ink-faint transition-transform",
                            open && "rotate-180"
                          )}
                          aria-hidden
                        />
                      </div>
                    </button>

                    {open ? (
                      <div className="space-y-5 border-t border-hairline p-5">
                        <div>
                          <p className="text-caption text-ink-faint">阶段目标</p>
                          <p className="mt-1 text-body-sm text-ink">{stage.goal}</p>
                        </div>

                        {stage.content ? (
                          <>
                            <div>
                              <p className="text-caption text-ink-faint">学习内容</p>
                              <ul className="mt-2 flex flex-wrap gap-2" aria-label="学习内容">
                                {stage.content.learningContent.map((item) => (
                                  <li
                                    key={item}
                                    className="rounded-pill bg-sunken px-2.5 py-1 text-body-sm text-ink-secondary"
                                  >
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            <div>
                              <p className="text-caption text-ink-faint">实践项目</p>
                              <ul className="mt-2 space-y-2" aria-label="实践项目">
                                {stage.content.practiceProjects.map((project) => (
                                  <li key={project.title} className="rounded-control bg-sunken p-3">
                                    <p className="text-body-sm font-medium text-ink">{project.title}</p>
                                    <p className="mt-0.5 text-body-sm text-ink-secondary">
                                      产出物:{project.deliverable}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {stage.content.checkpoints.length > 0 ? (
                              <div>
                                <p className="text-caption text-ink-faint">能力检查点</p>
                                <ul className="mt-2 space-y-1.5" aria-label="能力检查点">
                                  {stage.content.checkpoints.map((checkpoint) => (
                                    <li
                                      key={checkpoint}
                                      className="flex items-start gap-2 text-body-sm text-ink-secondary"
                                    >
                                      <span aria-hidden className="shrink-0 text-ink-faint">
                                        ☐
                                      </span>
                                      {checkpoint}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}

                            {stage.content.resources.length > 0 ? (
                              <div>
                                <p className="text-caption text-ink-faint">资源推荐</p>
                                <ul className="mt-2 list-inside list-disc space-y-1 text-body-sm text-ink-secondary">
                                  {stage.content.resources.map((resource) => (
                                    <li key={resource}>{resource}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </>
                        ) : null}

                        <div>
                          <p className="text-caption text-ink-faint">任务列表</p>
                          <ul className="mt-2 space-y-2" aria-label="任务列表">
                            {stage.tasks.map((task) => {
                              const meta = TASK_STATUS_META[task.status as keyof typeof TASK_STATUS_META] ?? TASK_STATUS_META.pending;
                              const interactive = !!onToggleTask;
                              return (
                                <li
                                  key={task.id}
                                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-surface px-3 py-2"
                                >
                                  {interactive ? (
                                    <button
                                      type="button"
                                      disabled={pendingTaskId === task.id}
                                      onClick={() => onToggleTask!(task.id, nextTaskStatus(task.status))}
                                      aria-label={`任务「${task.description}」,当前${meta.label},点击切换状态`}
                                      className={cn(
                                        "flex min-w-0 items-center gap-1.5 text-left text-body-sm",
                                        meta.className,
                                        "disabled:cursor-not-allowed disabled:opacity-50"
                                      )}
                                    >
                                      <span aria-hidden>{meta.symbol}</span>
                                      <span className="truncate text-ink">{task.description}</span>
                                      <span className="shrink-0 text-caption">{meta.label}</span>
                                    </button>
                                  ) : (
                                    <span className={cn("flex min-w-0 items-center gap-1.5 text-body-sm", meta.className)}>
                                      <span aria-hidden>{meta.symbol}</span>
                                      <span className="truncate text-ink">{task.description}</span>
                                      <span className="shrink-0 text-caption">{meta.label}</span>
                                    </span>
                                  )}
                                  <span className="rounded-pill bg-sunken px-1.5 py-0.5 text-caption text-ink-muted">
                                    {task.type}
                                  </span>
                                  {/* 反馈按钮(3.5):每个任务附「太难了/已经会了」ghost 小按钮;阶段调整中禁用 */}
                                  {onFeedbackTask ? (
                                    <span className="ml-auto flex shrink-0 items-center gap-1">
                                      <button
                                        type="button"
                                        disabled={regeneratingStageId === stage.id}
                                        onClick={() => onFeedbackTask(task.id, "太难了")}
                                        className="rounded-control px-1 py-0.5 text-xs text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        太难了
                                      </button>
                                      <button
                                        type="button"
                                        disabled={regeneratingStageId === stage.id}
                                        onClick={() => onFeedbackTask(task.id, "已经会了")}
                                        className="rounded-control px-1 py-0.5 text-xs text-ink-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        已经会了
                                      </button>
                                    </span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    ) : null}
                  </article>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
