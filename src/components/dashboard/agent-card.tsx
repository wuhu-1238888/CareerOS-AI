// Agent 顾问卡(5.1,DesignSystem 核心组件 1):48px 圆形图标(green-600 底白描线)→ 名称 + AI 标识 + 状态 badge
// → 13px 说明 → 状态内容(分析中:进度条 + 末条文案轮播;已完成:最近产出)→「上次分析」相对时间。
// 状态一律颜色+文字双通道;点击进入对应模块;hover 上浮 2px(transform 不改变布局)。
import Link from "next/link";
import { Loader2, type LucideIcon } from "lucide-react";
import { AiBadge } from "@/components/shared/ai-badge";
import { formatRelativeTime } from "./format";
import type { AgentStatusView } from "@/lib/dashboard/stats";

const STATUS_BADGES = {
  succeeded: { label: "已完成", className: "bg-success-bg text-success" },
  running: { label: "分析中", className: "bg-warning-bg text-warning" },
  failed: { label: "失败", className: "bg-danger-bg text-danger" },
  idle: { label: "待命", className: "bg-sunken text-ink-muted" },
} as const;

export function AgentCard({
  name,
  description,
  icon: Icon,
  agent,
  latestOutput,
  href,
}: {
  name: string;
  description: string;
  icon: LucideIcon;
  agent: AgentStatusView;
  /** succeeded 时的「最近产出」一句话(数据驱动;无产出 → null) */
  latestOutput: string | null;
  href: string;
}) {
  const badge = STATUS_BADGES[agent.status];
  const percent = Math.round((agent.progressCount / 5) * 100);

  return (
    <Link
      href={href}
      className="group block rounded-card border border-hairline bg-surface p-6 shadow-card transition-transform hover:-translate-y-0.5 hover:shadow-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-body-lg font-medium text-ink">{name}</p>
            <AiBadge />
            <span className={`rounded-pill px-2 py-0.5 text-caption ${badge.className}`}>
              {agent.status === "running" ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {badge.label}
                </span>
              ) : (
                badge.label
              )}
            </span>
          </div>
          <p className="mt-1 text-body-sm text-ink-muted">{description}</p>
        </div>
      </div>

      <div className="mt-4 min-h-14">
        {agent.status === "running" && (
          <div aria-live="polite">
            <div
              className="h-1 w-full overflow-hidden rounded-pill bg-sunken"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${name}分析进度`}
            >
              <div
                className="h-full rounded-pill bg-green-600 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-body-sm text-ink-secondary">{agent.lastMessage ?? "正在启动分析…"}</p>
          </div>
        )}
        {agent.status === "succeeded" && (
          <p className="text-body-sm text-ink-secondary">
            {latestOutput ?? "最近分析已完成,进入模块查看结果"}
          </p>
        )}
        {agent.status === "failed" && (
          <p className="text-body-sm text-danger">最近一次分析未完成,进入模块重试</p>
        )}
        {agent.status === "idle" && <p className="text-body-sm text-ink-muted">尚未运行过分析</p>}
      </div>

      {agent.lastRunAt && (
        <p className="mt-3 text-caption text-ink-faint">上次分析:{formatRelativeTime(agent.lastRunAt)}</p>
      )}
    </Link>
  );
}
