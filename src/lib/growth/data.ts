// 成长数据层(8.2):个人成长报告与匿名聚合的派生读取 —— 画像版本演进(CareerProfile 全版本行 +
// 相邻版本差异)、任务完成趋势(近 N 周周界计数)、匹配度变化曲线(AgentRun 成功日志,JobMatch 单行无历史)、
// 路径有效性聚合(按推荐方向分组的平均阶段达成率,仅脱敏输出)。
// 纯读:不写库、不启动 Agent。数据边界:路线图为替换式(生成时删旧建新)→ 任务完成历史仅覆盖
// 当前路线图(遗留,见 progress.md);聚合组内用户数 < MIN_AGGREGATE_USERS 不返回该组(隐私下限)。
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { profileAnalysisSchema, type ProfileRadar } from "@/lib/profile/analysis-schemas";
import {
  diffAbilityTags,
  diffRadar,
  type AbilityLevel,
  type AbilityTagChange,
  type RadarDimDiff,
} from "@/lib/profile/profile-diff";
import { shanghaiWeekStarts } from "@/lib/dashboard/stats";

// 工作台区块与报告页的周桶窗口(近 8 周 / 近 12 周)
export const BLOCK_WEEKS = 8;
export const REPORT_WEEKS = 12;
// 聚合隐私下限:组内用户数不足则不返回该组(计划 8.2:样本不足展示引导而非报错)
export const MIN_AGGREGATE_USERS = 5;

const DAY_MS = 7 * 24 * 60 * 60 * 1000;

export type WeekBucket = {
  /** 该周起点(上海时区周一 00:00 对应的 UTC 时刻 ISO) */
  weekStart: string;
  /** 该周完成的任务数 */
  count: number;
};

export type GrowthBlock = {
  /** 画像版本数(0 = 无画像) */
  profileVersionCount: number;
  /** 最新画像版本号(区块展示「当前 V{n}」);无画像 → null */
  profileVersion: number | null;
  /** 最新匹配度(JobMatch.matchReport.overallScore,防御解析);无匹配/损坏 → null */
  latestMatchScore: number | null;
  /** 最近一次匹配时间(仅在匹配度存在时前端展示) */
  matchUpdatedAt: string | null;
  /** 近 8 周任务完成 sparkline(最早在前,当前周最后) */
  sparkline: WeekBucket[];
};

export type ProfileVersionPoint = {
  version: number;
  createdAt: string;
  /** 该版本六维雷达(aiAnalysis 防御解析);无/损坏 → null */
  radar: ProfileRadar | null;
  /** 该版本能力标签(aiAnalysis 防御解析);无/损坏 → null */
  abilityTags: { name: string; level: AbilityLevel }[] | null;
  /** 与上一版本差异(两版 radar/abilityTags 均解析成功时计算);首版无上一版本 → null */
  diff: { radar: RadarDimDiff[]; abilityTags: AbilityTagChange[] } | null;
};

export type MatchScorePoint = {
  /** 该次匹配 run 完成时间 */
  createdAt: string;
  overallScore: number;
};

export type GrowthReport = {
  /** 画像版本演进(版本升序,含相邻版本差异) */
  profileVersions: ProfileVersionPoint[];
  /** 任务完成趋势(近 12 周,最早在前) */
  taskTrend: WeekBucket[];
  /** 匹配度变化曲线(最近 20 条成功匹配,时间升序;无画像降级 run 不计入) */
  matchScores: MatchScorePoint[];
};

export type GrowthAggregateEntry = {
  /** 推荐方向名称(按用户最新画像最高匹配度路径分组) */
  direction: string;
  /** 组内用户数(>= MIN_AGGREGATE_USERS 才返回) */
  userCount: number;
  /** 组内平均阶段达成率(0-1,三位小数) */
  avgStageCompletion: number;
};

// 近 N 周(上海时区周界)的任务完成周桶:返回按时间升序的 [周起点, count] 序列。
// completedAt 属当前路线图任务(替换式路线图 → 历史仅覆盖当前,见文件头)。
async function taskCompletionByWeek(
  prisma: PrismaClient,
  userId: string,
  weeks: number,
  now: Date
): Promise<WeekBucket[]> {
  const { thisWeek } = shanghaiWeekStarts(now);
  const starts = Array.from(
    { length: weeks },
    (_, k) => new Date(thisWeek.getTime() - (weeks - 1 - k) * DAY_MS)
  );
  const earliest = starts[0]!;
  const tasks = await prisma.task.findMany({
    where: {
      stage: { roadmap: { userId } },
      status: "completed",
      completedAt: { gte: earliest },
    },
    select: { completedAt: true },
  });
  const counts = new Array<number>(weeks).fill(0);
  for (const task of tasks) {
    if (!task.completedAt) continue;
    const idx = Math.floor(
      (task.completedAt.getTime() - thisWeek.getTime() + (weeks - 1) * DAY_MS) / DAY_MS
    );
    // 超出窗口(时钟偏差)不计;窗口内(查询已保证 >= earliest)按周归桶
    if (idx < 0 || idx >= weeks) continue;
    counts[idx] = (counts[idx] ?? 0) + 1;
  }
  return starts.map((start, k) => ({ weekStart: start.toISOString(), count: counts[k] ?? 0 }));
}

// 匹配度防御解析:只取 overallScore(与 serializeJobMatch 的全量校验不同 —— 曲线只消费该字段,
// 报告其余部分损坏不影响曲线展示)。字段口径与 analysis-schemas.ts overallScore 一致
// (schema 含 superRefine 时为 ZodEffects,无 pick,故独立声明)。
const matchScoreSchema = z.object({ overallScore: z.number().int().min(0).max(100).nullable() });
// 版本演进只消费 aiAnalysis 的雷达与能力标签(其余字段损坏不影响时间线)
const versionAnalysisSchema = profileAnalysisSchema.pick({ radar: true, abilityTags: true });

export async function computeGrowthBlock(
  prisma: PrismaClient,
  userId: string,
  now: Date
): Promise<GrowthBlock> {
  const [versionCount, latestProfile, jobMatch, sparkline] = await Promise.all([
    prisma.careerProfile.count({ where: { userId } }),
    prisma.careerProfile.findFirst({
      where: { userId },
      orderBy: { version: "desc" },
      select: { version: true },
    }),
    prisma.jobMatch.findUnique({
      where: { userId },
      select: { matchReport: true, updatedAt: true },
    }),
    taskCompletionByWeek(prisma, userId, BLOCK_WEEKS, now),
  ]);
  const score = matchScoreSchema.safeParse(jobMatch?.matchReport);
  return {
    profileVersionCount: versionCount,
    profileVersion: latestProfile?.version ?? null,
    latestMatchScore: score.success && typeof score.data.overallScore === "number" ? score.data.overallScore : null,
    matchUpdatedAt: jobMatch ? jobMatch.updatedAt.toISOString() : null,
    sparkline,
  };
}

export async function computeGrowthReport(
  prisma: PrismaClient,
  userId: string,
  now: Date
): Promise<GrowthReport> {
  const [versions, taskTrend, runs] = await Promise.all([
    prisma.careerProfile.findMany({
      where: { userId },
      orderBy: { version: "asc" },
      select: { version: true, createdAt: true, aiAnalysis: true },
    }),
    taskCompletionByWeek(prisma, userId, REPORT_WEEKS, now),
    // 最近 20 条成功匹配 run(倒序取最新,再反转为时间升序曲线)
    prisma.agentRun.findMany({
      where: { userId, intent: "analyze-match", status: "succeeded" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { output: true, createdAt: true },
    }),
  ]);

  const profileVersions: ProfileVersionPoint[] = [];
  for (let i = 0; i < versions.length; i++) {
    const row = versions[i]!;
    const parsed = versionAnalysisSchema.safeParse(row.aiAnalysis);
    const radar = parsed.success ? parsed.data.radar : null;
    const abilityTags = parsed.success ? parsed.data.abilityTags : null;
    const prev = i > 0 ? profileVersions[i - 1]! : null;
    const diff =
      prev && radar && abilityTags && prev.radar && prev.abilityTags
        ? {
            radar: diffRadar(radar, prev.radar),
            abilityTags: diffAbilityTags(abilityTags, prev.abilityTags),
          }
        : null;
    profileVersions.push({
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      radar,
      abilityTags,
      diff,
    });
  }

  const matchScores = runs
    .map((run) => {
      const parsed = matchScoreSchema.safeParse(run.output);
      return parsed.success && typeof parsed.data.overallScore === "number"
        ? { createdAt: run.createdAt.toISOString(), overallScore: parsed.data.overallScore }
        : null;
    })
    .filter((p): p is MatchScorePoint => p !== null)
    .reverse();

  return { profileVersions, taskTrend, matchScores };
}

export async function computeGrowthAggregate(prisma: PrismaClient): Promise<GrowthAggregateEntry[]> {
  // 每用户最新画像版本(version desc,首次出现即最高版本)的推荐方向(最高匹配度路径)
  const profiles = await prisma.careerProfile.findMany({
    orderBy: { version: "desc" },
    select: {
      userId: true,
      careerPaths: { orderBy: { matchScore: "desc" }, select: { directionName: true } },
    },
  });
  const directionByUser = new Map<string, string>();
  for (const profile of profiles) {
    if (directionByUser.has(profile.userId)) continue;
    const top = profile.careerPaths[0]?.directionName;
    if (top) directionByUser.set(profile.userId, top);
  }
  if (directionByUser.size === 0) return [];

  // 各用户阶段达成率:已完成阶段(有任务且全部完成)/ 总阶段;无路线图用户不参与聚合
  const roadmaps = await prisma.roadmap.findMany({
    select: { userId: true, stages: { select: { tasks: { select: { status: true } } } } },
  });
  const attainment = new Map<string, { completed: number; total: number }>();
  for (const roadmap of roadmaps) {
    const state = attainment.get(roadmap.userId) ?? { completed: 0, total: 0 };
    for (const stage of roadmap.stages) {
      state.total++;
      if (stage.tasks.length > 0 && stage.tasks.every((task) => task.status === "completed")) {
        state.completed++;
      }
    }
    attainment.set(roadmap.userId, state);
  }

  // 按方向分组平均;组内用户数 < MIN_AGGREGATE_USERS 不返回(样本不足保护)
  const groups = new Map<string, number[]>();
  for (const [userId, direction] of Array.from(directionByUser.entries())) {
    const state = attainment.get(userId);
    if (!state || state.total === 0) continue;
    const ratios = groups.get(direction) ?? [];
    ratios.push(state.completed / state.total);
    groups.set(direction, ratios);
  }
  return Array.from(groups.entries())
    .filter(([, ratios]) => ratios.length >= MIN_AGGREGATE_USERS)
    .map(([direction, ratios]) => ({
      direction,
      userCount: ratios.length,
      avgStageCompletion: Number(
        (ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length).toFixed(3)
      ),
    }))
    .sort((a, b) => b.userCount - a.userCount);
}
