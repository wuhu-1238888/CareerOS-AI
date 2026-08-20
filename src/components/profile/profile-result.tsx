"use client";
// 画像结果视图(2.5):概要卡(ai-badge/摘要/能力标签/置信度)→ 优势/不足双列(优势可展开 ai-insight)→
// 六维雷达(Recharts 绿色 20% 填充 + HTML 图例)→ 推荐方向卡(匹配度大数字)→ 发展建议。
// 渲染前对 aiAnalysis 做 Schema 校验(DB 回读不直接信任);版本选择器(listVersions + getVersion)支持查看旧版本;
// 页面头动作:规划成长路线 → /navigator、优化简历 → /resume、这不是我(2.6 接线,onCorrect 未提供时禁用)。
import { useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
} from "recharts";
import { Check, ChevronDown, Compass, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AiBadge } from "@/components/shared/ai-badge";
import { trpc } from "@/trpc/client";
import { profileAnalysisSchema } from "@/lib/profile/analysis-schemas";
import type { ProfileAnalysis } from "@/lib/profile/analysis-schemas";
import { colors } from "@/lib/design/tokens";
import { cn } from "@/lib/utils";

type ResultProfile = {
  id: string;
  version: number;
  parentVersion: number | null;
  createdAt: string;
  updatedAt: string;
  data: unknown;
  aiAnalysis?: unknown;
};

const CONFIDENCE_STYLE: Record<ProfileAnalysis["confidence"]["level"], string> = {
  高: "bg-success-bg text-success",
  中: "bg-warning-bg text-warning",
  低: "bg-info-bg text-info",
};

const LEVEL_STYLE: Record<"基础" | "熟练" | "精通", string> = {
  基础: "text-ink-muted",
  熟练: "text-green-600",
  精通: "text-green-700 font-medium",
};

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

// 优势条目:标题 + 可展开的 AI 洞察(详情)
function StrengthItem({ title, detail }: { title: string; detail: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-control bg-sunken p-3">
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
        <span className="flex-1 text-body-sm text-ink">{title}</span>
        <ChevronDown
          className={cn("mt-0.5 size-4 shrink-0 text-ink-faint transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && <p className="mt-2 pl-6 text-body-sm text-ink-secondary">{detail}</p>}
    </li>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-body-lg font-medium text-ink">{children}</h2>
      <AiBadge />
    </div>
  );
}

export function ProfileResult({
  initial,
  onCorrect,
  onUpdate,
}: {
  initial: ResultProfile;
  /** 2.6 纠偏入口:未接线时「这不是我」按钮禁用 */
  onCorrect?: () => void;
  /** 2.7 主动更新入口:回到表单预填最新数据;未接线时「更新信息」按钮禁用 */
  onUpdate?: () => void;
}) {
  const versions = trpc.profile.listVersions.useQuery();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const versionQuery = trpc.profile.getVersion.useQuery(
    { id: viewingId ?? "" },
    { enabled: viewingId !== null }
  );

  const row: ResultProfile = viewingId && versionQuery.data ? versionQuery.data : initial;
  const parsed = profileAnalysisSchema.safeParse(row.aiAnalysis);

  if (!parsed.success) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-6">
        <div className="rounded-card border border-hairline bg-surface p-10 text-center shadow-card">
          <p className="text-body text-ink-muted">分析数据异常,请重新分析画像</p>
        </div>
      </div>
    );
  }
  const analysis = parsed.data;

  // 不足来自推荐方向的差距条目(2.3 Schema 无顶层不足字段,方向 weaknesses 为其数据来源),最多 5 条
  const weaknessRows = analysis.directions
    .flatMap((direction) =>
      direction.weaknesses.map((text) => ({ text, source: direction.name }))
    )
    .slice(0, 5);

  const radarData = Object.entries(analysis.radar).map(([dimension, value]) => ({
    dimension,
    value,
  }));

  const showVersionSelector = (versions.data?.length ?? 0) > 1;

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-4 px-4 py-6">
      {/* 页面头操作:版本选择器 + 动作按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {showVersionSelector ? (
          <Select
            value={row.id}
            onValueChange={(id) => setViewingId(id === initial.id ? null : id)}
          >
            <SelectTrigger
              className="w-auto min-w-[140px]"
              aria-label="查看历史版本"
            >
              <SelectValue placeholder="版本" />
            </SelectTrigger>
            <SelectContent>
              {versions.data!.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {`v${v.version} · ${formatDate(v.createdAt)}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="flex gap-2">
          <Button variant="ghost" disabled={!onUpdate} onClick={onUpdate}>
            更新信息
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/resume">
              <FileText aria-hidden />
              优化简历
            </Link>
          </Button>
          <Button variant="ghost" disabled={!onCorrect} onClick={onCorrect}>
            这不是我
          </Button>
          <Button asChild>
            <Link href="/navigator">
              <Compass aria-hidden />
              规划成长路线
            </Link>
          </Button>
        </div>
      </div>

      {/* 概要卡:摘要 + 能力标签 + 置信度 */}
      <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <SectionTitle>职业画像概要</SectionTitle>
        <p className="mt-3 text-body text-ink-secondary">{analysis.summary}</p>
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="能力标签">
          {analysis.abilityTags.map((tag) => (
            <li
              key={tag.name}
              className="flex items-center gap-1.5 rounded-pill bg-sunken px-2.5 py-1 text-body-sm text-ink-secondary"
            >
              {tag.name}
              <span className={cn("text-caption", LEVEL_STYLE[tag.level])}>{tag.level}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-2">
          <span
            className={cn("rounded-pill px-2 py-0.5 text-caption", CONFIDENCE_STYLE[analysis.confidence.level])}
          >
            置信度:{analysis.confidence.level}
          </span>
          <span className="text-caption text-ink-muted">{analysis.confidence.note}</span>
        </div>
      </section>

      {/* 优势 / 不足双列 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <SectionTitle>优势</SectionTitle>
          <ul className="mt-4 space-y-2">
            {analysis.strengths.map((strength) => (
              <StrengthItem key={strength.title} title={strength.title} detail={strength.detail} />
            ))}
          </ul>
        </section>
        <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
          <SectionTitle>不足</SectionTitle>
          {weaknessRows.length === 0 ? (
            <p className="mt-4 text-body-sm text-ink-muted">未发现明显不足</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {weaknessRows.map((weakness, index) => (
                <li key={`${weakness.text}-${index}`} className="rounded-control bg-sunken p-3">
                  <div className="flex items-start gap-2">
                    <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-body-sm text-ink">{weakness.text}</p>
                      <p className="mt-0.5 text-caption text-ink-faint">
                        来自方向「{weakness.source}」
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 六维雷达 */}
      <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <SectionTitle>六维能力雷达</SectionTitle>
        <div className="mt-4 h-[280px]" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="70%">
              <PolarGrid stroke={colors.hairline.strong} />
              <PolarAngleAxis
                dataKey="dimension"
                tick={{ fill: colors.ink.muted, fontSize: 12 }}
              />
              <Radar
                dataKey="value"
                stroke={colors.chart.green}
                fill={colors.chart.green}
                fillOpacity={0.2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        {/* 图例:无障碍文本替代 + 数据可测试 */}
        <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3" aria-label="雷达数据">
          {radarData.map((item) => (
            <li key={item.dimension} className="flex items-center justify-between text-caption">
              <span className="text-ink-muted">{item.dimension}</span>
              <span className="text-ink">{item.value}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* 推荐方向卡 */}
      <section className="space-y-4">
        <SectionTitle>推荐方向</SectionTitle>
        {analysis.directions.map((direction) => (
          <article
            key={direction.name}
            className="rounded-card border border-hairline bg-surface p-6 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-body-lg font-medium text-ink">{direction.name}</h3>
              <div className="shrink-0 text-right">
                <span className="text-num text-green-600">{direction.matchScore}</span>
                <span className="ml-1 text-caption text-ink-muted">匹配度</span>
              </div>
            </div>
            <p className="mt-2 text-body-sm text-ink-secondary">{direction.reason}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ul className="space-y-1.5" aria-label={`${direction.name}的优势`}>
                {direction.strengths.map((strength) => (
                  <li key={strength} className="flex items-start gap-2 text-body-sm text-ink-secondary">
                    <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                    {strength}
                  </li>
                ))}
              </ul>
              <ul className="space-y-1.5" aria-label={`${direction.name}的劣势`}>
                {direction.weaknesses.map((weakness) => (
                  <li key={weakness} className="flex items-start gap-2 text-body-sm text-ink-secondary">
                    <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                    {weakness}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </section>

      {/* 发展建议 */}
      <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <SectionTitle>发展建议</SectionTitle>
        <ol className="mt-4 space-y-3">
          {analysis.suggestions.map((suggestion, index) => (
            <li key={suggestion.gap} className="flex gap-3">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-caption text-green-700"
              >
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className="text-body-sm font-medium text-ink">{suggestion.gap}</p>
                <p className="mt-0.5 text-body-sm text-ink-secondary">{suggestion.action}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
