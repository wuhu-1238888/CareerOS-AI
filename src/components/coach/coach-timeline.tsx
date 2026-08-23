"use client";
// 90 天提升计划时间线(6.4):视觉复用 roadmap-timeline 语言(sticky 概览带 + 纵向时间线节点
// + 周卡手风琴 + 任务行列表),数据模型为固定 13 周教练计划(无任务状态列,任务只读)。
// 节点三种视觉态基于真实数据:里程碑周 = 强调节点(绿环,周卡带「里程碑」徽章)、第 13 周 = 完成节点(实心绿)、
// 其余 = 中性节点;不虚构任务进度。全 token 类名,零硬编码色值。
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoachPlan } from "@/lib/coach/analysis-schemas";

const SECTION_TITLE = "text-caption font-semibold text-ink-secondary";

export function CoachTimeline({ plan }: { plan: CoachPlan }) {
  // 默认展开第一周;多周可同时展开(与路线图阶段卡一致)
  const [openWeeks, setOpenWeeks] = useState<Set<number>>(
    () => new Set(plan.weeks[0] ? [plan.weeks[0].week] : [])
  );
  const milestoneByWeek = new Map(plan.milestones.map((m) => [m.week, m.title]));
  const p0Skills = plan.priorityMatrix
    .filter((m) => m.priority === "P0")
    .map((m) => m.skill);

  function toggleWeek(week: number) {
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  }

  return (
    <div className="w-full">
      {/* sticky 概览带:计划概览 | 优先攻坚(P0)两区 */}
      <div className="sticky top-16 z-10 border-b border-hairline bg-canvas py-3">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-8">
          <div className="min-w-0">
            <p className={SECTION_TITLE}>计划概览</p>
            <p className="mt-1 text-body-lg font-medium text-ink">90 天提升计划</p>
            <p className="mt-0.5 text-caption text-ink-muted">
              13 周 · 每周 {plan.weeklyHours} 小时 · {plan.priorityMatrix.length} 项能力差距
            </p>
          </div>
          {p0Skills.length > 0 ? (
            <div className="shrink-0 md:text-right">
              <p className={SECTION_TITLE}>优先攻坚(P0)</p>
              <div className="mt-1.5 flex flex-wrap gap-2 md:justify-end">
                {p0Skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-pill bg-danger-bg px-2.5 py-1 text-body-sm text-danger"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* 纵向时间线:周节点(里程碑周绿环强调/第 13 周实心绿/其余中性)+ 连线 */}
      <ol className="mt-6">
        {plan.weeks.map((week, index) => {
          const open = openWeeks.has(week.week);
          const milestoneTitle = milestoneByWeek.get(week.week);
          const totalMinutes = week.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
          return (
            <li key={week.week} className="flex gap-4">
              {/* 时间线轨道:节点 + 连线(轨道列保持 32px,周卡吃掉剩余宽度) */}
              <div className="flex flex-col items-center" aria-hidden>
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-body-sm",
                    milestoneTitle && "bg-card ring-2 ring-green-400 text-green-700",
                    !milestoneTitle && week.week === 13 && "bg-green-600 text-white",
                    !milestoneTitle && week.week !== 13 && "bg-card ring-2 ring-hairline-strong text-ink-muted"
                  )}
                >
                  {week.week}
                </span>
                {index < plan.weeks.length - 1 ? <span className="w-px flex-1 bg-hairline" /> : null}
              </div>

              {/* 周卡:里程碑周 hairline-strong 描边;手风琴展开 */}
              <div className="mb-4 min-w-0 flex-1">
                <article
                  className={cn(
                    "rounded-card border bg-surface shadow-card",
                    milestoneTitle ? "border-hairline-strong" : "border-hairline"
                  )}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => toggleWeek(week.week)}
                    className="flex w-full items-center justify-between gap-3 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="min-w-0">
                      <p className="text-caption text-ink-muted">第 {week.week} 周</p>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                        <span className="text-h3 text-ink">{week.theme}</span>
                        {milestoneTitle ? (
                          <span className="rounded-pill bg-green-50 px-2 py-0.5 text-caption text-green-700">
                            里程碑:{milestoneTitle}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-caption text-ink-muted">{totalMinutes} 分钟</span>
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
                    <div className="border-t border-hairline p-5">
                      <ul className="space-y-2" aria-label="本周任务">
                        {week.tasks.map((task, taskIndex) => (
                          <li
                            key={`${task.title}-${taskIndex}`}
                            className="rounded-control bg-sunken p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="flex min-w-0 items-start gap-2 text-body-sm text-ink">
                                <span aria-hidden className="shrink-0 text-ink-faint">
                                  ○
                                </span>
                                {task.title}
                              </p>
                              <span className="shrink-0 rounded-pill bg-surface px-2 py-0.5 text-caption text-ink-muted">
                                {task.estimatedMinutes} 分钟
                              </span>
                            </div>
                            <p className="mt-1.5 text-body-sm text-ink-secondary">
                              产出物:{task.deliverable}
                            </p>
                            <p className="mt-0.5 text-body-sm text-ink-secondary">
                              完成标准:{task.completionCriteria}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
