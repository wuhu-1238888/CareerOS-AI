"use client";
// 简历修改对比卡(4.5,DesignSystem Resume Analysis Card):
// 修改前 = sunken 底 + 左 3px hairline-strong 边(灰色引用块);修改后 = green-50 底 + 左 3px green-600 边(绿边 = 建议采纳的视觉语言);
// 「为什么这样改」= 折叠 ai-insight 块(紫底紫边 + ai-badge);接受绿 ✓、拒绝灰原文态,操作可撤销;禁红色删除线;
// 用户采纳/拒绝后不再显示 AI 标记(DesignSystem L582:用户编辑过的内容不再展示 AI 标记)。
import { useState } from "react";
import { Check, ChevronDown, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/shared/ai-badge";
import { cn } from "@/lib/utils";

export type AnalysisCardOptimization = {
  id: string;
  category: string | null;
  originalText: string | null;
  optimizedText: string | null;
  reason: string | null;
  status: string;
  /** 状态最后变更时间(ISO 字符串,服务端落库);ATS stale 判定(改动晚于评分)在结果视图使用 */
  updatedAt: string;
};

export function ResumeAnalysisCard({
  optimization,
  pending,
  onStatusChange,
}: {
  optimization: AnalysisCardOptimization;
  /** 状态变更 mutation 在途(禁用操作按钮,防连点) */
  pending: boolean;
  onStatusChange: (id: string, status: "pending" | "accepted" | "rejected") => void;
}) {
  const [reasonOpen, setReasonOpen] = useState(false);
  const { status } = optimization;
  const adopted = status === "accepted";
  const rejected = status === "rejected";

  return (
    <article className="rounded-card border border-hairline bg-surface p-5 shadow-card">
      {/* 头部:类别 + AI 标记(仅待处理态)+ 状态徽章 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-eyebrow text-ink-muted">{optimization.category ?? "修改建议"}</span>
        {status === "pending" && <AiBadge>AI 建议</AiBadge>}
        <span
          className={cn(
            "ml-auto rounded-pill px-2 py-0.5 text-caption",
            adopted ? "bg-green-100 text-green-700" : "bg-sunken text-ink-muted"
          )}
        >
          {adopted ? "已采纳" : rejected ? "已拒绝" : "待处理"}
        </span>
      </div>

      {/* 修改前:灰色引用块 */}
      <div className="mt-3 rounded-r-control border-l-[3px] border-l-hairline-strong bg-sunken p-3">
        <p className="text-caption text-ink-faint">修改前</p>
        <p className="mt-1 whitespace-pre-wrap text-body-sm text-ink-secondary">
          {optimization.originalText}
        </p>
      </div>

      {/* 修改后:green-50 + 绿边;拒绝后回灰(恢复原文态,不渲染优化文本的强调样式) */}
      <div
        className={cn(
          "mt-3 rounded-r-control border-l-[3px] p-3",
          rejected ? "border-l-hairline-strong bg-sunken" : "border-l-green-600 bg-green-50"
        )}
      >
        <div className="flex items-center gap-1.5">
          <p className={cn("text-caption", rejected ? "text-ink-faint" : "text-green-700")}>
            修改后
          </p>
          {adopted && <Check className="size-3.5 text-green-600" aria-hidden />}
        </div>
        <p
          className={cn(
            "mt-1 whitespace-pre-wrap text-body-sm",
            rejected ? "text-ink-muted" : "text-ink"
          )}
        >
          {optimization.optimizedText}
        </p>
      </div>

      {/* 「为什么这样改」:折叠 ai-insight(紫底紫边 + ai-badge) */}
      {optimization.reason && (
        <div className="mt-3">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 text-left text-caption text-ink-muted hover:text-ink-secondary"
            aria-expanded={reasonOpen}
            onClick={() => setReasonOpen((v) => !v)}
          >
            为什么这样改
            <ChevronDown
              className={cn("size-3.5 shrink-0 transition-transform", reasonOpen && "rotate-180")}
              aria-hidden
            />
          </button>
          {reasonOpen && (
            <div className="mt-2 rounded-r-control border-l-[3px] border-l-violet-400 bg-violet-50 p-3">
              <AiBadge>AI 分析</AiBadge>
              <p className="mt-1.5 text-body-sm text-ink-secondary">{optimization.reason}</p>
            </div>
          )}
        </div>
      )}

      {/* 操作:接受/拒绝(待处理)→ 撤销(已采纳/已拒绝,回到待处理);禁红色删除线,拒绝不用危险色 */}
      <div className="mt-4 flex items-center justify-end gap-2">
        {status === "pending" ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => onStatusChange(optimization.id, "rejected")}
            >
              <X aria-hidden />
              拒绝
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => onStatusChange(optimization.id, "accepted")}
            >
              <Check aria-hidden />
              接受
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => onStatusChange(optimization.id, "pending")}
          >
            <RotateCcw aria-hidden />
            撤销
          </Button>
        )}
      </div>
    </article>
  );
}
