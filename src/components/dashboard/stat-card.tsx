// Stat Card(5.1,DesignSystem):眉标 12px/600 → 大数字 32px/700 → 13px 增量徽章 + 16px 趋势图标。
// 纯展示组件:数据由 dashboard-view 注入;增量徽章仅在存在基线时显示(提升绿 / 下降红,颜色+文字双通道)。
// 收尾微调(9.x):上下内边距 24px → 20px、眉标与数字间距 12px → 8px,卡片更紧凑,三卡等高由网格拉伸保证。
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatDelta = {
  text: string;
  trend: "up" | "down";
};

export function StatCard({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: StatDelta | null;
}) {
  return (
    <div className="rounded-card border border-hairline bg-surface px-6 py-5 shadow-card">
      <p className="text-eyebrow text-ink-muted">{label}</p>
      <p className="mt-2 text-num text-ink">{value}</p>
      {delta && (
        <p
          className={cn(
            "mt-2 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-body-sm",
            delta.trend === "up" ? "bg-success-bg text-success" : "bg-danger-bg text-danger"
          )}
        >
          {delta.trend === "up" ? (
            <TrendingUp className="size-4" aria-hidden />
          ) : (
            <TrendingDown className="size-4" aria-hidden />
          )}
          {delta.text}
        </p>
      )}
    </div>
  );
}
