"use client";
// 简历导出工具条(4.7):一键复制最终文本(navigator.clipboard,失败回退 execCommand)+ 导出 PDF。
// @react-pdf/renderer 与 PDF 文档组件仅经 useEffect 动态 import(react-pdf 引 window/canvas,SSR 路径 import 即崩)。
// 零采纳修改时禁用并提示「尚未采纳任何修改」(拒绝=恢复原文,此时导出无意义;4.7「空简历导出禁用」语义)。
import { useEffect, useState, type ReactNode } from "react";
import { ClipboardCopy, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type PdfRendererModule = typeof import("@react-pdf/renderer");
type PdfDocModule = typeof import("./resume-pdf-document");

export function ResumeExport({
  finalText,
  canExport,
}: {
  /** 最终采纳文本(服务端由 accepted 片段合成;复制与 PDF 共用) */
  finalText: string | null;
  /** 至少采纳一条修改才可导出;否则禁用(导出与原文无差异) */
  canExport: boolean;
}) {
  // 动态加载状态:null = 加载中 / 加载失败;成功则持模块引用
  const [modules, setModules] = useState<{
    renderer: PdfRendererModule;
    doc: PdfDocModule;
  } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import("@react-pdf/renderer"), import("./resume-pdf-document")])
      .then(([renderer, doc]) => {
        if (!cancelled) setModules({ renderer, doc });
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCopy() {
    if (!finalText) return;
    try {
      await navigator.clipboard.writeText(finalText);
      toast.success("已复制最终文本");
    } catch {
      // 回退:非安全上下文/旧浏览器用 execCommand
      const textarea = document.createElement("textarea");
      textarea.value = finalText;
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

  const disabled = !canExport || !finalText;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => void handleCopy()}
      >
        <ClipboardCopy aria-hidden />
        复制最终文本
      </Button>

      {disabled || loadFailed || !modules ? (
        // 禁用态/加载失败态:普通禁用按钮(占位,保证工具条布局稳定)
        <Button type="button" variant="secondary" disabled title="尚未采纳任何修改">
          <FileDown aria-hidden />
          导出 PDF
        </Button>
      ) : (
        <modules.renderer.PDFDownloadLink
          document={<modules.doc.ResumePdfDocument text={finalText ?? ""} />}
          fileName="简历-优化版.pdf"
        >
          {/* react-pdf 3.4.5 的 children 类型(ReactNode | ReactElement<BlobProviderParams>)不接纳函数子节点,
              但其实现即函数子节点(BlobProviderParams 含 blob/url/loading/error)→ 按项目先例桥接 */}
          {((({ url, loading }: { url: string | null; loading: boolean }) => (
            <Button asChild variant="secondary">
              <a href={url ?? undefined}>
                {loading ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
                {loading ? "准备导出…" : "导出 PDF"}
              </a>
            </Button>
          )) as unknown as ReactNode)}
        </modules.renderer.PDFDownloadLink>
      )}

      {disabled && <span className="text-caption text-ink-muted">尚未采纳任何修改</span>}
    </div>
  );
}
