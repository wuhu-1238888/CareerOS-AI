"use client";
// 工作台(5.1,DesignRules Dashboard;工作台导航优化 P0 + IA 重构):问候行 → 「下一步建议」行动卡
// → KPI 行(3 卡) → AI 洞察卡 → 成长概览。三个核心区回答四问:当前状态(KPI)/ AI 发现了什么
// (AI 洞察 = 最近一次画像分析摘要)/ 我下一步应该做什么(下一步建议)/ 成长有没有变化(成长概览)。
// 「下一步建议」= computeNextStep 规则链(基于 dashboard.stats 真实状态,首个命中即给出,无 AI 推荐系统;
// 全部完成 → 中性文案无 CTA)。「我的工作」区与 3 张顾问卡已随 IA 重构移除(仅为展示入口,
// 与顶部导航重复;功能/路由/业务逻辑全部保留,见 ai-insight-card.tsx)。
// 四态齐全:加载 = 与真实布局同尺寸骨架屏(零位移);空 = 新用户引导空态(主 CTA「开始职业探索」);
// 错误 = 友好错误卡 + 重试;内容 = 有数据用户的完整工作台。
// 数据源:dashboard.stats 单次聚合(任一 Agent 运行中时 700ms 轮询,与分析页同节奏;
// weekTasks 仍供问候行一句话状态;KPI/AI 洞察在分析完成时随轮询实时翻转)。
// 2.7 画像过期提示(>7 天)保留在问候行,不随重构丢失。首屏 5 个区块 ≤7 组件;无聊天窗/无拟人化/无平台公告(禁令走查)。
import Link from "next/link";
import { trpc } from "@/trpc/client";
import type { DashboardStats } from "@/lib/dashboard/stats";
import { Button } from "@/components/ui/button";
import { StatCard, type StatDelta } from "./stat-card";
import { NextStepCard } from "./next-step-card";
import { AiInsightCard } from "./ai-insight-card";
import { GrowthBlock } from "@/components/growth/growth-block";

// 决策 5(2.7 沿用):画像信息超过 7 天视为过时(「信息有变化」的可操作判据,常量可调)
const STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// 「下一步建议」规则链(基于 dashboard.stats 真实状态,取首个命中;不引入 AI 推荐系统)。
// 顺序即产品优先级:画像 → 目标岗位 → 路线图 → 简历优化 → 任务打卡;全部完成 → null(渲染中性文案,无 CTA)。
// title = 行动卡主行动;text = 一句话说明;cta = 按钮文案;深链定位:规则 5 → /navigator?focus=current(当前进行中阶段)。
function computeNextStep(
  data: DashboardStats
): { title: string; text: string; href: string; cta: string } | null {
  const { profile, roadmap, resume } = data;
  if (!profile.analyzed) {
    return { title: "完成职业画像", text: "获得你的专属方向与建议", href: "/profile", cta: "去完成画像" };
  }
  if (profile.directionCount === 0) {
    return { title: "完善目标岗位", text: "补充目标岗位信息,生成你的推荐方向", href: "/profile", cta: "完善目标岗位" };
  }
  if (!roadmap.exists || roadmap.total === 0) {
    return { title: "生成成长路线", text: "把目标变成看得见的阶梯", href: "/navigator", cta: "生成成长路线" };
  }
  if (resume.versionCount === 0) {
    if (resume.fileCount === 0) {
      return { title: "上传简历", text: "上传或粘贴简历,开始针对性优化", href: "/resume?upload=1", cta: "上传简历" };
    }
    return {
      title: "优化目标简历",
      text: "开始优化简历,适配你的目标方向",
      href: resume.lastActivityId ? `/resume?resumeId=${resume.lastActivityId}` : "/resume",
      cta: "优化目标简历",
    };
  }
  if (roadmap.total > roadmap.completed) {
    return {
      title: "继续推进成长路线",
      text: "完成当前阶段任务,逐步提升目标岗位匹配度",
      href: "/navigator?focus=current",
      cta: "继续成长路线",
    };
  }
  return null;
}

// 加载态骨架:与真实布局同尺寸(问候行 → KPI 3 卡 → AI 洞察卡),零布局位移
function DashboardSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="space-y-3">
        <div className="h-8 w-44 rounded-control bg-sunken" />
        <div className="h-4 w-72 rounded-control bg-sunken" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-card bg-sunken" />
        ))}
      </div>
      <div className="mt-8 h-56 rounded-card bg-sunken" />
    </div>
  );
}

export function DashboardView() {
  const me = trpc.user.me.useQuery();
  const stats = trpc.dashboard.stats.useQuery(undefined, {
    // 任一 Agent 运行中 → 700ms 轮询(与分析页同节奏);闲时不轮询
    refetchInterval: (query) => {
      const data = query.state.data;
      return data &&
        (data.agents.profile.status === "running" ||
          data.agents.roadmap.status === "running" ||
          data.agents.resume.status === "running")
        ? 700
        : false;
    },
  });

  if (me.isLoading || stats.isLoading) {
    return <DashboardSkeleton />;
  }

  const data = stats.data;
  if (me.isError || stats.isError || !me.data || !data) {
    return (
      <div className="rounded-card border border-hairline bg-surface p-10 shadow-card">
        <p role="alert" className="text-body-lg font-medium text-ink">
          暂时无法加载工作台数据
        </p>
        <p className="mt-2 text-body-sm text-ink-muted">请检查网络后重试,你的数据不会丢失</p>
        <Button
          type="button"
          className="mt-4"
          onClick={() => {
            void stats.refetch();
            void me.refetch();
          }}
        >
          重试
        </Button>
      </div>
    );
  }

  const hasAnyData = data.profile.version != null || data.roadmap.exists || data.resume.fileCount > 0;

  // 画像过期提示(2.7):仅已有分析结果的画像计入
  const stale =
    data.profile.analyzed &&
    data.profile.updatedAt != null &&
    Date.now() - new Date(data.profile.updatedAt).getTime() > STALE_DAYS * DAY_MS;

  // 问候行一句话状态(数据驱动,不渲染无数据支撑的结论)
  const statusLine = data.roadmap.exists
    ? `本周完成 ${data.weekTasks.completed} 个任务,路线图进度 ${data.roadmap.progress}%`
    : data.profile.analyzed
      ? `本周完成 ${data.weekTasks.completed} 个任务,生成路线图后开始打卡`
      : `完成职业画像,获得你的专属方向与建议`;

  const matchDelta: StatDelta | null =
    data.profile.matchScoreDelta != null
      ? {
          text: `较上次 ${data.profile.matchScoreDelta > 0 ? "+" : ""}${data.profile.matchScoreDelta}%`,
          trend: data.profile.matchScoreDelta >= 0 ? "up" : "down",
        }
      : null;

  const nextStep = computeNextStep(data);

  return (
    <>
      {/* ① 问候行:用户名 + 一句话状态 + 画像过期提示 */}
      <section>
        <h1 className="text-h1 text-ink">你好,{me.data.name}</h1>
        <p className="mt-1 text-body-sm text-ink-secondary">{statusLine}</p>
        {stale && (
          <p className="mt-3 rounded-control bg-warning-bg p-3 text-body-sm text-warning">
            画像信息已超过 7 天,建议更新以获得更准确的建议
            <Link className="ml-2 underline underline-offset-2" href="/profile">
              更新画像
            </Link>
          </p>
        )}
      </section>

      {!hasAnyData ? (
        /* 空态:新用户引导完成画像(DesignRules Dashboard 空态,主 CTA「开始职业探索」) */
        <section className="mx-auto mt-10 max-w-[560px] rounded-card border border-hairline bg-surface p-10 text-center shadow-card">
          <p className="text-h2 text-ink">从职业画像开始你的探索</p>
          <p className="mx-auto mt-2 max-w-[420px] text-body-sm text-ink-muted">
            用 3 分钟完成画像,AI 顾问将为你生成推荐方向、成长路线与简历建议
          </p>
          <Button type="button" className="mt-6" asChild>
            <Link href="/profile">开始职业探索</Link>
          </Button>
        </section>
      ) : (
        <>
          {/* ② 「下一步建议」行动卡:规则链首个命中(基于真实状态);全部完成 → 中性文案无 CTA(不造假) */}
          {nextStep ? (
            <div className="mt-6">
              <NextStepCard
                title={nextStep.title}
                text={nextStep.text}
                href={nextStep.href}
                cta={nextStep.cta}
              />
            </div>
          ) : (
            <p className="mt-4 text-body-sm text-ink-secondary">路线图任务已全部完成,保持节奏</p>
          )}

          {/* ③ KPI 行:推荐方向匹配度(画像) / 路线图进度 / 待处理建议(大数字 + 增量徽章) */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="推荐方向匹配度"
              value={data.profile.matchScore != null ? String(data.profile.matchScore) : "—"}
              delta={matchDelta}
            />
            <StatCard
              label="路线图进度"
              value={data.roadmap.progress != null ? `${data.roadmap.progress}%` : "—"}
            />
            <StatCard
              label="待处理建议"
              value={data.resume.pendingCount != null ? String(data.resume.pendingCount) : "—"}
            />
          </div>

          {/* ④ AI 洞察(「AI 发现了什么」):最近一次画像分析摘要(优势 top-3 / 短板 top-2 / 重点关注一行),
              未分析/解析失败 → 卡内引导,不造假(见 ai-insight-card.tsx) */}
          <AiInsightCard analyzed={data.profile.analyzed} />

          {/* ⑤ 成长概览(8.2,D1 + 概览化):职业画像版本 / 最新岗位匹配度 / 任务完成计数 +
              完整报告深链(区块内入口;真实趋势在报告页) */}
          <GrowthBlock />
        </>
      )}
    </>
  );
}
