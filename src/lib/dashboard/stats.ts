// 工作台聚合(5.1):KPI 行 / Agent 顾问区 / 模块入口卡的数据源,单次查询聚合。
// 纯读:不写库、不启动 Agent;Dashboard 页面在任一 Agent 运行中时每 700ms 轮询本查询。
// 「本周」边界按上海时区周一 00:00 划分 —— 产品面向中文用户,服务器时区(UTC/Vercel)与用户感知不同。
import type { PrismaClient } from "@prisma/client";
import { LLM_TIMEOUT_MS } from "@/lib/llm/adapter";
import { extractRunInputString } from "@/lib/agents/run-input";

const RUN_STALE_MS = LLM_TIMEOUT_MS + 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AgentStatusView = {
  /** idle = 从未运行;failed 含 running 超时判死(与 serializeRun 同口径) */
  status: "idle" | "running" | "succeeded" | "failed";
  lastRunAt: string | null;
  /** 最近一次运行的末条进度文案(运行中轮播 / 已完成展示产出) */
  lastMessage: string | null;
  /** run.progress 事件数(0-5),运行中进度条按 5 段推进(与分析视图同口径) */
  progressCount: number;
};

export type DashboardStats = {
  profile: {
    version: number | null;
    /** 是否已有 AI 分析结果(仅数据行无分析 = 表单已填未分析,引导继续完成) */
    analyzed: boolean;
    matchScore: number | null;
    /** 较上一次画像版本的最高匹配度差值(无上一版本 → null,不显示徽章) */
    matchScoreDelta: number | null;
    directionCount: number;
    topDirection: string | null;
    updatedAt: string | null;
  };
  roadmap: {
    exists: boolean;
    completed: number;
    total: number;
    /** 0-100;无路线图 → null */
    progress: number | null;
    stageCount: number;
    targetDirection: string | null;
  };
  resume: {
    fileCount: number;
    versionCount: number;
    latestFileName: string | null;
    latestAt: string | null;
    /** 最近工作简历 id(工作台「继续上次」深链目标):由简历类 run 的 input.resumeId 派生,回退最新创建行;无简历 → null */
    lastActivityId: string | null;
    /** 最近工作简历文件名(粘贴路径为空) */
    lastActivityFileName: string | null;
    /** 最近工作简历的优化版本数(按简历分组计数;无简历 → 0) */
    lastActivityVersionCount: number;
    /** 最近工作简历最新优化版本的待处理建议数(无简历/无版本 → null,KPI 显示「—」不伪造 0) */
    pendingCount: number | null;
  };
  weekTasks: {
    /** 本周完成的任务数(上海时区周一起) */
    completed: number;
    /** 较上周完成数差值(两周均为 0 → null,不显示徽章) */
    delta: number | null;
  };
  agents: {
    profile: AgentStatusView;
    roadmap: AgentStatusView;
    resume: AgentStatusView;
  };
};

// 上海时区「周」边界:返回 [本周一 00:00, 上周一 00:00](上海零点对应的 UTC 时刻)。
// Intl en-CA 输出 YYYY-MM-DD(上海当前日期)→ 按周一取整后再减 8 小时偏移(上海零点 = UTC 零点 - 8h),跨时区确定性可测。
export function shanghaiWeekStarts(now: Date): { thisWeek: Date; lastWeek: Date } {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  const shanghaiTodayUtc = Date.UTC(y!, m! - 1, d!); // 上海日历日期对应的 UTC 零点
  const daysSinceMonday = (new Date(shanghaiTodayUtc).getUTCDay() + 6) % 7; // 周一 = 0
  const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
  const thisWeek = shanghaiTodayUtc - daysSinceMonday * DAY_MS - SHANGHAI_OFFSET_MS;
  return { thisWeek: new Date(thisWeek), lastWeek: new Date(thisWeek - 7 * DAY_MS) };
}

// run.progress(Json)最后一条进度文案;防御解析(非数组/缺 message → null)
function lastProgressMessage(run: { progress: unknown } | null): string | null {
  if (!run || !Array.isArray(run.progress) || run.progress.length === 0) return null;
  const last = run.progress[run.progress.length - 1] as { message?: unknown };
  return typeof last.message === "string" ? last.message : null;
}

// running 超时判死:与 router serializeRun 同口径(3 分钟 LLM 超时 + 60s 缓冲)
function agentStatus(run: {
  status: string;
  updatedAt: Date;
} | null): AgentStatusView["status"] {
  if (!run) return "idle";
  if (run.status === "succeeded" || run.status === "failed") return run.status;
  const stale = run.status === "running" && Date.now() - run.updatedAt.getTime() > RUN_STALE_MS;
  return stale ? "failed" : "running";
}

export async function computeDashboardStats(
  prisma: PrismaClient,
  userId: string
): Promise<DashboardStats> {
  // 周边界只取一次(跨周一零点瞬间多次 new Date() 可能落进不同周)
  const { thisWeek, lastWeek } = shanghaiWeekStarts(new Date());
  const [profiles, roadmap, resumesCount, versionCount, resumes, resumeRuns, versionGroups, weekTasks, lastWeekTasks, profileRun, roadmapRun, resumeRun] =
    await Promise.all([
      // 最新 + 上一版本画像(匹配度增量基线;含推荐方向按匹配度降序)
      prisma.careerProfile.findMany({
        where: { userId },
        orderBy: { version: "desc" },
        take: 2,
        include: { careerPaths: { orderBy: { matchScore: "desc" } } },
      }),
      prisma.roadmap.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        include: {
          stages: { include: { tasks: { select: { status: true, completedAt: true } } } },
        },
      }),
      prisma.resume.count({ where: { userId } }),
      prisma.resumeVersion.count({ where: { resume: { userId } } }),
      // 全部简历行(id 集 + 最新行信息):latestFileName/latestAt 取 [0];id 集用于「最近工作简历」派生与悬空 id 护栏
      prisma.resume.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, fileName: true, createdAt: true },
      }),
      // 简历类 run 扫描(仅两列):派生「最近工作简历」(工作台深链),不做 take —— 悬空 id 需跳过继续向后找
      prisma.agentRun.findMany({
        where: { userId, intent: { in: ["parse-resume", "rewrite-resume", "score-ats"] } },
        orderBy: { createdAt: "desc" },
        select: { input: true, createdAt: true },
      }),
      // 按简历分组的优化版本计数(单查):「最近工作简历」的版本数展示
      prisma.resumeVersion.groupBy({
        by: ["resumeId"],
        where: { resume: { userId } },
        _count: { _all: true },
      }),
      prisma.task.count({
        where: { stage: { roadmap: { userId } }, status: "completed", completedAt: { gte: thisWeek } },
      }),
      prisma.task.count({
        where: {
          stage: { roadmap: { userId } },
          status: "completed",
          completedAt: { gte: lastWeek, lt: thisWeek },
        },
      }),
      prisma.agentRun.findFirst({
        where: { userId, intent: "analyze-profile" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.agentRun.findFirst({
        where: { userId, intent: "generate-roadmap" },
        orderBy: { createdAt: "desc" },
      }),
      prisma.agentRun.findFirst({
        where: { userId, intent: { in: ["parse-resume", "rewrite-resume", "score-ats"] } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const latest = profiles[0] ?? null;
  const prev = profiles[1] ?? null;

  // 最近工作简历(工作台「继续上次」深链目标):按时间倒序扫描简历类 run,取第一个 input.resumeId
  // 仍存在于当前简历集合的(成员检查 = 悬空 id 护栏 + 天然用户隔离);无有效 run → 回退最新创建行;无简历 → null。
  const latestResume = resumes[0] ?? null;
  const resumeById = new Map(resumes.map((r) => [r.id, r]));
  let lastActivity: { id: string; fileName: string | null } | null = null;
  for (const run of resumeRuns) {
    const resumeId = extractRunInputString(run.input, "resumeId");
    if (resumeId) {
      const row = resumeById.get(resumeId);
      if (row) {
        lastActivity = row;
        break;
      }
    }
  }
  lastActivity ??= latestResume;
  const versionCountByResume = new Map(versionGroups.map((g) => [g.resumeId, g._count._all]));
  const lastActivityVersionCount = lastActivity ? (versionCountByResume.get(lastActivity.id) ?? 0) : 0;
  // 待处理建议(工作台导航优化 P2):最近工作简历最新优化版本(createdAt desc,id desc 决胜)的
  // Optimization(status=pending)计数 —— 「最新版本」口径与结果页一致,旧版本遗留 pending 不计。
  // 依赖 lastActivity 派生结果 → 顺序追加一查(非 N+1);查询预算 = 12 并行 + 1 顺序。
  // 无简历/无版本 → null(KPI 显示「—」,不伪造 0)。
  const pendingCount = lastActivity
    ? await prisma.resumeVersion.findFirst({
        where: { resumeId: lastActivity.id },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { _count: { select: { optimizations: { where: { status: "pending" } } } } },
      })
    : null;
  const topScoreOf = (p: (typeof latest)) => {
    const top = p?.careerPaths[0];
    return top && typeof top.matchScore === "number" ? top.matchScore : null;
  };
  const currentScore = topScoreOf(latest);
  const prevScore = topScoreOf(prev);
  const matchScoreDelta = currentScore != null && prevScore != null ? currentScore - prevScore : null;

  const tasks = roadmap?.stages.flatMap((stage) => stage.tasks) ?? [];
  const completed = tasks.filter((task) => task.status === "completed").length;
  const roadmapProgress = roadmap ? (tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100)) : null;

  const weekCompleted = weekTasks;
  const delta = weekCompleted === 0 && lastWeekTasks === 0 ? null : weekCompleted - lastWeekTasks;

  const agentView = (run: {
    status: string;
    updatedAt: Date;
    createdAt: Date;
    progress: unknown;
  } | null): AgentStatusView => ({
    status: agentStatus(run),
    lastRunAt: run ? run.createdAt.toISOString() : null,
    lastMessage: lastProgressMessage(run),
    progressCount: Array.isArray(run?.progress) ? Math.min(run.progress.length, 5) : 0,
  });

  return {
    profile: {
      version: latest?.version ?? null,
      analyzed: latest?.aiAnalysis != null,
      matchScore: currentScore,
      matchScoreDelta,
      directionCount: latest?.careerPaths.length ?? 0,
      topDirection: latest?.careerPaths[0]?.directionName ?? null,
      updatedAt: latest ? latest.createdAt.toISOString() : null,
    },
    roadmap: {
      exists: !!roadmap,
      completed,
      total: tasks.length,
      progress: roadmapProgress,
      stageCount: roadmap?.stages.length ?? 0,
      targetDirection: roadmap?.targetDirection ?? null,
    },
    resume: {
      fileCount: resumesCount,
      versionCount,
      latestFileName: latestResume?.fileName ?? null,
      latestAt: latestResume ? latestResume.createdAt.toISOString() : null,
      lastActivityId: lastActivity?.id ?? null,
      lastActivityFileName: lastActivity?.fileName ?? null,
      lastActivityVersionCount,
      pendingCount: pendingCount?._count.optimizations ?? null,
    },
    weekTasks: { completed: weekCompleted, delta },
    agents: {
      profile: agentView(profileRun),
      roadmap: agentView(roadmapRun),
      resume: agentView(resumeRun),
    },
  };
}
