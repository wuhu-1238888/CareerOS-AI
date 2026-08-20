"use client";
// 分析过程视图(2.4):Agent 卡(48px 圆形图标 + 状态 badge)+ 4px 进度条 + 生命周期文案轮播。
// 纯展示组件:数据由 ProfileHub 统一轮询 profile.latestRun(700ms)后传入,本组件不再发起查询。
// 失败 → 友好错误 + 重试 / 修改信息(草稿保留在 localStorage,返回表单不丢数据)。
import { Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/shared/ai-badge";
import { cn } from "@/lib/utils";

export type RunProgress = { stage: string; message: string };

export type RunView = {
  id: string;
  status: string;
  stale: boolean;
  progress: RunProgress[];
  error: string | null;
  /** tRPC 默认序列化:服务端 Date 在客户端为 ISO 字符串 */
  createdAt: string;
};

// 1.6 五个生命周期事件(start/prompt/llm/parse/done),进度条按事件数推进
const TOTAL_STAGES = 5;

export function AnalysisView({
  run,
  error,
  onRetry,
  onEdit,
}: {
  run: RunView | null;
  /** 本次会话内 mutation 失败的错误文案(优先于 run.error 显示) */
  error: string | null;
  onRetry: () => void;
  /** 返回表单修改信息(仅失败态提供) */
  onEdit: () => void;
}) {
  const failed = error ?? (run?.status === "failed" ? run.error ?? "分析未完成,请重试" : null);
  const progress = failed ? [] : (run?.progress ?? []);
  const currentMessage =
    progress.length > 0 ? progress[progress.length - 1]!.message : "正在启动分析…";
  const percent = Math.round((progress.length / TOTAL_STAGES) * 100);

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-6">
      <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        {/* Agent 卡头部:图标 + 名称 + AI 标识 + 状态 badge / 加载指示 */}
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600"
          >
            <UserRound className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-body-lg font-medium text-ink">画像顾问</p>
              <AiBadge />
              {failed ? (
                <span className="rounded-pill bg-danger-bg px-2 py-0.5 text-caption text-danger">
                  分析未完成
                </span>
              ) : (
                <span className="rounded-pill bg-warning-bg px-2 py-0.5 text-caption text-warning">
                  分析中
                </span>
              )}
            </div>
            <p className="mt-0.5 text-body-sm text-ink-muted">
              {failed ? "这次分析没有完成,你可以重试或修改信息后重新分析" : "正在分析你的背景,生成专属职业画像"}
            </p>
          </div>
          {!failed && <Loader2 className="size-5 shrink-0 animate-spin text-green-600" aria-hidden />}
        </div>

        {/* 失败态:友好错误 + 操作 */}
        {failed ? (
          <div className="mt-6 space-y-3 rounded-control bg-danger-bg p-4">
            <p role="alert" className="text-body-sm text-danger">
              {failed}
            </p>
            <div className="flex gap-2">
              <Button type="button" onClick={onRetry}>
                重试
              </Button>
              <Button type="button" variant="ghost" onClick={onEdit}>
                修改信息
              </Button>
            </div>
          </div>
        ) : (
          /* 分析中:进度条 + 已完成的阶段文案,当前阶段高亮 */
          <div className="mt-6">
            <div
              className="h-1 w-full overflow-hidden rounded-pill bg-sunken"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="分析进度"
            >
              <div
                className="h-full rounded-pill bg-green-600 transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <ul className="mt-4 space-y-2" aria-live="polite">
              {progress.length === 0 ? (
                <li className="flex items-center gap-2 text-body-sm text-ink-muted">{currentMessage}</li>
              ) : (
                progress.map((p, i) => {
                  const last = i === progress.length - 1;
                  return (
                    <li
                      key={`${p.stage}-${i}`}
                      className={cn(
                        "flex items-center gap-2 text-body-sm",
                        last ? "text-ink" : "text-ink-faint"
                      )}
                    >
                      {last ? (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-green-600" aria-hidden />
                      ) : (
                        <span className="shrink-0 text-green-600" aria-hidden>
                          ✓
                        </span>
                      )}
                      {p.message}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
