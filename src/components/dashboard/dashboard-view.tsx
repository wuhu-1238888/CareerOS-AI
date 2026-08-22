"use client";
// 工作台(5.1,DesignRules Dashboard):问候行 → KPI 行 → Agent 顾问区 → 模块入口区。
// 四态齐全:加载 = 与真实布局同尺寸骨架屏(零位移);空 = 新用户引导空态(主 CTA「开始职业探索」);
// 错误 = 友好错误卡 + 重试;内容 = 有数据用户的完整工作台。
// 数据源:dashboard.stats 单次聚合(任一 Agent 运行中时 700ms 轮询,与分析页同节奏)。
// 2.7 画像过期提示(>7 天)保留在问候行,不随重构丢失。首屏 4 个区块 ≤7 组件;无聊天窗/无拟人化/无平台公告(禁令走查)。
import Link from "next/link";
import { FileText, Route, Search, UserRound } from "lucide-react";
import { trpc } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { StatCard, type StatDelta } from "./stat-card";
import { AgentCard } from "./agent-card";
import { ModuleCard } from "./module-card";

// 决策 5(2.7 沿用):画像信息超过 7 天视为过时(「信息有变化」的可操作判据,常量可调)
const STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

// 加载态骨架:与真实布局同尺寸(问候行 → KPI 4 卡 → Agent 3 卡 → 模块 3 卡),零布局位移
function DashboardSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="space-y-3">
        <div className="h-8 w-44 rounded-control bg-sunken" />
        <div className="h-4 w-72 rounded-control bg-sunken" />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-card bg-sunken" />
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-44 rounded-card bg-sunken" />
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-36 rounded-card bg-sunken" />
        ))}
      </div>
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
  const weekDelta: StatDelta | null =
    data.weekTasks.delta != null
      ? {
          text: `较上周 ${data.weekTasks.delta > 0 ? "+" : ""}${data.weekTasks.delta}`,
          trend: data.weekTasks.delta >= 0 ? "up" : "down",
        }
      : null;

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
          {/* ② KPI 行:匹配度 / 路线图进度 / 简历版本数 / 本周任务(大数字 + 增量徽章) */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="匹配度"
              value={data.profile.matchScore != null ? String(data.profile.matchScore) : "—"}
              delta={matchDelta}
            />
            <StatCard
              label="路线图进度"
              value={data.roadmap.progress != null ? `${data.roadmap.progress}%` : "—"}
            />
            <StatCard label="简历版本数" value={String(data.resume.versionCount)} />
            <StatCard
              label="本周任务"
              value={String(data.weekTasks.completed)}
              delta={weekDelta}
            />
          </div>

          {/* ③ Agent 顾问区:三个 Agent 卡(状态 + 最近产出,点击进入模块) */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <AgentCard
              name="画像顾问"
              description="分析你的背景,生成职业画像"
              icon={Search}
              agent={data.agents.profile}
              latestOutput={
                data.profile.analyzed
                  ? `画像 v${data.profile.version} · ${data.profile.directionCount} 个推荐方向`
                  : null
              }
              href="/profile"
            />
            <AgentCard
              name="规划顾问"
              description="把目标拆解成可执行的成长路线"
              icon={Route}
              agent={data.agents.roadmap}
              latestOutput={
                data.roadmap.exists
                  ? `路线图 ${data.roadmap.stageCount} 个阶段 · 进度 ${data.roadmap.progress}%`
                  : null
              }
              href="/navigator"
            />
            <AgentCard
              name="简历顾问"
              description="解析并优化你的简历,适配目标方向"
              icon={FileText}
              agent={data.agents.resume}
              latestOutput={
                data.resume.versionCount > 0
                  ? `优化 ${data.resume.versionCount} 个版本 · 最近:${data.resume.latestFileName ?? "简历"}`
                  : data.resume.fileCount > 0
                    ? `已解析 ${data.resume.fileCount} 份简历,开始优化`
                    : null
              }
              href="/resume"
            />
          </div>

          {/* ④ 模块入口区:三个模块快捷卡(最新进展 + 继续上次) */}
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <ModuleCard
              title="职业画像"
              icon={UserRound}
              progress={
                data.profile.analyzed
                  ? `画像 v${data.profile.version} · ${data.profile.directionCount} 个推荐方向 · 更新于 ${formatDate(data.profile.updatedAt ?? "")}`
                  : "完成画像分析,获得推荐方向与专属建议"
              }
              href="/profile"
              actionLabel={data.profile.analyzed ? "继续上次" : "去完成"}
            />
            <ModuleCard
              title="成长路线"
              icon={Route}
              progress={
                data.roadmap.exists
                  ? `总进度 ${data.roadmap.progress}% · ${data.roadmap.completed}/${data.roadmap.total} 任务完成`
                  : "生成你的专属成长路线,把目标变成看得见的阶梯"
              }
              href="/navigator"
              actionLabel={data.roadmap.exists ? "继续上次" : "去生成"}
            />
            <ModuleCard
              title="简历优化"
              icon={FileText}
              progress={
                data.resume.fileCount > 0
                  ? `最近:${data.resume.latestFileName ?? "简历"} · ${data.resume.versionCount} 个优化版本`
                  : "上传或粘贴简历,开始针对性优化"
              }
              href="/resume"
              actionLabel={data.resume.fileCount > 0 ? "继续上次" : "去上传"}
            />
          </div>
        </>
      )}
    </>
  );
}
