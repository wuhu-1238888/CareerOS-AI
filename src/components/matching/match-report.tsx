"use client";
// 岗位匹配报告(6.2,Desktop 布局):①Hero 匹配度大数字 + 投递建议徽章(颜色 + 文字双通道)
// ②逐项能力对比(状态徽章 + 匹配类型标签 + 证据/差距,「这个要求我其实满足」纠偏)
// ③双线雷达(用户线 = 画像雷达绿,岗位线 = JD 要求紫)④隐性需求揭示(ai-insight 视觉)
// ⑤投递建议卡 + 简历针对性优化建议 ⑥主行动「生成 90 天提升计划」(6.4 接线)+ 重新匹配。
// 无画像降级形态:仅展示 JD 拆解,整体匹配度/对比/建议不渲染。
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { Check, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/shared/ai-badge";
import { useTokenColor } from "@/lib/design/use-token-color";
import { colors } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";
import type { MatchAnalysis, MatchItem, ProfileRadar, RecommendationLevel } from "@/lib/matching/analysis-schemas";

// 状态与建议等级徽章:颜色 + 文字双通道(DesignRules 可访问性)
const STATUS_STYLE: Record<MatchItem["status"], string> = {
  达标: "bg-green-100 text-green-700",
  接近: "bg-warning-bg text-warning",
  不足: "bg-danger-bg text-danger",
};

const LEVEL_STYLE: Record<RecommendationLevel, string> = {
  建议投递: "bg-green-100 text-green-700",
  建议补课后投递: "bg-warning-bg text-warning",
  不推荐: "bg-danger-bg text-danger",
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-h2 text-ink">{children}</h2>;
}

export function MatchReport({
  report,
  userRadar,
  onCorrect,
  onRedo,
  onCoach,
  coachExists = false,
}: {
  report: MatchAnalysis;
  /** 用户线雷达:最新画像 aiAnalysis.radar(防御解析后传入);null 时仅画岗位线 */
  userRadar: ProfileRadar | null;
  /** 「这个要求我其实满足」:打开纠偏弹窗(未接线时按钮禁用) */
  onCorrect?: (requirement: { id: string; text: string }) => void;
  /** 重新匹配:回到 JD 表单预填原文 */
  onRedo?: () => void;
  /** 生成 90 天提升计划(6.4 接线;未接线时按钮禁用) */
  onCoach?: () => void;
  /** 已有教练计划(6.4):CTA 文案变「查看 90 天提升计划」 */
  coachExists?: boolean;
}) {
  // 深色模式下 Recharts grid/tick 用 CSS 变量色(6.9);变量未定义时回退浅色 token
  const token = useTokenColor();

  const itemByReq = new Map(report.items.map((item) => [item.requirementId, item]));
  // 无画像降级形态:整体匹配度/对比/建议均不渲染,仅拆解
  const degraded = report.overallScore === null;

  const radarData = (Object.keys(report.jobRadar) as (keyof ProfileRadar)[]).map((dimension) => ({
    dimension,
    user: userRadar?.[dimension] ?? null,
    job: report.jobRadar[dimension],
  }));

  const hiddenRequirements = report.requirements.filter((r) => r.category === "隐性");

  return (
    <div className="w-full space-y-6 py-6">
      {/* ① Hero:岗位名 + 一句话结论 + 匹配度大数字 + 投递建议徽章 */}
      <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <AiBadge />
              {report.positionTitle && (
                <h1 className="text-h1 text-ink">{report.positionTitle}</h1>
              )}
            </div>
            <p className="mt-3 text-body text-ink-secondary">{report.summary}</p>
          </div>
          {!degraded && (
            <div className="shrink-0 text-right">
              <div>
                <span className="text-num text-green-600">{report.overallScore}</span>
                <span className="ml-1 text-caption text-ink-muted">匹配度</span>
              </div>
              {report.recommendation && (
                <span
                  className={cn(
                    "mt-2 inline-block rounded-pill px-2.5 py-0.5 text-caption",
                    LEVEL_STYLE[report.recommendation.level]
                  )}
                >
                  {report.recommendation.level}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {degraded ? (
        /* 无画像降级形态文案:仅拆解(UI 闸门正常情况下不会进入,画像被删等边缘态兜底) */
        <section className="rounded-card bg-sunken p-6">
          <SectionTitle>岗位要求拆解</SectionTitle>
          <p className="mt-2 text-body-sm text-ink-muted">
            仅基于 JD 的岗位要求拆解,完成职业画像后可查看完整匹配分析。
          </p>
          <ul className="mt-4 space-y-2">
            {report.requirements.map((requirement) => (
              <li key={requirement.id} className="rounded-control bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-body-sm text-ink">{requirement.text}</p>
                  <span
                    className={cn(
                      "shrink-0 rounded-pill px-2 py-0.5 text-caption",
                      requirement.category === "隐性" ? "bg-violet-50 text-violet-700" : "bg-sunken text-ink-muted"
                    )}
                  >
                    {requirement.category}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {/* ② 逐项能力对比 */}
          <section className="space-y-4">
            <SectionTitle>逐项能力对比</SectionTitle>
            <ul className="space-y-3">
              {report.requirements.map((requirement) => {
                const item = itemByReq.get(requirement.id);
                return (
                  <li
                    key={requirement.id}
                    className="rounded-card border border-hairline bg-surface p-5 shadow-card"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "rounded-pill px-2 py-0.5 text-caption",
                              requirement.category === "隐性" ? "bg-violet-50 text-violet-700" : "bg-sunken text-ink-muted"
                            )}
                          >
                            {requirement.category}
                          </span>
                          <span className="text-caption text-ink-faint">
                            重要度 {requirement.importance}/5
                          </span>
                          {item && (
                            <span
                              className={cn("rounded-pill px-2 py-0.5 text-caption", STATUS_STYLE[item.status])}
                            >
                              {item.status}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-body text-ink">{requirement.text}</p>
                      </div>
                      {item && item.status !== "达标" && onCorrect && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onCorrect({ id: requirement.id, text: requirement.text })}
                        >
                          这个要求我其实满足
                        </Button>
                      )}
                    </div>
                    {item ? (
                      <div className="mt-3 grid gap-3 rounded-control bg-sunken p-4 sm:grid-cols-2">
                        <div className="min-w-0">
                          <p className="text-caption text-ink-faint">
                            你的证据
                            <span className="ml-2 rounded-pill bg-surface px-2 py-0.5">
                              {item.matchType}
                            </span>
                          </p>
                          <p className="mt-1 flex items-start gap-2 text-body-sm text-ink">
                            <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                            {item.userEvidence}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-caption text-ink-faint">差距</p>
                          <p className="mt-1 flex items-start gap-2 text-body-sm text-ink-secondary">
                            {item.status === "达标" ? (
                              <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                            ) : (
                              <X className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                            )}
                            {item.gap}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 text-body-sm text-ink-muted">该项暂未对比</p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ③ 双线雷达:用户线(绿)与岗位线(紫)同维度叠加 */}
          <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
            <SectionTitle>能力 vs 岗位要求</SectionTitle>
            <div className="mt-4 grid gap-6 lg:grid-cols-2">
              <div className="h-[280px]" aria-hidden>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="70%">
                    <PolarGrid stroke={token.hairlineStrong} />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fill: token.inkMuted, fontSize: 12 }}
                    />
                    <Radar
                      dataKey="job"
                      stroke={colors.chart.violet}
                      fill={colors.chart.violet}
                      fillOpacity={0.15}
                    />
                    {userRadar && (
                      <Radar
                        dataKey="user"
                        stroke={colors.chart.green}
                        fill={colors.chart.green}
                        fillOpacity={0.2}
                      />
                    )}
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="self-center space-y-4">
                <ul className="space-y-2" aria-label="雷达图例">
                  <li className="flex items-center gap-2 text-body-sm text-ink-secondary">
                    <span className="size-3 rounded-full bg-chart-green" aria-hidden />
                    你的能力(来自画像)
                  </li>
                  <li className="flex items-center gap-2 text-body-sm text-ink-secondary">
                    <span className="size-3 rounded-full bg-chart-violet" aria-hidden />
                    岗位要求(来自 JD)
                  </li>
                </ul>
                <p className="max-w-sm text-body-sm text-ink-muted">
                  对比你的能力与岗位要求的六维强度,重合度越高说明匹配越充分。
                </p>
              </div>
            </div>
          </section>

          {/* ④ 隐性需求揭示:ai-insight 视觉(紫底紫边 + AI 标识) */}
          {hiddenRequirements.length > 0 && (
            <section className="space-y-4">
              <SectionTitle>隐性需求</SectionTitle>
              <ul className="space-y-3">
                {hiddenRequirements.map((requirement) => {
                  const item = itemByReq.get(requirement.id);
                  return (
                    <li
                      key={requirement.id}
                      className="rounded-r-control border-l-[3px] border-l-violet-400 bg-violet-50 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <AiBadge>AI 解读</AiBadge>
                        <span className="text-caption text-ink-faint">
                          重要度 {requirement.importance}/5
                        </span>
                        {item && (
                          <span
                            className={cn("rounded-pill px-2 py-0.5 text-caption", STATUS_STYLE[item.status])}
                          >
                            {item.status}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-body text-ink">{requirement.text}</p>
                      {item && item.status !== "达标" && (
                        <p className="mt-1 text-body-sm text-ink-secondary">{item.gap}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ⑤ 投递建议卡 + 简历针对性优化建议 */}
          <section className="rounded-card bg-sunken p-6">
            <SectionTitle>投递建议</SectionTitle>
            {report.recommendation ? (
              <div className="mt-3 flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <Target className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-body font-medium text-ink">{report.recommendation.level}</p>
                  <p className="mt-0.5 text-body-sm text-ink-secondary">{report.recommendation.reason}</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-body-sm text-ink-muted">暂未给出投递建议</p>
            )}
            {report.resumeSuggestions.length > 0 && (
              <div className="mt-5 border-t border-hairline pt-4">
                <p className="text-body-sm font-medium text-ink">简历针对性优化建议</p>
                <ul className="mt-2 space-y-2">
                  {report.resumeSuggestions.map((suggestion, index) => {
                    const requirement = report.requirements.find(
                      (r) => r.id === suggestion.requirementId
                    );
                    return (
                      <li key={`${suggestion.requirementId ?? "general"}-${index}`} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                        <div className="min-w-0">
                          <p className="text-body-sm text-ink">{suggestion.suggestion}</p>
                          {requirement && (
                            <p className="text-caption text-ink-faint">针对:{requirement.text}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
        </>
      )}

      {/* ⑥ 主行动:生成 90 天提升计划(6.4 接线)+ 重新匹配 */}
      <section className="rounded-card bg-sunken p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionTitle>下一步</SectionTitle>
            <p className="mt-1 text-body-sm text-ink-muted">
              {degraded ? "完成职业画像后可继续" : "把差距转化为可执行的提升计划"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={!onRedo} onClick={onRedo}>
              重新匹配
            </Button>
            <Button disabled={!onCoach || degraded} onClick={onCoach}>
              {coachExists ? "查看 90 天提升计划" : "生成 90 天提升计划"}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
