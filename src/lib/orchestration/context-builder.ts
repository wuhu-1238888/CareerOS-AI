// 全局上下文派生组装(8.1a):各 Agent 的产出各自落域表(画像版本行、路线图、AgentRun 日志),
// 上下文不另建表 —— 管线启动时从域表派生组装「当前用户 + 最新画像版本 + 当前路线图 +
// 各 Agent 最近成功产出摘要」,信封沿用 1.6 预留结构(buildContext:version/sourceAgent/generatedAt/data)。
// 「Agent 完成后写入自己产出的部分」= 写自身域模型;下一个 Agent 启动时在此读到(单一事实源,无第二份状态)。
// 新用户无画像/路线图 → 对应分区为 null,不抛错(管线继续走各自的无画像降级路径)。
import type { PrismaClient } from "@prisma/client";
import { buildContext, type GlobalContext } from "./context";

/** 单个 Agent 分区保留的最近成功产出条数(防 AgentRun 历史膨胀进上下文) */
export const CONTEXT_AGENT_OUTPUT_LIMIT = 3;
/** 参与分区的最近成功 run 扫描上限(先取最近时间窗再按 Agent 分组,避免全表扫历史) */
const AGENT_RUN_SCAN_LIMIT = 30;

export interface AgentOutputSummary {
  agentName: string;
  intent: string | null;
  runId: string;
  createdAt: string;
  output: unknown;
}

// type 别名:需直接放进 buildContext 的 data(Record<string, unknown>),interface 缺索引签名会报错
export type UserContextData = {
  userId: string;
  /** 最新画像(版本号 + 推荐方向,匹配度降序);无画像 → null */
  profile: { version: number; directions: string[] } | null;
  /** 当前路线图(替换式,仅最新一份);无路线图 → null */
  roadmap: {
    targetDirection: string;
    currentStage: string | null;
    completedTasks: number;
    totalTasks: number;
  } | null;
  /** 各 Agent 近 N 条 succeeded 产出摘要(按 agentName 分区,分区内 createdAt 降序) */
  agentOutputs: AgentOutputSummary[];
};

export async function buildUserContext(
  db: PrismaClient,
  userId: string,
  sourceAgent: string
): Promise<GlobalContext> {
  const [profileRow, roadmapRow, recentRuns] = await Promise.all([
    db.careerProfile.findFirst({
      where: { userId },
      orderBy: { version: "desc" },
      include: { careerPaths: { orderBy: { matchScore: "desc" } } },
    }),
    db.roadmap.findFirst({
      where: { userId },
      include: { stages: { include: { tasks: true } } },
    }),
    db.agentRun.findMany({
      where: { userId, status: "succeeded" },
      orderBy: { createdAt: "desc" },
      take: AGENT_RUN_SCAN_LIMIT,
      select: { id: true, agentName: true, intent: true, createdAt: true, output: true },
    }),
  ]);

  const tasks = roadmapRow?.stages.flatMap((stage) => stage.tasks) ?? [];
  // 分区封顶:按 agentName 分组,组内保留最新 CONTEXT_AGENT_OUTPUT_LIMIT 条(查询已按时间降序)
  const agentOutputs: AgentOutputSummary[] = Object.values(
    recentRuns.reduce<Record<string, AgentOutputSummary[]>>((byAgent, run) => {
      const zone = (byAgent[run.agentName] ??= []);
      if (zone.length < CONTEXT_AGENT_OUTPUT_LIMIT) {
        zone.push({
          agentName: run.agentName,
          intent: run.intent,
          runId: run.id,
          createdAt: run.createdAt.toISOString(),
          output: run.output,
        });
      }
      return byAgent;
    }, {})
  ).flat();

  const data: UserContextData = {
    userId,
    profile: profileRow
      ? {
          version: profileRow.version,
          directions: profileRow.careerPaths.map((path) => path.directionName),
        }
      : null,
    roadmap: roadmapRow
      ? {
          targetDirection: roadmapRow.targetDirection,
          currentStage: roadmapRow.currentStage,
          completedTasks: tasks.filter((task) => task.status === "completed").length,
          totalTasks: tasks.length,
        }
      : null,
    agentOutputs,
  };
  return buildContext(sourceAgent, data);
}
