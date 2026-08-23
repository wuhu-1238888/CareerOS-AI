"use client";
// 差距纠偏弹窗(6.2)「这个要求我其实满足」:展示只读要求文本 + 用户说明(≤200 字);
// 提交后由调用方 Toast 并以落库 JD 原文重新匹配;resolve 后弹窗关闭(镜像 correction-dialog 结构,更简)。
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export function GapCorrectionDialog({
  open,
  onOpenChange,
  requirementText,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 用户纠偏的岗位要求文本(只读) */
  requirementText: string;
  /** 提交说明;调用方负责 Toast 与重新匹配,resolve 后弹窗关闭 */
  onSubmit: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setNote("");
      setError(null);
    }
  }

  function handleSubmit() {
    if (!note.trim()) {
      setError("请说明你满足该要求的情况");
      return;
    }
    setError(null);
    setSubmitting(true);
    void onSubmit(note.trim())
      .then(() => handleOpenChange(false))
      .catch((err) => setError(err instanceof Error ? err.message : "提交失败,请稍后重试"))
      .finally(() => setSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>这个要求我其实满足</DialogTitle>
          <DialogDescription>告诉 AI 你的实际情况,将重新评估该项对比。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-control bg-sunken p-3 text-body-sm text-ink-secondary">
            {requirementText}
          </div>
          <div>
            <Label htmlFor="gap-note" className="text-body-sm text-ink-secondary">
              你的说明(最多 200 字)
            </Label>
            <Textarea
              id="gap-note"
              className="mt-1.5"
              placeholder="例如:我在课程项目中完整用过 Redis 缓存"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            提交并重新匹配
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
