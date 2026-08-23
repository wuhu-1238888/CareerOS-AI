"use client";
// 简历优化结果视图(4.5):全宽布局(画像结果页先例)。顶部 Hero 行(AI 标识 + 目标方向 + 采纳计数)
// + 工具条(全部接受 / 导出 PDF / 重新分析 / 修改信息)。
// 信息层级(4.10-layout 修订):优化结果对比卡(改前/改后/原因)→ 最终文本预览(卡内复制按钮)→ ATS 评分卡 ——
// 最终文本是流程产出、ATS 是对产出的质量检测,故预览在 ATS 之前;
// 预览直接渲染服务端 canonical finalText,与复制按钮、导出 PDF 同源同一字符串,无二次组装。
// 4.13:工具条「上传新简历」(原「重新上传简历」,进入上传视图新建简历行,当前简历与优化结果保留)
// + 「查看全部简历」→ 顶级导航「简历中心」(/resumes);Hero 左区显示当前简历名(resumeName)。
// 状态持久化走 resume.updateOptimization / resume.acceptAll;成功后失效 resume.get 以刷新采纳计数与最终文本。
// 6.6 版本选择器:镜像 profile-result 自持模式(listVersions + viewingId + getVersion),查看旧版本时
// accept/reject/导出/ATS 全部既有逻辑作用于当前 row 零改动;「复制为新版本」深拷贝(ATS 置空)、
// 「删除版本」仅剩一个时禁用(确认 Dialog,级联删建议,简历原文不动)。
import { useState } from "react";
import Link from "next/link";
import { ClipboardCopy, CopyPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AiBadge } from "@/components/shared/ai-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  resumeId,
  resumeName,
  onReanalyze,
  onEdit,
  onReupload,
}: {
  version: ResultVersion;
  /** 当前简历行 id(6.6 新增):版本列表/复制/删除按行隔离 */
  resumeId: string;
  /** 当前简历名(4.13,hub 传入 fileName,粘贴行回退「粘贴的简历文本」):Hero 左区显示 */
  resumeName?: string;
  /** 「重新分析」:用已保存的核对结果 + 当前目标方向再跑改写,生成新版本 */
  onReanalyze: () => void;
  /** 「修改信息」:返回核对表单修正解析结果 */
  onEdit: () => void;
  /** 「上传新简历」(4.11/4.13):进入上传视图新建一份简历 —— 新建简历行,当前简历与优化结果保留 */
  onReupload: () => void;
}) {
  const utils = trpc.useUtils();
  const update = trpc.resume.updateOptimization.useMutation();
  const acceptAll = trpc.resume.acceptAll.useMutation();
  // 简历导出埋点(5.3):复制/下载成功后记 FunnelEvent(resume-export);fire-and-forget,失败不阻断导出
  const logExport = trpc.resume.logExport.useMutation();
  // 单条状态变更在途的建议 id(禁该卡按钮;整版「全部接受」用 acceptAll.isPending)
  const [pendingId, setPendingId] = useState<string | null>(null);

  // —— 版本选择器(6.6):镜像 profile-result 自持模式(listVersions + viewingId + getVersion)。
  // row = 当前生效版本(默认最新;viewingId 指定时按指定版本渲染,accept/reject/导出/ATS 全部既有逻辑零改动作用于 row)
  const versions = trpc.resume.listVersions.useQuery({ resumeId });
  const [viewingId, setViewingId] = useState<string | null>(null);
  const versionQuery = trpc.resume.getVersion.useQuery(
    { versionId: viewingId ?? "" },
    { enabled: viewingId !== null }
  );
  // 复制为新版本 / 删除版本(6.6):仅剩一个版本时禁止删除(服务端同样校验)
  const duplicate = trpc.resume.duplicateVersion.useMutation();
  const remove = trpc.resume.deleteVersion.useMutation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const row: ResultVersion = viewingId && versionQuery.data ? versionQuery.data : version;
  const versionList = versions.data ?? [];
  const showVersionSelector = versionList.length > 1;
  const deleteDisabled = versionList.length <= 1;
  // 「第 N 版」编号:列表时间降序,最新 = 第 N 版(N = 总数)
  const versionNo = (id: string) =>
    versionList.length - versionList.findIndex((v) => v.id === id);

  const total = row.optimizations.length;
  const acceptedCount = row.optimizations.filter((o) => o.status === "accepted").length;
  // 复制与导出同规则:零采纳或空文本禁用(与预览面板同源)
  const copyDisabled = !row.finalText || acceptedCount === 0;

  // ATS stale:评分后有建议状态变更(接受/拒绝/撤销)→ 提示重新评分(atsScoredAt 持久化列,刷新后仍准确)
  const atsStale =
    !!row.atsScoredAt &&
    row.optimizations.some(
      (o) => new Date(o.updatedAt).getTime() > new Date(row.atsScoredAt!).getTime()
    );

  async function handleDuplicate() {
    try {
      await duplicate.mutateAsync({ versionId: row.id });
      toast.success("已复制为新版本");
      // 新版本成为最新版:回到默认视图(显示新版本)并刷新版本列表与当前简历
      setViewingId(null);
      void utils.resume.get.invalidate();
      void utils.resume.listVersions.invalidate();
      void utils.resume.getVersion.invalidate();
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  async function handleDelete() {
    try {
      await remove.mutateAsync({ versionId: row.id });
      toast.success("版本已删除");
      setViewingId(null);
      void utils.resume.get.invalidate();
      void utils.resume.listVersions.invalidate();
      void utils.resume.getVersion.invalidate();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setConfirmOpen(false);
    }
  }

  async function handleStatusChange(id: string, status: "pending" | "accepted" | "rejected") {
    setPendingId(id);
    try {
      await update.mutateAsync({ optimizationId: id, status });
      void utils.resume.get.invalidate();
      // 6.6:查看旧版本时同样刷新 getVersion(采纳计数与最终文本随行更新)
      void utils.resume.getVersion.invalidate();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setPendingId(null);
    }
  }

  async function handleAcceptAll() {
    try {
      await acceptAll.mutateAsync({ versionId: row.id });
      void utils.resume.get.invalidate();
      void utils.resume.getVersion.invalidate();
      toast.success("已全部采纳,最终文本已更新");
    } catch (err) {
      toast.error(friendlyError(err));
    }
  }

  // 复制 canonical finalText:与预览面板同源(同一 row.finalText 字符串,无二次组装)
  async function handleCopyFinalText() {
    if (!row.finalText) return;
    try {
      await navigator.clipboard.writeText(row.finalText);
      toast.success("已复制最终文本");
      logExport.mutate();
    } catch {
      // 回退:非安全上下文/旧浏览器用 execCommand
      const textarea = document.createElement("textarea");
      textarea.value = row.finalText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(textarea);
      if (ok) {
        toast.success("已复制最终文本");
        logExport.mutate();
      } else {
        toast.error("复制失败,请手动选择文本复制");
      }
    }
  }

  return (
    <div className="w-full space-y-6 py-6">
      {/* Hero 行:左 = AI 标识 + 目标方向与时间;右 = 版本选择器/复制/删除 + 采纳计数 + 工具条 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AiBadge />
          {resumeName && <span className="text-caption text-ink-muted">当前简历:{resumeName}</span>}
          <span className="text-caption text-ink-muted">
            {row.targetDirection ? `目标方向:${row.targetDirection} · ` : ""}
            更新于 {formatDate(row.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showVersionSelector ? (
            <Select
              value={row.id}
              onValueChange={(id) => setViewingId(id === version.id ? null : id)}
            >
              <SelectTrigger
                className="w-auto min-w-[160px]"
                aria-label="查看历史版本"
              >
                <SelectValue placeholder="版本" />
              </SelectTrigger>
              <SelectContent>
                {versionList.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {`第 ${versionNo(v.id)} 版 · ${formatDate(v.createdAt)}${
                      v.targetDirection ? ` · ${v.targetDirection}` : ""
                    }`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={duplicate.isPending}
            onClick={() => void handleDuplicate()}
          >
            <CopyPlus aria-hidden />
            复制为新版本
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={deleteDisabled || remove.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 aria-hidden />
            删除版本
          </Button>
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
          <ResumeExport finalText={row.finalText} canExport={acceptedCount > 0} />
          <Button type="button" variant="ghost" disabled={update.isPending} onClick={onReanalyze}>
            重新分析
          </Button>
          <Button type="button" variant="ghost" onClick={onEdit}>
            修改信息
          </Button>
          <Button type="button" variant="ghost" onClick={onReupload}>
            上传新简历
          </Button>
          {/* 「查看全部简历」(4.13):顶级导航「简历中心」—— 查看/切换/新增/删除全部简历 */}
          <Button asChild variant="secondary">
            <Link href="/resumes">查看全部简历</Link>
          </Button>
        </div>
      </div>

      {/* 对比卡列表:逐条接受/拒绝/撤销(AI 分析:改前/改后/原因,置于最终文本预览之前) */}
      <ul className="space-y-4" aria-label="修改建议列表">
        {row.optimizations.map((optimization) => (
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
        {row.finalText ? (
          <pre
            aria-label="最终文本预览"
            className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-control border border-hairline bg-sunken/50 p-4 text-body-sm text-ink"
          >
            {row.finalText}
          </pre>
        ) : (
          <p className="rounded-control border border-hairline bg-sunken/50 p-4 text-body-sm text-ink-muted">
            采纳建议后,此处将显示最终简历全文
          </p>
        )}
      </section>

      {/* ATS 评分卡(4.6;4.10-layout:位于最终文本预览之后,评分对象 = 上方的 canonical finalText) */}
      <ResumeAtsCard
        versionId={row.id}
        atsScore={row.atsScore}
        atsReport={row.atsReport ?? null}
        stale={atsStale}
      />

      {/* 删除版本确认(6.6):级联删建议;简历原文与其他版本不受影响 */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>删除该版本?</DialogTitle>
            <DialogDescription>
              删除后不可恢复;简历原文与其他版本不受影响。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => void handleDelete()}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
