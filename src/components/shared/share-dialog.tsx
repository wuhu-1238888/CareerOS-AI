"use client";
// 分享对话框(6.8):客户端截图导出 PNG。html-to-image 依赖 DOM/SSR 不安全 → 打开时动态 import
// (镜像 resume-export 模式);toPng(ref, { pixelRatio: 2 }) → dataURL → 临时 <a download> 触发下载;
// 截图失败 toast 可重试;import 失败时下载按钮禁用。卡片数据由调用方以 children 传入(已鉴权查询现成数据,无公开 URL)。
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ShareDialog({
  open,
  onOpenChange,
  children,
  fileName = "careeros-分享卡片.png",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 分享卡片内容(由调用方以 props 组装数据) */
  children: React.ReactNode;
  fileName?: string;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [toPngFn, setToPngFn] = useState<
    ((node: HTMLElement, options?: { pixelRatio?: number }) => Promise<string>) | null
  >(null);
  const [exporting, setExporting] = useState(false);
  const loadedRef = useRef(false);

  // 首次打开时动态加载 html-to-image;加载失败 → 下载按钮保持禁用态(仅一次尝试,避免重复报错)
  useEffect(() => {
    if (loadedRef.current || !open) return;
    loadedRef.current = true;
    void import("html-to-image")
      .then((mod) => setToPngFn(() => mod.toPng))
      .catch(() => undefined);
  }, [open]);

  async function handleDownload() {
    if (!toPngFn || !cardRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPngFn(cardRef.current, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = fileName;
      link.click();
      toast.success("图片已生成并开始下载");
    } catch {
      toast.error("生成图片失败,请重试");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>分享图片</DialogTitle>
          <DialogDescription>下载图片后分享到微信、朋友圈或其他渠道</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto p-1">
          <div ref={cardRef}>{children}</div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button
            type="button"
            disabled={!toPngFn || exporting}
            onClick={() => void handleDownload()}
          >
            {exporting ? "生成中…" : toPngFn ? "下载 PNG" : "图片组件加载失败"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
