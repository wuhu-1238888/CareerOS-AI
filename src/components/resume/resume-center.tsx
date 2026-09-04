"use client";
// 简历中心(4.13,自设置页「简历文件管理」迁移):顶级导航一级页面 —— 全部简历的查看/切换/下载/删除 + 页面级新增。
// 「继续优化」与「查看」都经 /resume?resumeId= 切换活跃简历(活跃简历 = URL 参数,4.12);下载走 /api/resume/download;
// 删除确认弹窗 + toast + 刷新(级联清理存储文件由服务端 resume.delete 完成)。
// 多份简历并存:每份独立,卡片只有 继续优化/查看/下载/删除,不存在「更换简历」。
// 4.15:左上角「← 返回」—— 顶栏/结果页「查看全部简历」进入后可明确返回(应用内回上一页,直接打开回工作台)。
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Eye, FileText, Plus, Sparkles, Trash2 } from "lucide-react";
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
import { goBackOrFallback } from "@/lib/client-back";

function formatBytes(size: number | null | undefined): string {
  if (size == null) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

export function ResumeCenter() {
  const utils = trpc.useUtils();
  const list = trpc.resume.list.useQuery();
  const remove = trpc.resume.delete.useMutation();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const router = useRouter();

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await remove.mutateAsync({ id: pendingDelete.id });
      toast.success("简历已删除");
      await utils.resume.list.invalidate();
      setPendingDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败,请稍后重试");
    }
  }

  // 4.15:应用内导航(顶栏/「查看全部简历」)→ 回上一页;直接打开(外链/新标签)→ 回工作台
  function handleBack() {
    goBackOrFallback(router, "/dashboard");
  }

  return (
    <>
      {/* 4.15:左上角「← 返回」(与上传视图同款)—— 补齐简历中心自身的退出路径 */}
      <Button type="button" variant="ghost" size="sm" onClick={handleBack} className="mb-2">
        <ArrowLeft aria-hidden />
        返回
      </Button>
      <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-body-lg font-medium text-ink">我的简历</h2>
          <p className="mt-1 text-body-sm text-ink-muted">查看、切换继续优化或删除你的全部简历</p>
        </div>
        {/* 「+ 新增简历」:与结果页「上传新简历」同一 CREATE 流程(每次上传建新行,不覆盖已有简历);
            4.14:from=resumes 供上传视图退出时返回简历中心 */}
        <Button asChild size="sm">
          <Link href="/resume?upload=1&from=resumes">
            <Plus aria-hidden />
            新增简历
          </Link>
        </Button>
      </div>

      {list.isLoading && (
        <div className="mt-4 space-y-2" aria-label="加载中">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}

      {list.isSuccess && list.data.length === 0 && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-card border border-dashed border-hairline-strong bg-sunken px-6 py-10 text-center">
          <FileText className="size-8 text-ink-faint" aria-hidden />
          <p className="text-body-sm font-medium text-ink-secondary">暂无简历</p>
          <p className="text-caption text-ink-muted">点击右上角「新增简历」上传或粘贴第一份简历</p>
        </div>
      )}

      {list.isSuccess && list.data.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline rounded-control border border-hairline">
          {list.data.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              {/* 4.16:信息区 flex-1 占满剩余宽度(文件名 truncate 不撑破布局),操作按钮组靠右 */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <FileText className="size-5 shrink-0 text-ink-muted" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-body-sm font-medium text-ink">
                    {item.fileName ?? "粘贴的简历文本"}
                  </p>
                  <p className="text-caption text-ink-muted">
                    {item.fileName ? `${formatBytes(item.sizeBytes)} · ` : ""}
                    {new Date(item.createdAt).toLocaleDateString("zh-CN")}
                    {item.extractError ? " · 待补全:粘贴简历文本" : ""}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {/* 「继续优化」/「查看」(4.13):都切换活跃简历(?resumeId=)进入该简历的解析/优化数据;
                    继续优化为主操作,查看为次级强调,同一目标链接 */}
                <Button asChild size="sm">
                  <Link href={`/resume?resumeId=${item.id}`}>
                    <Sparkles aria-hidden />
                    继续优化
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="sm">
                  <Link href={`/resume?resumeId=${item.id}`}>
                    <Eye aria-hidden />
                    查看
                  </Link>
                </Button>
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
            <DialogTitle>删除简历?</DialogTitle>
            <DialogDescription>
              「{pendingDelete?.name}」及其解析与优化记录将被永久删除,此操作不可撤销。
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
    </>
  );
}
