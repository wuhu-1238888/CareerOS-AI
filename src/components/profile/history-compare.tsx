"use client";
// 画像历史对比(6.5):当前 vs 上次——双线雷达(当前绿/上次紫)+ 能力变化列表
// (提升=绿底↑ / 下降=红底↓ / 新增=绿描边+,颜色 + 文字双通道,DesignRules 可访问性)。
// previous 版本经 getVersion 读取;aiAnalysis 解析失败 → 返回 null(区块整体隐藏,不阻塞结果页)。
// 6.9 深色模式:grid/tick 与 profile-result 雷达同步接入 use-token-color。
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { trpc } from "@/trpc/client";
import { profileAnalysisSchema, type ProfileAnalysis } from "@/lib/profile/analysis-schemas";
import { diffRadar, diffAbilityTags, type AbilityTagChange } from "@/lib/profile/profile-diff";
import { colors } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

// 变化徽章:颜色 + 文字双通道
const CHANGE_STYLE: Record<AbilityTagChange["kind"], { badge: string; arrow: string }> = {
  提升: { badge: "bg-green-100 text-green-700", arrow: "↑" },
  下降: { badge: "bg-danger-bg text-danger", arrow: "↓" },
  新增: { badge: "border border-green-400 text-green-700", arrow: "+" },
};

export function HistoryCompare({
  current,
  previousId,
}: {
  /** 当前(最新版)画像分析结果 */
  current: ProfileAnalysis;
  /** 上一次画像版本 id(与最新版对比;listVersions 降序第 2 条) */
  previousId: string;
}) {
  const previousQuery = trpc.profile.getVersion.useQuery({ id: previousId });
  const previousRow = previousQuery.data;
  // 加载中与解析失败一律隐藏区块(6.5 验收:previous 损坏不阻塞结果页)
  const previous = previousRow
    ? profileAnalysisSchema.safeParse(previousRow.aiAnalysis)
    : null;
  if (!previousRow || !previous?.success) return null;

  const radarData = diffRadar(current.radar, previous.data.radar);
  const changes = diffAbilityTags(current.abilityTags, previous.data.abilityTags);

  return (
    <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h2 text-ink">历史对比</h2>
        <p className="text-caption text-ink-muted">当前画像 vs 第 {previousRow.version} 版画像</p>
      </div>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {/* 双线雷达:当前绿 / 上次紫(分值条由结果页单线雷达承载,此处不重复) */}
        <div className="h-[280px]" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke={colors.hairline.strong} />
              <PolarAngleAxis dataKey="dimension" tick={{ fill: colors.ink.muted, fontSize: 12 }} />
              <Radar
                dataKey="previous"
                stroke={colors.chart.violet}
                fill={colors.chart.violet}
                fillOpacity={0.15}
              />
              <Radar
                dataKey="current"
                stroke={colors.chart.green}
                fill={colors.chart.green}
                fillOpacity={0.2}
              />
            </RadarChart>
          </ResponsiveContainer>
          {/* 雷达 aria-hidden 的文本替代(sr-only,不改变视觉布局) */}
          <ul className="sr-only" aria-label="雷达变化数据">
            {radarData.map((item) => (
              <li key={item.dimension}>
                {item.dimension}:上次 {item.previous},当前 {item.current}
              </li>
            ))}
          </ul>
        </div>
        <div className="self-center">
          <ul className="space-y-2" aria-label="雷达图例">
            <li className="flex items-center gap-2 text-body-sm text-ink-secondary">
              <span className="size-3 rounded-full bg-chart-green" aria-hidden />
              当前画像
            </li>
            <li className="flex items-center gap-2 text-body-sm text-ink-secondary">
              <span className="size-3 rounded-full bg-chart-violet" aria-hidden />
              上次画像
            </li>
          </ul>
          <p className="mt-4 text-body-sm text-ink-muted">能力标签变化</p>
          {changes.length === 0 ? (
            <p className="mt-2 text-body-sm text-ink-muted">本次更新能力标签无变化</p>
          ) : (
            <ul className="mt-2 space-y-1.5" aria-label="能力标签变化">
              {changes.map((change) => {
                const style = CHANGE_STYLE[change.kind];
                return (
                  <li
                    key={change.name}
                    className={cn(
                      "flex flex-wrap items-center gap-2 rounded-control px-2.5 py-1.5",
                      change.kind === "新增" ? "bg-surface" : "bg-sunken"
                    )}
                  >
                    <span
                      className={cn("rounded-pill px-2 py-0.5 text-caption", style.badge)}
                    >
                      {change.kind} {style.arrow}
                    </span>
                    <span className="text-body-sm text-ink">{change.name}</span>
                    <span className="text-caption text-ink-muted">
                      {change.from ? `${change.from} → ${change.to}` : `达到 ${change.to}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
