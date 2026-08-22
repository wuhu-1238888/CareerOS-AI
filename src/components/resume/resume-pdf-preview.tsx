"use client";
// 简历 PDF 预览浮层(4.16):纯展示组件,渲染态由父级 BlobProvider 的 render-prop 提供
// (url/loading/error 三态)。固定全屏 z-50 覆盖顶栏(z-40),不产生任何导航 —— 浏览器
// Back 永远不参与浮层开合,「导出 PDF」可反复触发。主体用 iframe 预览 blob: URL
// (浏览器自带 PDF 查看器工具栏);iOS Safari 内联预览 blob: URL 可能空白 →「下载 PDF」兜底。
import { useEffect } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";

export function ResumePdfPreview({
  state,
  onClose,
}: {
  state: { url: string | null; loading: boolean; error: Error | null };
  onClose: () => void;
}) {
  // 简历导出埋点(5.3):下载 PDF 时记 FunnelEvent(resume-export);fire-and-forget,失败不阻断下载
  const logExport = trpc.resume.logExport.useMutation();

  // Escape 关闭
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // 浮层打开期间锁定背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="PDF 预览"
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft aria-hidden />
          返回
        </Button>
        <span className="text-body-sm font-medium text-ink">PDF 预览</span>
        {state.url ? (
          // 就绪:真下载锚点(download 属性,不导航离开应用);点击同步记导出埋点
          <Button asChild variant="default" size="sm">
            <a href={state.url} download="简历-优化版.pdf" onClick={() => logExport.mutate()}>
              <Download aria-hidden />
              下载 PDF
            </a>
          </Button>
        ) : (
          // 未就绪:占位禁用按钮保持头部布局稳定(避免 Radix Slot 把 disabled 传给 <a> 失效)
          <Button type="button" variant="default" size="sm" disabled>
            <Download aria-hidden />
            下载 PDF
          </Button>
        )}
      </header>

      {state.loading ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-ink-muted">
          <Loader2 className="animate-spin" aria-hidden />
          <span>正在生成 PDF…</span>
        </div>
      ) : state.error ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-card border border-hairline bg-surface p-6 shadow-card">
            <p className="text-body-sm text-ink">PDF 生成失败,请重试。</p>
            <p className="mt-1 text-caption text-ink-muted">
              {state.error instanceof Error ? state.error.message : "未知错误"}
            </p>
          </div>
        </div>
      ) : state.url ? (
        <iframe src={state.url} title="PDF 预览" className="w-full flex-1 border-0" />
      ) : null}
    </div>
  );
}
