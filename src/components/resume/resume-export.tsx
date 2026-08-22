"use client";
// 简历导出工具条(4.7;4.10-layout 修订;4.16 修订):「导出 PDF」= 打开应用内 PDF 预览浮层。
// 不再用 PDFDownloadLink —— 其外层 <a href download> 与项目内层 <a href={url}> 嵌套锚点使浏览器
// 跟随内层锚点(无 download)整页跳转 blob: URL(浏览器 PDF 查看器、应用 UI 消失、无返回入口),
// Back 返回后还叠加 动态 import 待定/加载中死链/渲染失败 url=null/bfcache 陈旧 四重失效窗口。
// @react-pdf/renderer 与 PDF 文档组件仍仅经 useEffect 动态 import(react-pdf 引 window/canvas,
// SSR 路径 import 即崩);BlobProvider 每次打开浮层重新挂载 = 全新生成,关闭卸载即 revoke 旧
// blob URL(react-pdf usePDF 内置 revoke-on-unmount),重复导出零陈旧状态、零页面导航。
// 零采纳修改时禁用并提示「尚未采纳任何修改」(拒绝=恢复原文,此时导出无意义;4.7 语义)。
import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResumePdfPreview } from "./resume-pdf-preview";

type PdfRendererModule = typeof import("@react-pdf/renderer");
type PdfDocModule = typeof import("./resume-pdf-document");

export function ResumeExport({
  finalText,
  canExport,
}: {
  /** 最终采纳文本(与预览/复制同源的 canonical finalText;导出 PDF 使用) */
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
  // 4.16:预览浮层开合(纯本地状态;关闭即卸载 BlobProvider → revoke 旧 blob URL)
  const [previewOpen, setPreviewOpen] = useState(false);

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

  const disabled = !canExport || !finalText;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {disabled || loadFailed || !modules ? (
        // 禁用态/加载失败态:普通禁用按钮(占位,保证工具条布局稳定)
        <Button type="button" variant="secondary" disabled title="尚未采纳任何修改">
          <FileDown aria-hidden />
          导出 PDF
        </Button>
      ) : (
        // 4.16:真按钮(主视图零锚点,不再有跳转/死链);打开浮层即挂载 BlobProvider 全新生成
        <Button type="button" variant="secondary" onClick={() => setPreviewOpen(true)}>
          <FileDown aria-hidden />
          导出 PDF
        </Button>
      )}

      {disabled && <span className="text-caption text-ink-muted">尚未采纳任何修改</span>}

      {/* 4.16:BlobProvider 随浮层开合挂载/卸载。children 为函数子节点 —— BlobProvider 的
          d.ts 原生接受函数子节点(BlobProviderParams),无需 PDFDownloadLink 的 ReactNode 桥接。
          注意:document 元素每次 render 新建,浮层打开期间父级 re-render 会触发一次无谓的
          重新生成(幂等、文本相同、浮层覆盖下用户不可见),属可接受开销,不加守卫。 */}
      {previewOpen && modules && (
        <modules.renderer.BlobProvider
          document={<modules.doc.ResumePdfDocument text={finalText ?? ""} />}
        >
          {(state) => (
            <ResumePdfPreview state={state} onClose={() => setPreviewOpen(false)} />
          )}
        </modules.renderer.BlobProvider>
      )}
    </div>
  );
}
