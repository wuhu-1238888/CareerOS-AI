"use client";
// 成长路线方向选择表单(3.2):目标方向(画像推荐卡 + 自定义输入)→ 每周可投入时间 → 当前阶段自评。
// 推荐方向数据源为画像推荐 careerPaths(hub 注入);无画像用户仅显示自定义输入。
// 提交回调由 hub 注入(3.4 接线生成管线);校验:方向必填 ≤30 字、周时 1–80 整数、阶段三选一。
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type SuggestedDirection = {
  directionName: string;
  matchScore: number;
  strengths: string[];
};

// 当前阶段自评三选一(与 Router/Agent 输入枚举一致)
const STAGE_OPTIONS = ["完全新手", "有一定基础", "接近入门"] as const;

export type DirectionFormInput = {
  direction: string;
  weeklyHours: number;
  currentStage: (typeof STAGE_OPTIONS)[number];
};

export function DirectionForm({
  suggestedDirections,
  onSubmit,
  initial,
}: {
  /** 画像推荐方向(hub 从 profile.get().careerPaths 注入);无画像 → null */
  suggestedDirections?: SuggestedDirection[] | null;
  onSubmit: (input: DirectionFormInput) => Promise<void>;
  /** 预填(3.4 重新生成):方向落入自定义输入,周时/阶段自评预选 */
  initial?: { direction: string; weeklyHours: number | null; currentStage: string | null } | null;
}) {
  // 方向 = 自定义输入优先,其次为选中的推荐卡
  const [custom, setCustom] = useState(initial?.direction ?? "");
  const [suggested, setSuggested] = useState<string | null>(null);
  const [weeklyHours, setWeeklyHours] = useState(
    initial?.weeklyHours != null ? String(initial.weeklyHours) : ""
  );
  const [currentStage, setCurrentStage] = useState<(typeof STAGE_OPTIONS)[number] | null>(
    initial?.currentStage && (STAGE_OPTIONS as readonly string[]).includes(initial.currentStage)
      ? (initial.currentStage as (typeof STAGE_OPTIONS)[number])
      : null
  );
  const [fieldErrors, setFieldErrors] = useState<{
    direction?: string;
    weeklyHours?: string;
    currentStage?: string;
  }>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const hasSuggested = !!suggestedDirections && suggestedDirections.length > 0;

  function pickSuggested(name: string) {
    setSuggested((prev) => (prev === name ? null : name));
    setCustom("");
    setFieldErrors((errs) => ({ ...errs, direction: undefined }));
  }

  function handleSubmit() {
    const direction = custom.trim() || (suggested ?? "");
    const errors: typeof fieldErrors = {};
    if (!direction) {
      errors.direction = "请选择或输入目标方向";
    } else if (direction.length > 30) {
      errors.direction = "目标方向最多 30 字";
    }
    const raw = weeklyHours.trim();
    const hours = Number(raw);
    if (!raw || !/^\d+$/.test(raw) || hours < 1 || hours > 80) {
      errors.weeklyHours = "请输入 1–80 之间的整数";
    }
    if (!currentStage) {
      errors.currentStage = "请选择当前阶段";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setServerError("");
    setSubmitting(true);
    onSubmit({ direction, weeklyHours: hours, currentStage: currentStage! })
      .catch(() => setServerError("提交失败,请稍后重试"))
      .finally(() => setSubmitting(false));
  }

  return (
    <>
      <div className="mx-auto w-full max-w-[640px] space-y-8 px-4 pb-28 pt-6">
        {/* 目标方向:画像推荐卡(2-4 张,含匹配度)+ 自定义输入始终可用 */}
        <div className="space-y-3">
          <Label>目标方向</Label>
          {hasSuggested ? (
            <>
              <p className="text-caption text-ink-faint">根据你的画像推荐,点击选择</p>
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="推荐方向">
                {suggestedDirections!.map((direction) => {
                  const selected = !custom.trim() && suggested === direction.directionName;
                  return (
                    <button
                      key={direction.directionName}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => pickSuggested(direction.directionName)}
                      className={cn(
                        "rounded-control border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        selected
                          ? "border-green-600 bg-green-100"
                          : "border-hairline-strong bg-white hover:border-ink-faint"
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-body-sm font-medium text-ink">
                          {selected ? "✓ " : ""}
                          {direction.directionName}
                        </span>
                        <span className="shrink-0">
                          <span className="text-num text-green-600">{direction.matchScore}</span>
                          <span className="ml-1 text-caption text-ink-muted">匹配度</span>
                        </span>
                      </span>
                      {direction.strengths.length > 0 ? (
                        <span className="mt-1 block truncate text-caption text-ink-muted">
                          {direction.strengths.join(" · ")}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="direction-input">自定义方向</Label>
            <Input
              id="direction-input"
              type="text"
              placeholder="如:后端开发工程师"
              value={custom}
              aria-invalid={!!fieldErrors.direction}
              className={cn(fieldErrors.direction && "border-danger")}
              onChange={(e) => {
                setCustom(e.target.value);
                setSuggested(null);
                setFieldErrors((errs) => ({ ...errs, direction: undefined }));
              }}
            />
          </div>
          {fieldErrors.direction ? (
            <p className="text-body-sm text-danger">{fieldErrors.direction}</p>
          ) : null}
        </div>

        {/* 每周可投入时间:必填,1–80 整数(阶段时长规划的依据) */}
        <div className="space-y-2">
          <Label htmlFor="weekly-hours">每周可投入时间</Label>
          <Input
            id="weekly-hours"
            type="number"
            min={1}
            max={80}
            placeholder="如:10"
            value={weeklyHours}
            aria-invalid={!!fieldErrors.weeklyHours}
            className={cn(fieldErrors.weeklyHours && "border-danger")}
            onChange={(e) => {
              setWeeklyHours(e.target.value);
              setFieldErrors((errs) => ({ ...errs, weeklyHours: undefined }));
            }}
          />
          <p className="text-caption text-ink-faint">单位:小时(1–80 之间的整数),AI 会据此规划每个阶段的时长</p>
          {fieldErrors.weeklyHours ? (
            <p className="text-body-sm text-danger">{fieldErrors.weeklyHours}</p>
          ) : null}
        </div>

        {/* 当前阶段自评:三选一(与 AI 输入枚举一致) */}
        <div className="space-y-2">
          <Label>当前阶段自评</Label>
          <div className="flex flex-wrap gap-2">
            {STAGE_OPTIONS.map((stage) => {
              const selected = currentStage === stage;
              return (
                <button
                  key={stage}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setCurrentStage(selected ? null : stage);
                    setFieldErrors((errs) => ({ ...errs, currentStage: undefined }));
                  }}
                  className={cn(
                    "rounded-pill border px-3 py-1 text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected
                      ? "border-green-600 bg-green-100 text-ink"
                      : "border-hairline-strong bg-white text-ink-muted hover:border-ink-faint"
                  )}
                >
                  {selected ? "✓ " : ""}
                  {stage}
                </button>
              );
            })}
          </div>
          {fieldErrors.currentStage ? (
            <p className="text-body-sm text-danger">{fieldErrors.currentStage}</p>
          ) : null}
        </div>

        {serverError ? (
          <p role="alert" className="text-body-sm text-danger">
            {serverError}
          </p>
        ) : null}
      </div>

      {/* 固定底部导航:每屏一个 40px 主按钮(DesignRules) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-surface/95">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-end px-4 py-3">
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {submitting ? "生成中…" : "生成成长路线"}
          </Button>
        </div>
      </div>
    </>
  );
}
