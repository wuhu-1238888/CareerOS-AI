"use client";
// 匿名路径有效性聚合卡(8.2):按推荐方向分组的平均阶段达成率,仅脱敏数据(方向/样本数/均值,
// 服务端保证组内 ≥5 用户且无任何用户标识)。样本不足的组服务端不返回,全空 → 引导文案。
// 标注「示例」(DesignRules:匿名聚合数据标「示例」,不暗示平台统计口径)。
import { trpc } from "@/trpc/client";
import { ChartCard } from "./chart-card";

export function AggregateCard() {
  const query = trpc.growth.aggregate.useQuery();
  return (
    <ChartCard
      title="路径有效性"
      description="选择相同方向的用户,平均完成了多少路线阶段"
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => void query.refetch()}
      empty={!!query.data && query.data.length === 0}
      emptyText="选择方向、完成路线任务后,这里会出现同类用户的统计(样本不足时不展示,保护隐私)"
    >
      <div className="space-y-3">
        {(query.data ?? []).map((entry) => (
          <div key={entry.direction} className="rounded-control bg-sunken p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-body font-medium text-ink">{entry.direction}</p>
              <p className="text-caption text-ink-muted">
                {entry.userCount} 人样本 · 平均达成 {Math.round(entry.avgStageCompletion * 100)}%
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${Math.round(entry.avgStageCompletion * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-caption text-ink-faint">
        示例 · 数据来自选择相同方向的用户,已匿名聚合
      </p>
    </ChartCard>
  );
}
