"use client";
// 岗位匹配表单(6.2):粘贴 JD(≤8000 字,实时字数提示)+ 主行动「开始匹配」。
// 提交成功离开表单;失败由 Hub 进入分析失败视图,重新编辑时预填上次 JD(initialJdText)。
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MatchForm({
  initialJdText = "",
  onSubmit,
}: {
  /** 重新编辑/重新匹配时预填的 JD 原文(会话内提交数据或落库 jdText) */
  initialJdText?: string;
  onSubmit: (jdText: string) => Promise<void>;
}) {
  const [jdText, setJdText] = useState(initialJdText);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const trimmed = jdText.trim();
    if (trimmed.length < 10) {
      setError("请粘贴完整的岗位描述(至少 10 字)");
      return;
    }
    setError(null);
    setSubmitting(true);
    void onSubmit(trimmed)
      .catch((err) => setError(err instanceof Error ? err.message : "提交失败,请稍后重试"))
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-6">
      <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <h2 className="text-h2 text-ink">粘贴岗位描述</h2>
        <p className="mt-1 text-body-sm text-ink-muted">
          粘贴目标岗位的招聘描述(JD),AI 将拆解岗位要求,并结合你的画像与简历评估匹配度。
        </p>
        <div className="mt-4">
          <Label htmlFor="match-jd" className="text-body-sm text-ink-secondary">
            岗位描述(JD)
          </Label>
          <Textarea
            id="match-jd"
            className="mt-1.5 min-h-[220px]"
            placeholder="粘贴 JD 原文,例如:岗位职责、任职要求……"
            maxLength={8000}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
          <p className="mt-1 text-right text-caption text-ink-faint">{jdText.length}/8000</p>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-body-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            开始匹配
          </Button>
        </div>
      </div>
    </div>
  );
}
