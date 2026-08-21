"use client";
// 简历文件管理(4.1):真实文件列表 —— 下载(原文件,走 /api/resume/download)+ 删除(确认弹窗 + toast + 刷新)。
// 删除级联清理存储文件(服务端 resume.delete);下载链接由 Route Handler 自鉴权。
import { useState } from "react";
import { Download, FileText, Trash2 } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";

function formatBytes(size: number | null | undefined): string {
  if (size == null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ResumeFiles() {
  const utils = trpc.useUtils();
  const list = trpc.resume.list.useQuery();
  const remove = trpc.resume.delete.useMutation();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync({ id: pendingDelete.id });
      toast.success("简历文件已删除");
      await utils.resume.list.invalidate();
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败,请稍后重试");
    }
  }

  return (
    <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
      <h2 className="text-body-lg font-medium text-ink">简历文件管理</h2>
      <p className="mt-1 text-body-sm text-ink-muted">管理你上传的简历文件与解析记录</p>

      {list.isLoading && (
        <div className="mt-4 space-y-2" aria-label="加载中">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {list.isSuccess && list.data.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-card border border-dashed border-hairline-strong bg-sunken px-6 py-10 text-center">
          <FileText className="size-8 text-ink-faint" aria-hidden />
          <p className="text-body-sm font-medium text-ink-secondary">暂无简历文件</p>
          <p className="text-caption text-ink-muted">前往「简历优化」页上传简历后,可在这里管理文件</p>
        </div>
      )}

      {list.isSuccess && list.data.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline rounded-control border border-hairline">
          {list.data.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <FileText className="size-5 shrink-0 text-ink-muted" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-ink">
                    {item.fileName ?? "粘贴的简历文本"}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {item.fileName ? `${formatBytes(item.sizeBytes)} · ` : ""}
                    {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.fileName && (
                  <Button asChild variant="secondary" size="sm">
                    <a href={`/api/resume/download?id=${item.id}`} download>
                      <Download aria-hidden />
                      下载
                    </a>
                  </Button>
                )}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() =>
                    setPendingDelete({ id: item.id, name: item.fileName ?? "粘贴的简历文本" })
                  }
                >
                  <Trash2 aria-hidden />
                  删除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>删除简历文件?</DialogTitle>
            <DialogDescription>
              「{pendingDelete?.name}」及其解析记录将被永久删除,此操作不可撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={remove.isPending}>
              取消
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={remove.isPending}>
              {remove.isPending ? "删除中…" : "确认删除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
