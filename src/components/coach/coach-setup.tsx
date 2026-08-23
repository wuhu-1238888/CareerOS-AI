"use client";
// 技能分析表单(6.4):目标岗位(预填匹配报告的岗位名)+ 每周投入(预填路线图周时,否则 10)+ 学习偏好(可选)。
// 差距清单与能力基线由服务端从匹配报告/画像自动带出,客户端仅确认三个设定。
// 提交成功由 Hub 切到教练分析视图;失败时 Hub 进入失败视图,重新编辑时预填上次输入(initialValues)。
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type CoachSetupValues = {
  targetPosition: string;
  weeklyHours: number;
  learningPreference: string;
};

export function CoachSetup({
  initialValues,
  onSubmit,
}: {
  /** 重新编辑时预填的设定(上次会话输入或落库数据) */
  initialValues?: Partial<CoachSetupValues>;
  onSubmit: (values: CoachSetupValues) => Promise<void>;
}) {
  const [targetPosition, setTargetPosition] = useState(initialValues?.targetPosition ?? "");
  const [weeklyHoursText, setWeeklyHoursText] = useState(
    initialValues?.weeklyHours != null ? String(initialValues.weeklyHours) : ""
  );
  const [learningPreference, setLearningPreference] = useState(
    initialValues?.learningPreference ?? ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const position = targetPosition.trim();
    if (!position) {
      setError("请填写目标岗位");
      return;
    }
    const weeklyHours = Number(weeklyHoursText);
    if (!Number.isInteger(weeklyHours) || weeklyHours < 1 || weeklyHours > 80) {
      setError("每周投入须为 1-80 的整数");
      return;
    }
    setError(null);
    setSubmitting(true);
    void onSubmit({
      targetPosition: position,
      weeklyHours,
      learningPreference: learningPreference.trim(),
    })
      .catch((err) => setError(err instanceof Error ? err.message : "提交失败,请稍后重试"))
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-6">
      <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <h2 className="text-h2 text-ink">生成 90 天提升计划</h2>
        <p className="mt-1 text-body-sm text-ink-muted">
          岗位要求差距清单与你的能力标签将自动带入,只需确认以下设定。
        </p>
        <div className="mt-5 space-y-4">
          <div>
            <Label htmlFor="coach-position" className="text-body-sm text-ink-secondary">
              目标岗位
            </Label>
            <Input
              id="coach-position"
              className="mt-1.5"
              placeholder="例如:后端开发工程师"
              maxLength={50}
              value={targetPosition}
              onChange={(e) => setTargetPosition(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="coach-hours" className="text-body-sm text-ink-secondary">
              每周可投入学习时间(小时)
            </Label>
            <Input
              id="coach-hours"
              type="number"
              inputMode="numeric"
              min={1}
              max={80}
              className="mt-1.5"
              placeholder="例如:10"
              value={weeklyHoursText}
              onChange={(e) => setWeeklyHoursText(e.target.value)}
            />
            <p className="mt-1 text-caption text-ink-faint">1-80 小时,计划任务总时长不会超过该预算</p>
          </div>
          <div>
            <Label htmlFor="coach-preference" className="text-body-sm text-ink-secondary">
              学习偏好(可选)
            </Label>
            <Textarea
              id="coach-preference"
              className="mt-1.5 min-h-[80px]"
              placeholder="例如:偏好视频课程与动手项目"
              maxLength={200}
              value={learningPreference}
              onChange={(e) => setLearningPreference(e.target.value)}
            />
            <p className="mt-1 text-right text-caption text-ink-faint">
              {learningPreference.length}/200
            </p>
          </div>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-body-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end">
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
            生成 90 天提升计划
          </Button>
        </div>
      </div>
    </div>
  );
}
