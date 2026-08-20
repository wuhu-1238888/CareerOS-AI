// 成长路线生成管线(3.4):方向 + 能力标签 + 周时 + 阶段自评 → Orchestrator(Navigator Agent)→ 替换式落库。
// 关键决策(与画像管线一致):生命周期进度事件经 onRunProgress 实时写入 AgentRun.progress(客户端轮询/刷新恢复);
// 路线图不做版本化,每次生成整体替换(事务内删旧建新,失败不落行);任务行由阶段内容派生(学习内容→「学习」、
// 实践项目→「实践项目」,description 取项目标题,产出物保留在 content Json)。
import type { Prisma } from "@prisma/client";
import { Orchestrator, orchestrator } from "@/lib/orchestration/orchestrator";
import { prisma } from "@/lib/db/prisma";
import type { LLMAdapter } from "@/lib/llm/adapter";
import type { AgentProgress } from "@/lib/agents/types";
import type { RoadmapAnalysis, RoadmapStage, RoadmapSummary, StageContent } from "@/lib/navigator/analysis-schemas";
import { roadmapSummarySchema, stageContentSchema } from "@/lib/navigator/analysis-schemas";
import "@/lib/agents"; // 副作用:登记 Navigator Agent(intent: generate-roadmap)

export type { StageContent };

export type NavigatorGenerateInput = {
  direction: string;
  weeklyHours: number;
  currentStage: string;
};

export type GenerateRoadmapOutcome =
  | { ok: true; roadmapId: string; runId: string; analysis: RoadmapAnalysis }
  | { ok: false; error: string; runId: string };

// 防御解析(3.4):content Json 列不直接信任数据库原始 JSON,损坏/缺失 → null(展示层按空内容处理)
export function parseStageContent(value: unknown): StageContent | null {
  const parsed = stageContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseRoadmapSummary(value: unknown): RoadmapSummary | null {
  const parsed = roadmapSummarySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// 阶段 → 任务行派生:学习内容(type 学习)在前,实践项目(type 实践项目,description 取标题)在后,order 连续
function deriveTasks(stage: RoadmapStage) {
  const rows = [
    ...stage.learningContent.map((description) => ({ description, type: "学习" })),
    ...stage.practiceProjects.map((project) => ({ description: project.title, type: "实践项目" })),
  ];
  return rows.map((row, index) => ({ ...row, status: "pending" as const, order: index + 1 }));
}

// 阶段 content 落库形状:名称/目标/时长进列,内容细节(含项目产出物)进 Json
function stageContentJson(stage: RoadmapStage): Prisma.InputJsonValue {
  return {
    learningContent: stage.learningContent,
    practiceProjects: stage.practiceProjects,
    resources: stage.resources,
    checkpoints: stage.checkpoints,
  };
}

export async function generateRoadmap(params: {
  userId: string;
  input: NavigatorGenerateInput;
  /** 运行时从最新画像读取(不落 Roadmap 表);无画像 → [] */
  abilityTags?: { name: string; level: string }[];
  /** 测试注入用;缺省走全局 llm */
  adapter?: LLMAdapter;
}): Promise<GenerateRoadmapOutcome> {
  const { userId, input, abilityTags = [], adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  // 进度写库串行化(同画像管线):事件同步连发,读-改-写不排队会互相覆盖
  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<RoadmapAnalysis>({
    intent: "generate-roadmap",
    input: { ...input, abilityTags },
    context: {},
    userId,
    onRunProgress: (runId, progress: AgentProgress) => {
      progressChain.current = progressChain.current.then(() => appendProgress(runId, progress));
    },
  });
  await progressChain.current;

  if (!outcome.ok) {
    return outcome;
  }

  const analysis = outcome.result.data;

  // 替换式落库:事务内删除旧路线图(级联阶段/任务)后重建,失败整体回滚
  const profile = await prisma.careerProfile.findFirst({
    where: { userId },
    orderBy: { version: "desc" },
    select: { id: true },
  });

  const roadmap = await prisma.$transaction(async (tx) => {
    await tx.roadmap.deleteMany({ where: { userId } });
    const created = await tx.roadmap.create({
      data: {
        userId,
        profileId: profile?.id ?? null,
        targetDirection: input.direction,
        weeklyHours: input.weeklyHours,
        currentStage: input.currentStage,
        summary: analysis.summary,
      },
    });
    for (let index = 0; index < analysis.stages.length; index++) {
      const stage = analysis.stages[index]!;
      await tx.stage.create({
        data: {
          roadmapId: created.id,
          name: stage.name,
          goal: stage.goal,
          order: index + 1,
          estimatedDuration: stage.estimatedDuration,
          content: stageContentJson(stage),
          tasks: { create: deriveTasks(stage) },
        },
      });
    }
    return created;
  });

  return { ok: true, roadmapId: roadmap.id, runId: outcome.runId, analysis };
}

// 单阶段重生成(3.5):反馈(太难了/已经会了)→ Orchestrator(Navigator Stage Agent)→ 原地更新该阶段。
// 名称/目标/时长/content 与任务全量替换(任务状态重置为 pending——「重生成」的固有语义),其余阶段不动;
// 失败不落行(事务外,阶段保持原状)。
export type RegenerateStageOutcome =
  | { ok: true; stageId: string; runId: string; stage: RoadmapStage }
  | { ok: false; error: string; runId: string };

export async function regenerateStage(params: {
  userId: string;
  stageId: string;
  input: NavigatorGenerateInput;
  /** 原阶段(供 Agent 参考与重写):name 必填,content 可能为 null(防御解析失败时传 {}) */
  stage: { name: string; content: StageContent | null };
  feedback: "太难了" | "已经会了";
  abilityTags?: { name: string; level: string }[];
  /** 测试注入用;缺省走全局 llm */
  adapter?: LLMAdapter;
}): Promise<RegenerateStageOutcome> {
  const { userId, stageId, input, stage, feedback, abilityTags = [], adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<RoadmapStage>({
    intent: "regenerate-stage",
    input: {
      ...input,
      abilityTags,
      stageName: stage.name,
      stageContent: stage.content ?? {},
      feedback,
    },
    context: {},
    userId,
    onRunProgress: (runId, progress: AgentProgress) => {
      progressChain.current = progressChain.current.then(() => appendProgress(runId, progress));
    },
  });
  await progressChain.current;

  if (!outcome.ok) {
    return outcome;
  }

  const next = outcome.result.data;
  await prisma.$transaction(async (tx) => {
    await tx.stage.update({
      where: { id: stageId },
      data: {
        name: next.name,
        goal: next.goal,
        estimatedDuration: next.estimatedDuration,
        content: stageContentJson(next),
        tasks: { deleteMany: {}, create: deriveTasks(next) },
      },
    });
  });

  return { ok: true, stageId, runId: outcome.runId, stage: next };
}

// 进度追加落库:同一 run 的事件顺序到达,读-改-写安全(唯一写入方为当前管线调用)
async function appendProgress(runId: string, progress: AgentProgress) {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    select: { progress: true },
  });
  const current = Array.isArray(run?.progress)
    ? (run.progress as unknown as AgentProgress[])
    : [];
  await prisma.agentRun.update({
    where: { id: runId },
    data: { progress: [...current, progress] as unknown as Prisma.InputJsonValue },
  });
}
