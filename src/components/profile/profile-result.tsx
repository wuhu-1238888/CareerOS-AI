"use client";
// 画像结果视图(2.5,Desktop 布局优化):Hero 动作区 → 核心结论带(ProfileGlance,仅聚合真实数据)→
// 概要卡(摘要/置信度 + 能力标签)→ 优势/不足双列(优势可展开 ai-insight)→ 六维雷达(左图右分值条)→
// 推荐方向 2 列 Grid(匹配度大数字)→ 发展建议时间线 → 底部下一步行动区(仅复用已实现入口)。
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
import { ProfileGlance, CONFIDENCE_STYLE } from "./profile-glance";
import { trpc } from "@/trpc/client";
import { profileAnalysisSchema } from "@/lib/profile/analysis-schemas";
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
    <li className="rounded-control bg-surface p-3">
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

// 区块标题:AI 标识不再逐区块重复,收敛到 Hero 行与概要卡(AI Demo 感收敛)
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-h2 text-ink">{children}</h2>;
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

  // 核心结论带只聚合已有数据(无全局综合分 → 用置信度;优势/短板/方向取真实条目),不生成新评分
  const topStrengths = analysis.strengths.slice(0, 2).map((strength) => strength.title);
  const topWeakness = weaknessRows[0]?.text ?? null;
  const topDirection = analysis.directions[0]?.name ?? null;
  // 维度分值按从高到低排列:仅展示顺序,数据与雷达同源
  const sortedRadar = [...radarData].sort((a, b) => b.value - a.value);

  const showVersionSelector = (versions.data?.length ?? 0) > 1;

  return (
    <div className="w-full space-y-6 py-6">
      {/* Hero 动作区:左 = AI 标识 + 版本信息;右 = 版本选择器 + 动作按钮 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AiBadge />
          <span className="text-caption text-ink-muted">
            画像 v{row.version} · 更新于 {formatDate(row.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
      </div>

      {/* 核心结论带:数秒内理解核心职业状态 */}
      <ProfileGlance
        confidenceLevel={analysis.confidence.level}
        topStrengths={topStrengths}
        topWeakness={topWeakness}
        topDirection={topDirection}
      />

      {/* 概要卡:摘要 + 置信度(左),能力标签(右) */}
      <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <SectionTitle>职业画像概要</SectionTitle>
              <AiBadge />
            </div>
            <p className="mt-3 text-body text-ink-secondary">{analysis.summary}</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={cn("rounded-pill px-2 py-0.5 text-caption", CONFIDENCE_STYLE[analysis.confidence.level])}
              >
                置信度:{analysis.confidence.level}
              </span>
              <span className="text-caption text-ink-muted">{analysis.confidence.note}</span>
            </div>
          </div>
          <div className="min-w-0">
            <ul className="flex flex-wrap gap-2 content-start" aria-label="能力标签">
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
          </div>
        </div>
      </section>

      {/* 优势 / 不足双列(轻量面板,保留展开交互与来源标注) */}
      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded-card bg-sunken p-6">
          <SectionTitle>优势</SectionTitle>
          <ul className="mt-4 space-y-2">
            {analysis.strengths.map((strength) => (
              <StrengthItem key={strength.title} title={strength.title} detail={strength.detail} />
            ))}
          </ul>
        </section>
        <section className="rounded-card bg-sunken p-6">
          <SectionTitle>不足</SectionTitle>
          {weaknessRows.length === 0 ? (
            <p className="mt-4 text-body-sm text-ink-muted">未发现明显不足</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {weaknessRows.map((weakness, index) => (
                <li key={`${weakness.text}-${index}`} className="rounded-control bg-surface p-3">
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

      {/* 六维雷达:左图右分值条(同一数据源,不新增解释逻辑) */}
      <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <SectionTitle>六维能力雷达</SectionTitle>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="h-[280px]" aria-hidden>
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
          {/* 分值条:无障碍文本替代 + 数据可测试(雷达 aria-hidden) */}
          <ul className="space-y-3 self-center" aria-label="雷达数据">
            {sortedRadar.map((item) => (
              <li key={item.dimension} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-body-sm text-ink-secondary">{item.dimension}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-sunken" aria-hidden>
                  <span
                    className="block h-full rounded-pill bg-green-600"
                    style={{ width: `${item.value}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right text-body-sm text-ink">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 推荐方向:Desktop 两列,提升横向扫描效率 */}
      <section className="space-y-4">
        <SectionTitle>推荐方向</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-2">
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
        </div>
      </section>

      {/* 发展建议:步骤时间线(内容与顺序不变,仅呈现方式) */}
      <section className="rounded-card bg-sunken p-6">
        <SectionTitle>发展建议</SectionTitle>
        <ol className="mt-4">
          {analysis.suggestions.map((suggestion, index) => (
            <li key={suggestion.gap} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  aria-hidden
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-caption text-green-700"
                >
                  {index + 1}
                </span>
                {index < analysis.suggestions.length - 1 ? (
                  <span aria-hidden className="w-px flex-1 bg-hairline" />
                ) : null}
              </div>
              <div className="min-w-0 pb-5">
                <p className="text-body-sm font-medium text-ink">{suggestion.gap}</p>
                <p className="mt-0.5 text-body-sm text-ink-secondary">{suggestion.action}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* 下一步行动:仅复用已实现模块入口(查看岗位/准备面试未实现,不添加) */}
      <section className="rounded-card bg-sunken p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionTitle>下一步</SectionTitle>
            <p className="mt-1 text-body-sm text-ink-muted">画像已完成,继续你的求职准备</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" asChild>
              <Link href="/resume">
                <FileText aria-hidden />
                优化简历
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/navigator">
                <Compass aria-hidden />
                规划成长路线
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
