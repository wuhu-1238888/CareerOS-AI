"use client";
// ATS 评分卡(4.6):显式按钮触发评分(用户拍板决策)。大数字 + 等级文字双通道(≥80 优秀·绿 / 60-79 良好·琥珀 / <60 需改进·红)
// + 12px 描边进度环(DesignSystem Progress Bar 规格)+ 建议列表;接受/拒绝改动后 stale 提示「修改后需重新评分」并支持重新评分;
// 评分中卡内进度态(>1s AI 任务过程反馈);报告防御解析(zod safeParse,DB 回读不直接信任)。
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/shared/ai-badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import { atsReportSchema, type AtsReport } from "@/lib/resume/analysis-schemas";

const LEVEL_STYLE: Record<AtsReport["level"], { badge: string; ring: string }> = {
  优秀: { badge: "bg-green-100 text-green-700", ring: "text-green-600" },
  良好: { badge: "bg-warning-bg text-warning", ring: "text-warning" },
  需改进: { badge: "bg-danger-bg text-danger", ring: "text-danger" },
};

// 12px 描边进度环(DesignSystem):总分数字叠加环心
function ScoreRing({ total, level }: { total: number; level: AtsReport["level"] }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - total / 100);
  return (
    <div className="relative size-28 shrink-0" role="img" aria-label={`ATS 评分 ${total} 分`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r={radius} fill="none" strokeWidth="12" className="stroke-sunken" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="12"
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={LEVEL_STYLE[level].ring}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-num text-ink">{total}</span>
        <span className="text-caption text-ink-muted">分</span>
      </div>
    </div>
  );
}

export function ResumeAtsCard({
  versionId,
  atsScore,
  atsReport,
  stale,
}: {
  versionId: string;
  atsScore: number | null;
  /** ATS 报告 Json(防御解析,损坏视为未评分) */
  atsReport: unknown;
  /** 有建议状态变更晚于上次评分时间 → 提示重新评分 */
  stale: boolean;
}) {
  const utils = trpc.useUtils();
  const score = trpc.resume.scoreAts.useMutation();

  const parsed = atsReportSchema.safeParse(atsReport);
  const report: AtsReport | null = parsed.success && atsScore !== null ? parsed.data : null;

  async function handleScore() {
    try {
      await score.mutateAsync({ versionId });
      void utils.resume.get.invalidate();
      toast.success("ATS 评分已生成");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "评分失败,请稍后重试");
    }
  }

  return (
    <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
      <div className="flex items-center gap-2">
        <h2 className="text-h2 text-ink">ATS 评分</h2>
        {report && <AiBadge />}
      </div>

      {score.isPending ? (
        // 评分中:卡内进度态(>1s 任务过程反馈)
        <div className="mt-4 flex items-center gap-3 rounded-control bg-sunken p-4" aria-live="polite">
          <Loader2 className="size-5 shrink-0 animate-spin text-green-600" aria-hidden />
          <p className="text-body-sm text-ink-secondary">正在生成 ATS 评分,请稍候…</p>
        </div>
      ) : report ? (
        <>
          {/* 总分:进度环 + 等级文字双通道 */}
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <ScoreRing total={report.total} level={report.level} />
            <div className="min-w-0 flex-1 space-y-2">
              <span
                className={cn(
                  "inline-block rounded-pill px-2.5 py-1 text-body-sm font-medium",
                  LEVEL_STYLE[report.level].badge
                )}
              >
                等级:{report.level}
              </span>
              <p className="text-body-sm text-ink-muted">
                综合规则评分与 AI 评估:规则分 {report.ruleScore},内容质量{" "}
                {report.llmSubscores.contentQuality}/5,岗位相关度 {report.llmSubscores.relevance}
                /5。
              </p>
              {stale && (
                <p className="text-body-sm text-warning" role="status">
                  修改后需重新评分:你在评分后调整过修改建议的接受状态
                </p>
              )}
            </div>
          </div>

          {/* 改进建议 */}
          {report.suggestions.length > 0 && (
            <div className="mt-5">
              <h3 className="text-h3 text-ink">改进建议</h3>
              <ul className="mt-3 space-y-2">
                {report.suggestions.map((suggestion) => (
                  <li key={suggestion.title} className="rounded-control bg-sunken p-3">
                    <p className="text-body-sm font-medium text-ink">{suggestion.title}</p>
                    <p className="mt-0.5 text-body-sm text-ink-secondary">{suggestion.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 改动后需重新评分:显式重新评分入口(评分不自动跟随) */}
          {stale && (
            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                disabled={score.isPending}
                onClick={() => void handleScore()}
              >
                <RefreshCw aria-hidden />
                重新评分
              </Button>
            </div>
          )}
        </>
      ) : (
        // 未评分空态:显式按钮触发(不做自动评分)
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control bg-sunken p-4">
          <p className="min-w-0 flex-1 text-body-sm text-ink-secondary">
            基于岗位关键词、量化表达等规则与 AI 评估,生成 ATS 匹配度评分与改进建议。
          </p>
          <Button type="button" onClick={() => void handleScore()}>
            生成 ATS 评分
          </Button>
        </div>
      )}
    </section>
  );
}
