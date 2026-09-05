"use client";
// 工作台成长区块(8.2,D1 + 概览化):工作台四问之「成长有没有变化」。真实趋势历史不足
// (匹配度 JobMatch 单行无历史;任务完成历史受替换式路线图限制,仅覆盖当前路线图)→ 不硬画
// 折线,降级为诚实的「成长概览」三事实行:职业画像版本 / 最新岗位匹配度 / 任务完成计数。
// 真实趋势(画像版本演进 diff、匹配度 run 曲线、12 周任务趋势)保留在完整报告页
// /dashboard/growth,经「查看完整报告」进入。数据不足(无画像/无匹配/无任务)→ 区块内引导。
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function GrowthBlock() {
  const query = trpc.growth.block.useQuery();

  if (query.isLoading) {
    return (
      <section className="mt-8" aria-label="加载中">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="mt-4 h-24 w-full" />
      </section>
    );
  }
  if (query.isError || !query.data) {
    return (
      <section className="mt-8 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <h2 className="text-h2 text-ink">成长概览</h2>
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
    data.taskStats.total > 0;

  // 数据不足:区块内引导(计划 8.2:无足够数据展示引导而非报错)
  if (!hasData) {
    return (
      <section className="mt-8 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <h2 className="text-h2 text-ink">成长概览</h2>
        <p className="mt-2 text-body-sm text-ink-muted">
          完成画像分析、匹配岗位或推进路线任务后,这里会展示你的成长概览
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
        <h2 className="text-h2 text-ink">成长概览</h2>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href="/dashboard/growth">
            查看完整报告
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="mt-4 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="text-caption text-ink-faint">职业画像</p>
          <p className="mt-1 text-body-lg font-medium text-ink">
            {data.profileVersion !== null ? `第 ${data.profileVersion} 版` : "—"}
            <span className="ml-2 text-caption font-normal text-ink-muted">
              {data.profileVersionCount > 0 ? `共分析 ${data.profileVersionCount} 次` : "尚未分析"}
            </span>
          </p>
        </div>
        <div>
          <p className="text-caption text-ink-faint">最新岗位匹配度</p>
          <p className="mt-1 text-body-lg font-medium text-ink">
            {data.latestMatchScore !== null ? `${data.latestMatchScore}%` : "—"}
          </p>
        </div>
        <div>
          <p className="text-caption text-ink-faint">任务完成</p>
          <p className="mt-1 text-body-lg font-medium text-ink">
            {data.taskStats.total > 0
              ? `${data.taskStats.completed} / ${data.taskStats.total}`
              : "—"}
          </p>
        </div>
      </div>
    </section>
  );
}
