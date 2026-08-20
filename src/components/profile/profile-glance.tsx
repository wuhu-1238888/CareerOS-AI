// 核心结论带(布局优化):进入结果页数秒内理解核心职业状态。
// 只聚合已有数据,不生成新评分——aiAnalysis 无全局综合分 → 用置信度 badge;优势/短板/方向均为真实条目。
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileAnalysis } from "@/lib/profile/analysis-schemas";

export const CONFIDENCE_STYLE: Record<ProfileAnalysis["confidence"]["level"], string> = {
  高: "bg-success-bg text-success",
  中: "bg-warning-bg text-warning",
  低: "bg-info-bg text-info",
};

export function ProfileGlance({
  confidenceLevel,
  topStrengths,
  topWeakness,
  topDirection,
}: {
  confidenceLevel: ProfileAnalysis["confidence"]["level"];
  topStrengths: string[];
  topWeakness: string | null;
  topDirection: string | null;
}) {
  return (
    <section
      className="rounded-card border border-hairline bg-surface p-6 shadow-card"
      aria-label="核心结论"
    >
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-eyebrow text-ink-muted">综合评价</p>
          <div className="mt-2">
            <span
              className={cn("rounded-pill px-2 py-0.5 text-caption", CONFIDENCE_STYLE[confidenceLevel])}
            >
              {confidenceLevel}
            </span>
          </div>
          <p className="mt-1 text-caption text-ink-muted">基于信息完整度评估</p>
        </div>
        <div>
          <p className="text-eyebrow text-ink-muted">核心优势</p>
          <ul className="mt-2 space-y-1.5">
            {topStrengths.map((strength) => (
              <li key={strength} className="flex items-start gap-2 text-body-sm text-ink">
                <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                <span className="min-w-0">{strength}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-eyebrow text-ink-muted">主要短板</p>
          {topWeakness ? (
            <div className="mt-2 flex items-start gap-2 text-body-sm text-ink">
              <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              <span className="min-w-0">{topWeakness}</span>
            </div>
          ) : (
            <p className="mt-2 text-body-sm text-ink-muted">未发现明显不足</p>
          )}
        </div>
        <div>
          <p className="text-eyebrow text-ink-muted">最推荐方向</p>
          <p className="mt-2 text-body font-medium text-ink">{topDirection ?? "—"}</p>
        </div>
      </div>
    </section>
  );
}
