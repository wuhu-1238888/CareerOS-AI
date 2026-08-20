"use client";
// 纠偏弹窗(2.6):用户指出分析不准确的部分(方向/能力/优势)+ 补充说明;提交后关闭弹窗、
// Toast「已记录,AI 将重新分析」(由调用方负责)、全量重算产生新版本(implementation-plan 2.6 优先于 DesignRules)
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { CorrectionFeedback } from "@/lib/profile/pipeline";

const AREAS: { value: CorrectionFeedback["areas"][number]; label: string }[] = [
  { value: "direction", label: "推荐方向不准确" },
  { value: "ability", label: "能力评估不准确" },
  { value: "strength", label: "优势判断不准确" },
];

export function CorrectionDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 提交纠偏反馈;调用方负责 Toast 与发起全量重算,resolve 后弹窗关闭 */
  onSubmit: (feedback: CorrectionFeedback) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setSelected([]);
    setNote("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }

  function toggle(value: string, checked: boolean) {
    setSelected((prev) => (checked ? [...prev, value] : prev.filter((v) => v !== value)));
    setError(null);
  }

  function handleSubmit() {
    if (selected.length === 0) {
      setError("请选择不准确的部分");
      return;
    }
    setError(null);
    setSubmitting(true);
    void onSubmit({
      areas: selected as CorrectionFeedback["areas"],
      note: note.trim() || undefined,
    })
      .then(() => handleOpenChange(false))
      .catch((err) =>
        setError(err instanceof Error ? err.message : "提交失败,请稍后重试")
      )
      .finally(() => setSubmitting(false));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>哪些部分不准确?</DialogTitle>
          <DialogDescription>
            选择你认为分析不准确的部分,AI 将结合补充说明重新分析,并生成新版本(旧版本仍可查看)。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {AREAS.map((area) => (
            <div key={area.value} className="flex items-center gap-2.5">
              <Checkbox
                id={`correction-${area.value}`}
                checked={selected.includes(area.value)}
                onCheckedChange={(checked) => toggle(area.value, checked === true)}
              />
              <Label htmlFor={`correction-${area.value}`} className="cursor-pointer">
                {area.label}
              </Label>
            </div>
          ))}
          <div>
            <Label htmlFor="correction-note" className="text-body-sm text-ink-secondary">
              补充说明(选填,最多 500 字)
            </Label>
            <Textarea
              id="correction-note"
              className="mt-1.5"
              placeholder="例如:我更想做产品方向,而不是数据分析"
              maxLength={500}
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
            提交反馈
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
