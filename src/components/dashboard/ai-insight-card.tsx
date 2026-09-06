"use client";
// AI 洞察卡(工作台 IA 重构 + 「发现 → 行动」升级):工作台四问之「AI 发现了什么 → 下一步
// 该做什么」= 最近一次画像分析的摘要 + 行动入口。数据源:trpc.profile.get 的 aiAnalysis
// (仅画像分析,不混入岗位匹配报告;客户端渲染前校验,safeParse 先例 profile-result.tsx:119)。
// 内容策略:岗位优势 top-3(仅标题,detail 留在 /profile#glance)、需要关注 = 方向 weaknesses
// 派生 top-2(AI 原文逐字一行短句,不带方向来源前缀;不足 2 条即少显示,不伪造填充)。旧
// 「当前短板」与「重点关注」合并为「需要关注」,画像摘要结语句不再单独展示(完整保留于
// /profile#glance,零信息丢失)。
// 行动区(仅内容态):主按钮「去处理 X 条建议」,X = props pendingCount(stats.resume.
// pendingCount,与 KPI「待处理建议」同源,非硬编码;同步复用 stats 既有机制 —— 简历 Agent
// 运行中 700ms 轮询 + react-query window focus refetch,卡内不新增查询/轮询),深链
// /resume?resumeId=lastActivityId(null 回退 /resume;先例 computeNextStep 规则 4b)。
// 按钮层级:一屏唯一主按钮席位(设计文档标称 40px,Button 实现 default=h-9=36px,既有漂移)
// 属「下一步建议」卡 CTA,故本卡主按钮用 default 变体 + size="sm"(32px 绿实心,保留绿色行动
// 视觉,层级 36 > 32 保持主次)。X=0 → 非交互完成态「建议已处理」;X=null(无简历
// /无版本)→ 不渲染主按钮(不伪造 0;上传引导属「下一步建议」规则 4a,不重复)。次入口 ghost
// 「查看职业画像」→ /profile#glance(完整分析所在)。职责边界:卡片只呈现发现 + 把发现导向
// 行动入口,建议明细仍在 /resume 页处理。
// 降级纪律:未分析 / 加载失败 / 数据异常 → 卡内引导文案,绝不伪造 AI 结论;与 /profile 页
// 自身的异常提示(profile-result.tsx:121-128)保持一致。分析导向:只呈现 AI 原始文本,
// 不添加「建议你去完成 XX」的命令式措辞(「去处理 X 条建议」为设计固定文案,非 AI 输出)。
// 外壳五种状态恒定(未分析/加载/错误/降级/内容),零布局抖动;未分析时不发请求(enabled)。
import Link from "next/link";
import { ArrowRight, Check, Info } from "lucide-react";
import { trpc } from "@/trpc/client";
import { profileAnalysisSchema } from "@/lib/profile/analysis-schemas";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/shared/ai-badge";

export function AiInsightCard({
  analyzed,
  pendingCount,
  lastActivityId,
}: {
  analyzed: boolean;
  // stats.resume.pendingCount:与 KPI「待处理建议」同源;无简历/无版本为 null
  pendingCount: number | null;
  // stats.resume.lastActivityId:主按钮深链目标(pendingCount > 0 时必然非 null,回退纯防御)
  lastActivityId: string | null;
}) {
  // analyzed = dashboard.stats 的 profile.analyzed(latest.aiAnalysis != null);
  // 分析完成时工作台 700ms 轮询使其翻转,本查询自动启用,无需自设轮询
  const profile = trpc.profile.get.useQuery(undefined, { enabled: analyzed });

  const parsed = profileAnalysisSchema.safeParse(profile.data?.aiAnalysis);
  const analysis = parsed.success ? parsed.data : null;
  const strengthRows = analysis ? analysis.strengths.slice(0, 3) : [];
  // 需要关注 top-2:AI 原文逐字、不带方向来源前缀(一行短句压缩;完整分组见 /profile#glance)
  const weaknessRows = analysis
    ? analysis.directions.flatMap((direction) => direction.weaknesses).slice(0, 2)
    : [];
  // 主按钮深链:优先最近一次简历活动版本;null 回退 /resume(resume-hub 未传参数时回落最新行)
  const resumeHref =
    lastActivityId !== null ? `/resume?resumeId=${lastActivityId}` : "/resume";

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
            完成画像分析后,这里会展示你的岗位优势与需要关注
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
          <ul className="mt-3 space-y-3">
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
                <p className="w-16 shrink-0 text-caption text-ink-faint">需要关注</p>
                <ul className="min-w-0 space-y-1.5">
                  {weaknessRows.map((text, index) => (
                    <li key={`${text}-${index}`} className="flex items-start gap-1.5">
                      <Info className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
                      <span className="min-w-0 text-body-sm text-ink-secondary">{text}</span>
                    </li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-hairline pt-3">
            {pendingCount !== null &&
              (pendingCount > 0 ? (
                <Button type="button" size="sm" asChild>
                  <Link href={resumeHref}>
                    去处理 {pendingCount} 条建议
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              ) : (
                <p className="flex items-center gap-1.5 text-body-sm text-ink-secondary">
                  <Check className="size-4 text-green-600" aria-hidden />
                  建议已处理
                </p>
              ))}
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href="/profile#glance">
                查看职业画像
                <ArrowRight aria-hidden />
              </Link>
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
