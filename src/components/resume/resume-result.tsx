"use client";
// 简历优化结果视图(4.5):全宽布局(画像结果页先例)。顶部 Hero 行(AI 标识 + 目标方向 + 采纳计数)
// + 工具条(全部接受 secondary / 重新分析 ghost / 修改信息 ghost)+ 对比卡列表(ResumeAnalysisCard)。
// 状态持久化走 resume.updateOptimization / resume.acceptAll;成功后失效 resume.get 以刷新采纳计数与最终文本。
// 4.6 接 ATS 卡(atsReport/atsScoredAt),4.7 接复制与导出 PDF。
import { useState } from "react";
import { toast } from "sonner";
import { AiBadge } from "@/components/shared/ai-badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import { ResumeAnalysisCard, type AnalysisCardOptimization } from "./resume-analysis-card";

export type ResultVersion = {
  id: string;
  targetDirection: string | null;
  /** 变更摘要(Json,读取方防御解析;tRPC 客户端推断为可选) */
  changes?: unknown;
  atsScore: number | null;
  /** ATS 详细报告(Json,4.6 接入;tRPC 客户端推断为可选) */
  atsReport?: unknown;
  atsScoredAt: string | null;
  createdAt: string;
  optimizations: AnalysisCardOptimization[];
};

function friendlyError(err: unknown): string {
  return err instanceof Error ? err.message : "操作失败,请稍后重试";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

export function ResumeResult({
  version,
  onReanalyze,
  onEdit,
}: {
  version: ResultVersion;
  /** 「重新分析」:用已保存的核对结果 + 当前目标方向再跑改写,生成新版本 */
  onReanalyze: () => void;
  /** 「修改信息」:返回核对表单修正解析结果 */
  onEdit: () => void;
}) {
  const utils = trpc.useUtils();
  const update = trpc.resume.updateOptimization.useMutation();
  const acceptAll = trpc.resume.acceptAll.useMutation();
  // 单条状态变更在途的建议 id(禁该卡按钮;整版「全部接受」用 acceptAll.isPending)
  const [pendingId, setPendingId] = useState<string | null>(null);

  const total = version.optimizations.length;
  const acceptedCount = version.optimizations.filter((o) => o.status === "accepted").length;

  async function handleStatusChange(id: string, status: "pending" | "accepted" | "rejected") {
    setPendingId(id);
    try {
      await update.mutateAsync({ optimizationId: id, status });
      void utils.resume.get.invalidate();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setPendingId(null);
    }
  }

  async function handleAcceptAll() {
    try {
      await acceptAll.mutateAsync({ versionId: version.id });
      void utils.resume.get.invalidate();
      toast.success("已全部采纳,最终文本已更新");
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  return (
    <div className="w-full space-y-6 py-6">
      {/* Hero 行:左 = AI 标识 + 目标方向与时间;右 = 采纳计数 + 工具条 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AiBadge />
          <span className="text-caption text-ink-muted">
            {version.targetDirection ? `目标方向:${version.targetDirection} · ` : ""}
            更新于 {formatDate(version.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-sm text-ink-muted">
            已采纳 {acceptedCount}/{total}
          </span>
          <Button
            type="button"
            variant="secondary"
            disabled={acceptAll.isPending || acceptedCount === total}
            onClick={() => void handleAcceptAll()}
          >
            全部接受
          </Button>
          <Button type="button" variant="ghost" disabled={update.isPending} onClick={onReanalyze}>
            重新分析
          </Button>
          <Button type="button" variant="ghost" onClick={onEdit}>
            修改信息
          </Button>
        </div>
      </div>

      {/* 对比卡列表:逐条接受/拒绝/撤销 */}
      <ul className="space-y-4" aria-label="修改建议列表">
        {version.optimizations.map((optimization) => (
          <li key={optimization.id}>
            <ResumeAnalysisCard
              optimization={optimization}
              pending={pendingId === optimization.id}
              onStatusChange={(id, status) => void handleStatusChange(id, status)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
