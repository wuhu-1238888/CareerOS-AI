"use client";
// 90 天提升计划视图(6.4,Desktop 布局):①差距优先级矩阵(P0 红/P1 琥珀/P2 灰徽章)
// ②90 天时间线(CoachTimeline,视觉复用路线图时间线)③资源卡网格(free/paid 徽章,免费置前由管线保证)
// ④里程碑 + 风险 ⑤ghost「返回匹配报告」。目标岗位来自表单输入(CoachPlan 输出不含该字段),由 Hub 传入。
import { Flag, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/shared/ai-badge";
import { cn } from "@/lib/utils";
import { CoachTimeline } from "./coach-timeline";
import type { CoachPlan } from "@/lib/coach/analysis-schemas";

// 优先级徽章:颜色 + 文字双通道(DesignRules 可访问性)
const PRIORITY_STYLE = {
  P0: "bg-danger-bg text-danger",
  P1: "bg-warning-bg text-warning",
  P2: "bg-sunken text-ink-muted",
} as const;

// 资源费用徽章:free 绿 / paid 灰,颜色 + 文字双通道
const COST_STYLE = {
  free: { label: "免费", className: "bg-green-50 text-green-700" },
  paid: { label: "付费", className: "bg-sunken text-ink-muted" },
} as const;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-h2 text-ink">{children}</h2>;
}

export function CoachPlanView({
  plan,
  targetPosition,
  onBack,
}: {
  plan: CoachPlan;
  /** 目标岗位(表单输入;输出 Schema 不含该字段) */
  targetPosition: string;
  /** 返回匹配报告(hub 注入;未接线时按钮禁用) */
  onBack?: () => void;
}) {
  const p0Count = plan.priorityMatrix.filter((m) => m.priority === "P0").length;

  return (
    <div className="w-full space-y-6 py-6">
      {/* Hero:标题 + 目标岗位/周时概览 */}
      <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <div className="flex items-center gap-2">
          <AiBadge />
          <h1 className="text-h1 text-ink">90 天提升计划</h1>
        </div>
        <p className="mt-2 text-body text-ink-secondary">
          目标岗位「{targetPosition}」 · 每周 {plan.weeklyHours} 小时 · 13 周 · {p0Count} 项 P0 优先攻坚
        </p>
      </section>

      {/* ① 差距优先级矩阵 */}
      <section className="space-y-4">
        <SectionTitle>差距优先级矩阵</SectionTitle>
        <ul className="space-y-3">
          {plan.priorityMatrix.map((item) => (
            <li
              key={item.skill}
              className="rounded-card border border-hairline bg-surface p-4 shadow-card"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn("rounded-pill px-2 py-0.5 text-caption", PRIORITY_STYLE[item.priority])}
                >
                  {item.priority}
                </span>
                <span className="text-body font-medium text-ink">{item.skill}</span>
                <span className="text-caption text-ink-faint">重要度 {item.importance}/5</span>
                <span className="rounded-pill bg-sunken px-2 py-0.5 text-caption text-ink-muted">
                  差距{item.gapSize}
                </span>
              </div>
              <p className="mt-1.5 text-body-sm text-ink-secondary">{item.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ② 90 天时间线 */}
      <section className="space-y-4">
        <SectionTitle>90 天计划</SectionTitle>
        <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <CoachTimeline plan={plan} />
        </div>
      </section>

      {/* ③ 资源卡网格:管线已免费前置排序,此处按序渲染 */}
      {plan.resources.length > 0 ? (
        <section className="space-y-4">
          <SectionTitle>学习资源</SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="学习资源">
            {plan.resources.map((resource, index) => {
              const cost = COST_STYLE[resource.cost];
              return (
                <li
                  key={`${resource.title}-${index}`}
                  className="rounded-card border border-hairline bg-surface p-4 shadow-card"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-pill bg-sunken px-2 py-0.5 text-caption text-ink-secondary">
                      {resource.type}
                    </span>
                    <span className={cn("rounded-pill px-2 py-0.5 text-caption", cost.className)}>
                      {cost.label}
                    </span>
                  </div>
                  <p className="mt-2 text-body-sm font-medium text-ink">
                    {resource.url ? (
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-2 hover:underline"
                      >
                        {resource.title}
                      </a>
                    ) : (
                      resource.title
                    )}
                  </p>
                  {resource.note ? (
                    <p className="mt-1 text-body-sm text-ink-secondary">{resource.note}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* ④ 里程碑 + 风险 */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-card bg-sunken p-6">
          <div className="flex items-center gap-2">
            <Flag className="size-4 text-green-600" aria-hidden />
            <SectionTitle>里程碑</SectionTitle>
          </div>
          {plan.milestones.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {plan.milestones.map((milestone) => (
                <li key={milestone.title} className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 rounded-pill bg-green-50 px-2 py-0.5 text-caption text-green-700">
                    第 {milestone.week} 周
                  </span>
                  <p className="text-body-sm text-ink">{milestone.title}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-body-sm text-ink-muted">本计划未设置里程碑</p>
          )}
        </div>
        <div className="rounded-card bg-sunken p-6">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-warning" aria-hidden />
            <SectionTitle>执行风险</SectionTitle>
          </div>
          {plan.risks.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {plan.risks.map((risk) => (
                <li key={risk.risk} className="rounded-control bg-surface p-3">
                  <p className="text-body-sm font-medium text-ink">{risk.risk}</p>
                  <p className="mt-0.5 text-body-sm text-ink-secondary">应对:{risk.mitigation}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-body-sm text-ink-muted">本计划未提示明显风险</p>
          )}
        </div>
      </section>

      {/* ⑤ 返回匹配报告 */}
      <section className="rounded-card bg-sunken p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionTitle>计划已生成</SectionTitle>
            <p className="mt-1 text-body-sm text-ink-muted">
              回到匹配报告可查看岗位要求与逐项能力对比。
            </p>
          </div>
          <Button variant="ghost" disabled={!onBack} onClick={onBack}>
            返回匹配报告
          </Button>
        </div>
      </section>
    </div>
  );
}
