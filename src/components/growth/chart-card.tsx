"use client";
// 图表四态壳(8.2,DesignRules 每图四态):loading 骨架 / error 重试 / empty 引导 / data 图表。
// 无数据渲染引导文案而非报错(计划 8.2:数据不足展示引导);重试由调用方传入 refetch。
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function ChartCard({
  title,
  description,
  loading,
  error,
  onRetry,
  empty,
  emptyText,
  children,
}: {
  title: string;
  description?: string;
  loading: boolean;
  error: boolean;
  onRetry?: () => void;
  /** 无数据:渲染引导文案(不报错) */
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
      <h2 className="text-h2 text-ink">{title}</h2>
      {description ? <p className="mt-1 text-body-sm text-ink-muted">{description}</p> : null}
      <div className="mt-4">
        {loading ? (
          <Skeleton className="h-56 w-full" />
        ) : error ? (
          <div className="rounded-control bg-sunken p-6 text-center">
            <p role="alert" className="text-body-sm text-ink-secondary">
              图表数据加载失败
            </p>
            {onRetry ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-3"
                onClick={onRetry}
              >
                重试
              </Button>
            ) : null}
          </div>
        ) : empty ? (
          <p className="rounded-control bg-sunken p-6 text-center text-body-sm text-ink-muted">
            {emptyText}
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
