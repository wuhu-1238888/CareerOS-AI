"use client";
// 工作台成长区块(8.2,D1):画像版本数 + 最新匹配度 + 近 8 周任务 sparkline(内联 SVG;
// chart.* 色只进图表,深色经 use-token-color)+「查看完整报告」链接(D1:区块内入口进
// /dashboard/growth,不新增顶栏入口)。数据不足(无画像/无任务)→ 区块内引导,不报错。
import Link from "next/link";
import { ArrowRight, TrendingUp } from "lucide-react";
import { trpc } from "@/trpc/client";
import { colors } from "@/lib/design/tokens";
import { useTokenColor } from "@/lib/design/use-token-color";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// 内联 sparkline:8 个周桶计数归一化折线 + 基线;svg aria-hidden,数据以 sr-only 列表供读屏
function Sparkline({
  buckets,
  stroke,
  grid,
}: {
  buckets: { count: number }[];
  stroke: string;
  grid: string;
}) {
  const W = 160;
  const H = 40;
  const PAD = 3;
  const max = Math.max(...buckets.map((bucket) => bucket.count), 1);
  const step = (W - PAD * 2) / Math.max(buckets.length - 1, 1);
  const points = buckets
    .map(
      (bucket, i) =>
        `${PAD + i * step},${H - PAD - (bucket.count / max) * (H - PAD * 2)}`
    )
    .join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-12 w-full" aria-hidden>
      <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={grid} strokeWidth="1" />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GrowthBlock() {
  const query = trpc.growth.block.useQuery();
  const token = useTokenColor();

  if (query.isLoading) {
    return (
      <section className="mt-8" aria-label="加载中">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-4 h-32 w-full" />
      </section>
    );
  }
  if (query.isError || !query.data) {
    return (
      <section className="mt-8 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <h2 className="text-h2 text-ink">成长趋势</h2>
        <p role="alert" className="mt-2 text-body-sm text-ink-secondary">
          成长数据加载失败
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-2"
          onClick={() => void query.refetch()}
        >
          重试
        </Button>
      </section>
    );
  }

  const data = query.data;
  const hasData =
    data.profileVersion !== null ||
    data.latestMatchScore !== null ||
    data.sparkline.some((bucket) => bucket.count > 0);

  // 数据不足:区块内引导(计划 8.2:无足够数据展示引导而非报错)
  if (!hasData) {
    return (
      <section className="mt-8 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <h2 className="text-h2 text-ink">成长趋势</h2>
        <p className="mt-2 text-body-sm text-ink-muted">
          完成画像分析、匹配岗位或推进路线任务后,这里会展示你的成长趋势
        </p>
        <Button type="button" variant="ghost" size="sm" className="mt-3" asChild>
          <Link href="/profile">去完成画像</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-card border border-hairline bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h2 text-ink">成长趋势</h2>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/dashboard/growth">
            查看完整报告
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <p className="text-caption text-ink-faint">画像版本</p>
            <p className="text-body-lg font-medium text-ink">
              {data.profileVersion !== null ? `第 ${data.profileVersion} 版` : "—"}
              <span className="ml-2 text-caption font-normal text-ink-muted">
                {data.profileVersionCount > 0 ? `共分析 ${data.profileVersionCount} 次` : "尚未分析"}
              </span>
            </p>
          </div>
          <div>
            <p className="text-caption text-ink-faint">最新匹配度</p>
            <p className="text-body-lg font-medium text-ink">
              {data.latestMatchScore !== null ? `${data.latestMatchScore}%` : "—"}
            </p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <p className="text-caption text-ink-faint">近 8 周任务完成</p>
            <TrendingUp className="size-4 text-green-600" aria-hidden />
          </div>
          <Sparkline buckets={data.sparkline} stroke={colors.chart.green} grid={token.hairlineStrong} />
          <ul className="sr-only" aria-label="近 8 周任务完成数据">
            {data.sparkline.map((bucket) => (
              <li key={bucket.weekStart}>
                {bucket.weekStart}:{bucket.count} 个任务
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
