"use client";
// 简历优化结果视图(4.5):全宽布局(画像结果页先例)。顶部 Hero 行(AI 标识 + 目标方向 + 采纳计数)
// + 工具条(全部接受 / 导出 PDF / 重新分析 / 修改信息)。
// 信息层级(4.10-layout 修订):优化结果对比卡(改前/改后/原因)→ 最终文本预览(卡内复制按钮)→ ATS 评分卡 ——
// 最终文本是流程产出、ATS 是对产出的质量检测,故预览在 ATS 之前;
// 预览直接渲染服务端 canonical finalText,与复制按钮、导出 PDF 同源同一字符串,无二次组装。
// 状态持久化走 resume.updateOptimization / resume.acceptAll;成功后失效 resume.get 以刷新采纳计数与最终文本。
import { useState } from "react";
import { ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { AiBadge } from "@/components/shared/ai-badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import { ResumeAnalysisCard, type AnalysisCardOptimization } from "./resume-analysis-card";
import { ResumeAtsCard } from "./resume-ats-card";
import { ResumeExport } from "./resume-export";

export type ResultVersion = {
  id: string;
  targetDirection: string | null;
  /** 变更摘要(Json,读取方防御解析;tRPC 客户端推断为可选) */
  changes?: unknown;
  atsScore: number | null;
  /** ATS 详细报告(Json,4.6 接入;tRPC 客户端推断为可选) */
  atsReport?: unknown;
  atsScoredAt: string | null;
  /** 最终采纳文本(4.7 服务端合成,复制/导出共用) */
  finalText: string | null;
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
  // 复制与导出同规则:零采纳或空文本禁用(与预览面板同源)
  const copyDisabled = !version.finalText || acceptedCount === 0;

  // ATS stale:评分后有建议状态变更(接受/拒绝/撤销)→ 提示重新评分(atsScoredAt 持久化列,刷新后仍准确)
  const atsStale =
    !!version.atsScoredAt &&
    version.optimizations.some(
      (o) => new Date(o.updatedAt).getTime() > new Date(version.atsScoredAt!).getTime()
    );

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

  // 复制 canonical finalText:与预览面板同源(同一 version.finalText 字符串,无二次组装)
  async function handleCopyFinalText() {
    if (!version.finalText) return;
    try {
      await navigator.clipboard.writeText(version.finalText);
      toast.success("已复制最终文本");
    } catch {
      // 回退:非安全上下文/旧浏览器用 execCommand
      const textarea = document.createElement("textarea");
      textarea.value = version.finalText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) toast.success("已复制最终文本");
      else toast.error("复制失败,请手动选择文本复制");
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
          <ResumeExport finalText={version.finalText} canExport={acceptedCount > 0} />
          <Button type="button" variant="ghost" disabled={update.isPending} onClick={onReanalyze}>
            重新分析
          </Button>
          <Button type="button" variant="ghost" onClick={onEdit}>
            修改信息
          </Button>
        </div>
      </div>

      {/* 对比卡列表:逐条接受/拒绝/撤销(AI 分析:改前/改后/原因,置于最终文本预览之前) */}
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

      {/* 最终文本预览(4.10;4.10-layout 修订:置于优化结果之后、ATS 之前):
          直接渲染服务端 canonical finalText;卡内复制按钮与顶部导出 PDF 均使用此处同一字符串,无二次组装 */}
      <section className="space-y-3 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-h3 text-ink">最终文本预览</h3>
            <p className="mt-0.5 text-caption text-ink-muted">
              最终准备投递的简历全文,与复制按钮、导出 PDF 完全一致,按你原始简历的模块顺序输出
            </p>
          </div>
          <div className="flex items-center gap-2">
            {copyDisabled && (
              <span className="text-caption text-ink-muted">尚未采纳任何修改</span>
            )}
            <Button
              type="button"
              variant="secondary"
              disabled={copyDisabled}
              onClick={() => void handleCopyFinalText()}
            >
              <ClipboardCopy aria-hidden />
              复制最终文本
            </Button>
          </div>
        </div>
        {version.finalText ? (
          <pre
            aria-label="最终文本预览"
            className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-control border border-hairline bg-sunken/50 p-4 text-body-sm text-ink"
          >
            {version.finalText}
          </pre>
        ) : (
          <p className="rounded-control border border-hairline bg-sunken/50 p-4 text-body-sm text-ink-muted">
            采纳建议后,此处将显示最终简历全文
          </p>
        )}
      </section>

      {/* ATS 评分卡(4.6;4.10-layout:位于最终文本预览之后,评分对象 = 上方的 canonical finalText) */}
      <ResumeAtsCard
        versionId={version.id}
        atsScore={version.atsScore}
        atsReport={version.atsReport ?? null}
        stale={atsStale}
      />
    </div>
  );
}
