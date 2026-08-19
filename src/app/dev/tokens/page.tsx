import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  colors,
  typography,
  borderRadius,
  spacing,
  boxShadow,
} from "@/lib/design/tokens";

// Tailwind 工具类必须为字面量(静态扫描),此处以映射表声明完整类名
const typographyClass: Record<string, string> = {
  display: "text-display",
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
  "body-lg": "text-body-lg",
  body: "text-body",
  "body-sm": "text-body-sm",
  caption: "text-caption",
  button: "text-button",
  eyebrow: "text-eyebrow",
  num: "text-num",
  mono: "text-mono",
};

const shadowClass: Record<string, string> = {
  card: "shadow-card",
  hover: "shadow-hover",
  popup: "shadow-popup",
  modal: "shadow-modal",
};

// 开发专用 token 展示页:逐项与 design/DesignSystem.md front matter 核对。
// NODE_ENV === "production" 时 notFound(),不进生产路由。

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-h2 text-ink">{title}</h2>
        {desc ? <p className="text-caption text-ink-muted">{desc}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({
  label,
  value,
  className,
  labelClass,
}: {
  label: string;
  value: string;
  className: string;
  labelClass?: string;
}) {
  return (
    <div className="space-y-1">
      <div
        className={`h-12 rounded-control border border-hairline ${className}`}
      />
      <p className={`text-caption ${labelClass ?? "text-ink-secondary"}`}>
        {label}
      </p>
      <p className="font-mono text-caption text-ink-faint">{value}</p>
    </div>
  );
}

export default function TokensPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="mx-auto max-w-[1160px] px-8 py-12">
      <header className="space-y-2 pb-8">
        <h1 className="text-display text-ink">设计 Token 展示</h1>
        <p className="text-body text-ink-muted">
          唯一事实来源:design/DesignSystem.md front matter —— 本页仅开发环境可用,生产环境 404。
        </p>
      </header>

      <div className="space-y-12">
        {/* 颜色 */}
        <Section title="颜色 / 品牌绿(单一强调色)" desc="成长与行动语义">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Swatch label="green-50" value={colors.green[50]} className="bg-green-50" />
            <Swatch label="green-100" value={colors.green[100]} className="bg-green-100" />
            <Swatch label="green-400" value={colors.green[400]} className="bg-green-400" />
            <Swatch label="green-600(主色)" value={colors.green[600]} className="bg-green-600" />
            <Swatch label="green-700(hover)" value={colors.green[700]} className="bg-green-700" />
            <Swatch label="green-800(pressed)" value={colors.green[800]} className="bg-green-800" />
          </div>
        </Section>

        <Section title="颜色 / AI 紫" desc="只用于标记 AI 生成内容">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Swatch label="violet-50" value={colors.violet[50]} className="bg-violet-50" />
            <Swatch label="violet-400" value={colors.violet[400]} className="bg-violet-400" />
            <Swatch label="violet-700" value={colors.violet[700]} className="bg-violet-700" />
          </div>
        </Section>

        <Section title="颜色 / 暖中性色阶" desc="暖纸白,替代冷灰">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Swatch label="ink" value={colors.ink.DEFAULT} className="bg-ink" />
            <Swatch label="ink-secondary" value={colors.ink.secondary} className="bg-ink-secondary" />
            <Swatch label="ink-muted" value={colors.ink.muted} className="bg-ink-muted" />
            <Swatch label="ink-faint" value={colors.ink.faint} className="bg-ink-faint" />
            <Swatch label="canvas(页面底)" value={colors.canvas} className="bg-canvas" />
            <Swatch label="surface(卡片面)" value={colors.surface} className="bg-surface" />
            <Swatch label="sunken(凹陷面)" value={colors.sunken} className="bg-sunken" />
            <Swatch label="hairline" value={colors.hairline.DEFAULT} className="bg-hairline" />
            <Swatch label="hairline-strong" value={colors.hairline.strong} className="bg-hairline-strong" />
          </div>
        </Section>

        <Section title="颜色 / 语义色" desc="success = 成长绿,警告 / 危险 / 信息均有浅色底">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="space-y-1 rounded-card border border-hairline bg-success-bg p-4">
              <p className="text-caption font-semibold text-success">success</p>
              <p className="font-mono text-caption text-ink-faint">{colors.success.DEFAULT}</p>
              <p className="text-caption text-ink-muted">底 success-bg {colors.success.bg}</p>
            </div>
            <div className="space-y-1 rounded-card border border-hairline bg-warning-bg p-4">
              <p className="text-caption font-semibold text-warning">warning</p>
              <p className="font-mono text-caption text-ink-faint">{colors.warning.DEFAULT}</p>
              <p className="text-caption text-ink-muted">底 warning-bg {colors.warning.bg}</p>
            </div>
            <div className="space-y-1 rounded-card border border-hairline bg-danger-bg p-4">
              <p className="text-caption font-semibold text-danger">danger</p>
              <p className="font-mono text-caption text-ink-faint">{colors.danger.DEFAULT}</p>
              <p className="text-caption text-ink-muted">底 danger-bg {colors.danger.bg}</p>
            </div>
            <div className="space-y-1 rounded-card border border-hairline bg-info-bg p-4">
              <p className="text-caption font-semibold text-info">info</p>
              <p className="font-mono text-caption text-ink-faint">{colors.info.DEFAULT}</p>
              <p className="text-caption text-ink-muted">底 info-bg {colors.info.bg}</p>
            </div>
          </div>
        </Section>

        <Section title="颜色 / 图表色">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Swatch label="chart-green" value={colors.chart.green} className="bg-chart-green" />
            <Swatch label="chart-violet" value={colors.chart.violet} className="bg-chart-violet" />
            <Swatch label="chart-amber" value={colors.chart.amber} className="bg-chart-amber" />
            <Swatch label="chart-blue" value={colors.chart.blue} className="bg-chart-blue" />
            <Swatch label="chart-gray" value={colors.chart.gray} className="bg-chart-gray" />
          </div>
        </Section>

        {/* 字体字号 */}
        <Section title="字体字号(12 级)" desc="工具类 text-{display|h1|h2|h3|body-lg|body|body-sm|caption|button|eyebrow|num|mono}">
          <div className="space-y-3 rounded-card border border-hairline bg-surface p-6 shadow-card">
            {(Object.entries(typography) as [string, (typeof typography)[keyof typeof typography]][]).map(
              ([name, spec]) => (
                <div key={name} className="flex items-baseline gap-4 border-b border-hairline pb-3 last:border-0">
                  <p className={`w-28 shrink-0 text-caption text-ink-muted`}>
                    {name} / {spec.fontWeight}
                  </p>
                  <p className={name === "mono" ? "font-mono text-mono" : typographyClass[name]}>
                    职业成长操作系统 CareerOS
                  </p>
                  <p className="ml-auto shrink-0 font-mono text-caption text-ink-faint">
                    {spec.fontSize} / lh {spec.lineHeight}
                    {spec.letterSpacing !== "0" ? ` / ls ${spec.letterSpacing}` : ""}
                  </p>
                </div>
              )
            )}
          </div>
        </Section>

        {/* 圆角 */}
        <Section title="圆角" desc="工具类 rounded-{control|card|modal|pill}">
          <div className="flex flex-wrap items-end gap-6">
            {(
              [
                ["control", "rounded-control", "h-10 w-24"],
                ["card", "rounded-card", "h-16 w-32"],
                ["modal", "rounded-modal", "h-20 w-40"],
                ["pill", "rounded-pill", "h-10 w-40"],
              ] as const
            ).map(([name, roundedClass, sizeClass]) => (
              <div key={name} className="space-y-1">
                <div className={`${roundedClass} ${sizeClass} border border-hairline-strong bg-green-100`} />
                <p className="text-caption text-ink-secondary">
                  {name} = {borderRadius[name]}
                </p>
              </div>
            ))}
          </div>
        </Section>

        {/* 间距 */}
        <Section title="间距(space-1 ~ space-20)" desc="4px 基准 × 1/2/3/4/5/6/8/10/12/16/20">
          <div className="space-y-2">
            {(
              Object.entries(spacing) as [string, string][]
            ).map(([name, value]) => (
              <div key={name} className="flex items-center gap-4">
                <p className="w-20 shrink-0 text-caption text-ink-muted">space-{name}</p>
                <div className="h-3 rounded-control bg-green-600" style={{ width: value }} />
                <p className="font-mono text-caption text-ink-faint">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 阴影 */}
        <Section title="阴影(暖黑 ink 基色)" desc="工具类 shadow-{card|hover|popup|modal}">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(
              Object.entries(boxShadow) as [string, string][]
            ).map(([name, value]) => (
              <div key={name} className="space-y-2">
                <div className={`h-24 rounded-card border border-hairline bg-surface ${shadowClass[name]}`} />
                <p className="text-caption text-ink-secondary">{name}</p>
                <p className="break-all font-mono text-caption text-ink-faint">{value}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 字体族 */}
        <Section title="字体族(系统栈,零 webfont)">
          <div className="space-y-3 rounded-card border border-hairline bg-surface p-6 shadow-card">
            <div>
              <p className="text-caption text-ink-muted">界面正文 font-sans</p>
              <p className="text-body-lg">成长绿 + AI 紫 + 暖纸白 —— 陪伴成长的 AI 职业操作系统</p>
            </div>
            <div>
              <p className="text-caption text-ink-muted">等宽 font-mono(ATS 关键词 / 技能 ID / 技术名)</p>
              <p className="font-mono text-mono">Python / LangChain / figma / toC_2026</p>
            </div>
          </div>
        </Section>
      </div>
    </main>
  );
}
