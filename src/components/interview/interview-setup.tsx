"use client";
// 模拟面试设定表单(7.2):面试类型(默认行为面)+ 场次档位(默认短 5 题)+ 目标岗位(预填匹配报告
// 岗位名,回退路线图目标方向)。提交成功由 Hub 切到分析视图;失败时 Hub 进入失败视图,重新编辑时
// 预填上次输入(initialValues)。原生 radio(fieldset/legend)保证键盘与读屏可操作,样式沿用既有 token。
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { InterviewQuestionCount, InterviewType } from "@/lib/interview/analysis-schemas";

export type InterviewSetupValues = {
  interviewType: InterviewType;
  questionCount: InterviewQuestionCount;
  targetPosition: string;
};

const TYPE_OPTIONS: { value: InterviewType; label: string; hint: string }[] = [
  { value: "行为面", label: "行为面", hint: "围绕经历、动机与软素质提问" },
  { value: "技术面", label: "技术面", hint: "围绕技术能力与项目细节提问" },
  { value: "案例面", label: "案例面", hint: "围绕业务问题分析与解决思路提问" },
];

const COUNT_OPTIONS: { value: InterviewQuestionCount; label: string; hint: string }[] = [
  { value: 5, label: "短 5 题", hint: "约 10 分钟,快速热身" },
  { value: 10, label: "标准 10 题", hint: "约 20 分钟,常规演练" },
  { value: 15, label: "完整 15 题", hint: "约 30 分钟,完整模拟" },
];

function OptionGroup<T extends string | number>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string;
  options: { value: T; label: string; hint: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-body-sm text-ink-secondary">{legend}</legend>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={String(option.value)}
              className={cn(
                "flex cursor-pointer flex-col gap-0.5 rounded-control border px-3 py-2.5 transition-colors",
                selected
                  ? "border-green-600 bg-green-50"
                  : "border-hairline hover:bg-sunken"
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={legend}
                  className="size-3.5 shrink-0 accent-green-600"
                  checked={selected}
                  onChange={() => onChange(option.value)}
                />
                <span
                  className={cn(
                    "text-body-sm font-medium",
                    selected ? "text-green-700" : "text-ink"
                  )}
                >
                  {option.label}
                </span>
              </span>
              <span className="pl-[22px] text-caption text-ink-faint">{option.hint}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function InterviewSetup({
  initialValues,
  onSubmit,
}: {
  /** 重新编辑时预填的设定(上次会话输入或当前场次数据) */
  initialValues?: Partial<InterviewSetupValues>;
  onSubmit: (values: InterviewSetupValues) => Promise<void>;
}) {
  const [interviewType, setInterviewType] = useState<InterviewType>(
    initialValues?.interviewType ?? "行为面"
  );
  const [questionCount, setQuestionCount] = useState<InterviewQuestionCount>(
    initialValues?.questionCount ?? 5
  );
  const [targetPosition, setTargetPosition] = useState(initialValues?.targetPosition ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const position = targetPosition.trim();
    if (!position) {
      setError("请填写目标岗位");
      return;
    }
    setError(null);
    setSubmitting(true);
    void onSubmit({ interviewType, questionCount, targetPosition: position })
      .catch((err) => setError(err instanceof Error ? err.message : "提交失败,请稍后重试"))
      .finally(() => setSubmitting(false));
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 py-6">
      <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <h2 className="text-h2 text-ink">设定面试场次</h2>
        <p className="mt-1 text-body-sm text-ink-muted">
          AI 面试官将结合你的简历快照与目标岗位出题,题目分为自我介绍、经历深挖、技术案例、
          情景假设与反问五类。
        </p>
        <div className="mt-5 space-y-5">
          <OptionGroup
            legend="面试类型"
            options={TYPE_OPTIONS}
            value={interviewType}
            onChange={setInterviewType}
          />
          <OptionGroup
            legend="场次档位"
            options={COUNT_OPTIONS}
            value={questionCount}
            onChange={setQuestionCount}
          />
          <div>
            <Label htmlFor="interview-position" className="text-body-sm text-ink-secondary">
              目标岗位
            </Label>
            <Input
              id="interview-position"
              className="mt-1.5"
              placeholder="例如:后端开发工程师"
              maxLength={100}
              value={targetPosition}
              onChange={(e) => setTargetPosition(e.target.value)}
            />
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
            开始面试
          </Button>
        </div>
      </div>
    </div>
  );
}
