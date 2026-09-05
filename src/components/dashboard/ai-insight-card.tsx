"use client";
// AI 洞察卡(工作台 IA 重构 + 摘要化):工作台四问之「AI 发现了什么」= 最近一次画像分析的
// 摘要。数据源:trpc.profile.get 的 aiAnalysis(仅画像分析,不混入岗位匹配报告;客户端渲染前
// 校验,safeParse 先例 profile-result.tsx:119)。摘要策略:优势 top-3(仅标题,detail 留在
// /profile#glance)、短板 top-2(方向 weaknesses 派生,带来源前缀,与重点关注同文去重)、
// 重点关注 = 首个建议 gap 一行(AI 发现的「最值得关注的问题」)。职责边界:只发现问题、
// 不解决问题 —— 不渲染建议 action 列表,那是「下一步建议」与成长路线的职责。
// 降级纪律:未分析 / 加载失败 / 数据异常 → 卡内引导文案,绝不伪造 AI 结论;与 /profile 页
// 自身的异常提示(profile-result.tsx:121-128)保持一致。分析导向:只呈现 AI 原始文本,
// 不添加「建议你去完成 XX」的命令式措辞。
// 外壳五种状态恒定(未分析/加载/错误/降级/内容),零布局抖动;未分析时不发请求(enabled)。
import Link from "next/link";
import { ArrowRight, Check, CircleAlert, Crosshair } from "lucide-react";
import { trpc } from "@/trpc/client";
import { profileAnalysisSchema } from "@/lib/profile/analysis-schemas";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/shared/ai-badge";

export function AiInsightCard({ analyzed }: { analyzed: boolean }) {
  // analyzed = dashboard.stats 的 profile.analyzed(latest.aiAnalysis != null);
  // 分析完成时工作台 700ms 轮询使其翻转,本查询自动启用,无需自设轮询
  const profile = trpc.profile.get.useQuery(undefined, { enabled: analyzed });

  const parsed = profileAnalysisSchema.safeParse(profile.data?.aiAnalysis);
  const analysis = parsed.success ? parsed.data : null;
  const focusGap = analysis ? analysis.suggestions[0]?.gap ?? null : null;
  const strengthRows = analysis ? analysis.strengths.slice(0, 3) : [];
  const weaknessRows = analysis
    ? analysis.directions
        .flatMap((direction) =>
          direction.weaknesses.map((text) => ({ source: direction.name, text }))
        )
        .filter((weakness) => weakness.text !== focusGap) // 与重点关注同文去重(同一 gap 常见)
        .slice(0, 2)
    : [];

  return (
    <section className="mt-8 rounded-card border border-hairline bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-h2 text-ink">AI 洞察</h2>
        <AiBadge />
      </div>
      <p className="mt-1 text-body-sm text-ink-muted">来自你最近一次画像分析</p>

      {!analyzed ? (
        <div className="mt-6">
          <p className="text-body-sm text-ink-secondary">
            完成画像分析后,这里会展示你的岗位优势、当前短板与重点关注
          </p>
          <Button type="button" variant="ghost" size="sm" className="mt-3" asChild>
            <Link href="/profile">去完成画像</Link>
          </Button>
        </div>
      ) : profile.isLoading ? (
        <div aria-hidden className="mt-6 animate-pulse space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-4 rounded-control bg-sunken" />
          ))}
        </div>
      ) : profile.isError ? (
        <div className="mt-6">
          <p role="alert" className="text-body-sm text-ink-secondary">
            分析数据加载失败
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => void profile.refetch()}
          >
            重试
          </Button>
        </div>
      ) : !analysis ? (
        <div className="mt-6">
          <p className="text-body-sm text-ink-secondary">分析数据暂不可用</p>
          <Button type="button" variant="ghost" size="sm" className="mt-3" asChild>
            <Link href="/profile">去画像页</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="mt-4 space-y-4">
            {strengthRows.length > 0 && (
              <li className="flex items-start gap-3">
                <p className="w-16 shrink-0 text-caption text-ink-faint">岗位优势</p>
                <ul className="min-w-0 space-y-1.5">
                  {strengthRows.map((strength) => (
                    <li key={strength.title} className="flex items-start gap-1.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                      <span className="min-w-0 text-body-sm text-ink">{strength.title}</span>
                    </li>
                  ))}
                </ul>
              </li>
            )}
            {weaknessRows.length > 0 && (
              <li className="flex items-start gap-3">
                <p className="w-16 shrink-0 text-caption text-ink-faint">当前短板</p>
                <ul className="min-w-0 space-y-1.5">
                  {weaknessRows.map((weakness, index) => (
                    <li key={`${weakness.source}-${index}`} className="flex items-start gap-1.5">
                      <CircleAlert className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
                      <span className="min-w-0 text-body-sm text-ink-secondary">
                        <span className="text-ink-faint">{weakness.source}:</span>
                        {weakness.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            )}
            {focusGap && (
              <li className="flex items-start gap-3">
                <p className="w-16 shrink-0 text-caption text-ink-faint">重点关注</p>
                <p className="flex min-w-0 items-start gap-1.5">
                  <Crosshair className="mt-0.5 size-4 shrink-0 text-ink-secondary" aria-hidden />
                  <span className="min-w-0 text-body-sm font-medium text-ink">{focusGap}</span>
                </p>
              </li>
            )}
          </ul>
          <div className="mt-4 border-t border-hairline pt-3">
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/profile#glance">
                查看完整分析
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
