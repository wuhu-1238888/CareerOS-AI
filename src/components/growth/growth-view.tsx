"use client";
// 个人成长报告页视图(8.2):①画像版本演进 —— 时间线选中相邻两版 → 双线雷达(选中版绿/
// 上一版紫,history-compare 先例)+ 能力标签变化 ②任务完成趋势(近 12 周柱状)③匹配度变化
// 曲线(最近 20 次成功匹配)④匿名聚合卡(aggregate-card)。每图四态 + 空态引导(数据不足展示
// 引导而非报错);chart.* 色只进图表;图表 aria-hidden 配 sr-only 文本替代。首屏 5 区块 ≤7 组件。
import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/trpc/client";
import { colors } from "@/lib/design/tokens";
import { useTokenColor } from "@/lib/design/use-token-color";
import { diffAbilityTags, diffRadar, type AbilityTagChange } from "@/lib/profile/profile-diff";
import { cn } from "@/lib/utils";
import type { GrowthReport, ProfileVersionPoint } from "@/lib/growth/data";
import { ChartCard } from "./chart-card";
import { AggregateCard } from "./aggregate-card";

// 能力变化徽章:颜色 + 文字双通道(history-compare 同款)
const CHANGE_STYLE: Record<AbilityTagChange["kind"], { badge: string; arrow: string }> = {
  提升: { badge: "bg-green-100 text-green-700", arrow: "↑" },
  下降: { badge: "bg-danger-bg text-danger", arrow: "↓" },
  新增: { badge: "border border-green-400 text-green-700", arrow: "+" },
};

// 周起点(上海周一 00:00 的 UTC 时刻)与匹配时间戳 → 上海日历 MM/DD(标签一致性)
function formatShanghaiDay(iso: string): string {
  const date = new Date(new Date(iso).getTime() + 8 * 60 * 60 * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatVersionDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

// ① 画像版本演进:时间线 + 选中相邻两版双线雷达与能力变化
function ProfileVersionTimeline({
  versions,
  token,
  loading,
  error,
  onRetry,
}: {
  versions: ProfileVersionPoint[];
  token: { hairlineStrong: string; inkMuted: string };
  loading: boolean;
  error: boolean;
  onRetry?: () => void;
}) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const selected =
    versions.find((v) => v.version === selectedVersion) ?? versions[versions.length - 1] ?? null;
  const selectedIndex = selected ? versions.findIndex((v) => v.version === selected.version) : -1;
  const prev = selectedIndex > 0 ? versions[selectedIndex - 1]! : null;

  // 对比数据:仅当相邻两版均有雷达与能力标签时计算(显式收窄;任一缺失 → 引导分支)
  const radarData =
    selected !== null && prev !== null && selected.radar !== null && prev.radar !== null
      ? diffRadar(selected.radar, prev.radar)
      : null;
  const tagChanges =
    selected !== null && prev !== null && selected.abilityTags !== null && prev.abilityTags !== null
      ? diffAbilityTags(selected.abilityTags, prev.abilityTags)
      : null;

  return (
    <ChartCard
      title="画像版本演进"
      description="每次画像分析生成一个新版本,对比相邻版本看能力变化"
      loading={loading}
      error={error}
      onRetry={onRetry}
      empty={versions.length === 0}
      emptyText="完成第一次画像分析后,这里会展示你的画像版本演进"
    >
      <div className="grid gap-6 lg:grid-cols-[240px,1fr]">
        {/* 版本时间线(升序;最新在底部) */}
        <ul className="space-y-2" aria-label="画像版本列表">
          {versions.map((version) => (
            <li key={version.version}>
              <button
                type="button"
                aria-pressed={selected?.version === version.version}
                className={cn(
                  "w-full rounded-control px-3 py-2 text-left transition-colors",
                  selected?.version === version.version
                    ? "bg-green-50 ring-1 ring-green-600"
                    : "bg-sunken hover:bg-sunken/70"
                )}
                onClick={() => setSelectedVersion(version.version)}
              >
                <span className="text-body-sm font-medium text-ink">第 {version.version} 版</span>
                <span className="ml-2 text-caption text-ink-muted">
                  {formatVersionDate(version.createdAt)}
                  {version.radar === null ? " · 未分析" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {radarData !== null && tagChanges !== null && selected !== null && prev !== null ? (
          <div className="min-w-0">
            <div className="h-[280px]" aria-hidden>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="70%">
                  <PolarGrid stroke={token.hairlineStrong} />
                  <PolarAngleAxis dataKey="dimension" tick={{ fill: token.inkMuted, fontSize: 12 }} />
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
              <ul className="sr-only" aria-label="雷达变化数据">
                {radarData.map((item) => (
                  <li key={item.dimension}>
                    {item.dimension}:上一版 {item.previous},当前 {item.current}
                  </li>
                ))}
              </ul>
            </div>
            <ul className="mt-3 flex flex-wrap items-center gap-4" aria-label="雷达图例">
              <li className="flex items-center gap-2 text-body-sm text-ink-secondary">
                <span className="size-3 rounded-full bg-chart-green" aria-hidden />
                第 {selected.version} 版
              </li>
              <li className="flex items-center gap-2 text-body-sm text-ink-secondary">
                <span className="size-3 rounded-full bg-chart-violet" aria-hidden />
                第 {prev.version} 版
              </li>
            </ul>
            <p className="mt-4 text-body-sm text-ink-muted">能力标签变化</p>
            {tagChanges.length === 0 ? (
              <p className="mt-2 text-body-sm text-ink-muted">本次更新能力标签无变化</p>
            ) : (
              <ul className="mt-2 space-y-1.5" aria-label="能力标签变化">
                {tagChanges.map((change) => {
                  const style = CHANGE_STYLE[change.kind];
                  return (
                    <li
                      key={change.name}
                      className={cn(
                        "flex flex-wrap items-center gap-2 rounded-control px-2.5 py-1.5",
                        change.kind === "新增" ? "bg-surface" : "bg-sunken"
                      )}
                    >
                      <span className={cn("rounded-pill px-2 py-0.5 text-caption", style.badge)}>
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
        ) : (
          <div className="self-center rounded-control bg-sunken p-6 text-center">
            <p className="text-body-sm text-ink-muted">
              {versions.length === 0
                ? "完成画像分析后,这里会展示你的画像版本演进"
                : selected && selected.radar === null
                  ? "该版本未生成分析结果,请选择已分析的版本"
                  : "完成第二次画像分析后,这里可对比相邻两版的雷达与能力标签"}
            </p>
          </div>
        )}
      </div>
    </ChartCard>
  );
}

// ② 任务完成趋势(近 12 周):单系列柱状(chart.green),aria-hidden + sr-only 文本
function TaskTrendChart({
  taskTrend,
  token,
}: {
  taskTrend: GrowthReport["taskTrend"];
  token: { hairlineStrong: string; inkMuted: string };
}) {
  const data = taskTrend.map((bucket) => ({
    label: formatShanghaiDay(bucket.weekStart),
    count: bucket.count,
  }));
  return (
    <>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid stroke={token.hairlineStrong} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: token.inkMuted, fontSize: 11 }} />
            <YAxis allowDecimals={false} width={28} tick={{ fill: token.inkMuted, fontSize: 11 }} />
            <Bar dataKey="count" fill={colors.chart.green} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only" aria-label="任务完成趋势数据">
        {taskTrend.map((bucket) => (
          <li key={bucket.weekStart}>
            {formatShanghaiDay(bucket.weekStart)} 当周:{bucket.count} 个任务
          </li>
        ))}
      </ul>
    </>
  );
}

// ③ 匹配度变化曲线(最近 20 次成功匹配):单系列折线(chart.violet),aria-hidden + sr-only 文本
function MatchScoreChart({
  matchScores,
  token,
}: {
  matchScores: GrowthReport["matchScores"];
  token: { hairlineStrong: string; inkMuted: string };
}) {
  const data = matchScores.map((point) => ({
    label: formatShanghaiDay(point.createdAt),
    score: point.overallScore,
  }));
  return (
    <>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid stroke={token.hairlineStrong} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: token.inkMuted, fontSize: 11 }} />
            <YAxis domain={[0, 100]} width={32} tick={{ fill: token.inkMuted, fontSize: 11 }} />
            <Line
              type="monotone"
              dataKey="score"
              stroke={colors.chart.violet}
              strokeWidth={2}
              dot={{ r: 3, fill: colors.chart.violet }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="sr-only" aria-label="匹配度变化数据">
        {matchScores.map((point) => (
          <li key={point.createdAt}>
            {formatShanghaiDay(point.createdAt)}:匹配度 {point.overallScore} 分
          </li>
        ))}
      </ul>
    </>
  );
}

export function GrowthView() {
  const report = trpc.growth.report.useQuery();
  const token = useTokenColor();
  const data = report.data;

  return (
    <div className="space-y-6">
      <ProfileVersionTimeline
        versions={data?.profileVersions ?? []}
        token={token}
        loading={report.isLoading}
        error={report.isError}
        onRetry={() => void report.refetch()}
      />

      <ChartCard
        title="任务完成趋势"
        description="近 12 周每周完成的路线图任务数"
        loading={report.isLoading}
        error={report.isError}
        onRetry={() => void report.refetch()}
        empty={!!data && data.taskTrend.every((bucket) => bucket.count === 0)}
        emptyText="完成任务打卡后,这里会展示你的任务完成趋势"
      >
        {data ? <TaskTrendChart taskTrend={data.taskTrend} token={token} /> : null}
      </ChartCard>

      <ChartCard
        title="匹配度变化"
        description="最近 20 次岗位匹配的整体匹配度"
        loading={report.isLoading}
        error={report.isError}
        onRetry={() => void report.refetch()}
        empty={!!data && data.matchScores.length === 0}
        emptyText="完成岗位匹配后,这里会展示你的匹配度变化曲线"
      >
        {data ? <MatchScoreChart matchScores={data.matchScores} token={token} /> : null}
      </ChartCard>

      <AggregateCard />
    </div>
  );
}
