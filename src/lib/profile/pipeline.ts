// 画像分析管线(2.4):表单数据 → Orchestrator(Profile Agent)→ 新版本行 + 推荐方向重建。
// 关键决策:每次分析(首建/纠偏/更新)全量重算并产生新版本(version = max+1,parentVersion = 上一版本 id),
// 旧版本不可变、可查看(2.6/2.7 依赖);生命周期进度事件经 onRunProgress 实时写入 AgentRun.progress,
// 客户端轮询读取(分析中刷新页面可恢复)。
import type { Prisma } from "@prisma/client";
import { Orchestrator, orchestrator } from "@/lib/orchestration/orchestrator";
import { prisma } from "@/lib/db/prisma";
import type { LLMAdapter } from "@/lib/llm/adapter";
import type { AgentProgress } from "@/lib/agents/types";
import type { ProfileAnalysis } from "@/lib/agents/profile.agent";
import type { ProfileData } from "./schemas";
import "@/lib/agents"; // 副作用:登记 Profile Agent(intent: analyze-profile)

export type CorrectionFeedback = {
  areas: ("direction" | "ability" | "strength")[];
  note?: string;
};

export type AnalyzeProfileOutcome =
  | { ok: true; profileId: string; version: number; runId: string; analysis: ProfileAnalysis }
  | { ok: false; error: string; runId: string };

export async function analyzeProfile(params: {
  userId: string;
  data: ProfileData;
  feedback?: CorrectionFeedback;
  /** 测试注入用;缺省走全局 llm(生产经 LLM_PROVIDER 切换) */
  adapter?: LLMAdapter;
}): Promise<AnalyzeProfileOutcome> {
  const { userId, data, feedback, adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  // 进度写库串行化:生命周期事件同步连发,读-改-写不排队会互相覆盖(丢事件)
  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<ProfileAnalysis>({
    intent: "analyze-profile",
    input: { ...data, feedback },
    context: {},
    userId,
    onRunProgress: (runId, progress: AgentProgress) => {
      progressChain.current = progressChain.current.then(() => appendProgress(runId, progress));
    },
  });
  // 返回前等待进度全部落库(调用方随后查询能看到完整 5 条事件)
  await progressChain.current;

  if (!outcome.ok) {
    return outcome;
  }

  // Orchestrator 已过 outputSchema 校验;此处取最终数据落库
  const analysis = outcome.result.data;

  const previous = await prisma.careerProfile.findFirst({
    where: { userId },
    orderBy: { version: "desc" },
  });
  const version = (previous?.version ?? 0) + 1;

  const profile = await prisma.careerProfile.create({
    data: {
      userId,
      version,
      parentVersion: previous?.version ?? null,
      education: data.education,
      skills: data.skills,
      experiences: data.experiences,
      interests: data.interests,
      targets: data.targets,
      aiAnalysis: analysis,
    },
  });

  // 推荐方向全量重建(每次分析整体替换,非增量 —— implementation-plan 2.6 已确认)
  await prisma.careerPath.deleteMany({ where: { profileId: profile.id } });
  await prisma.careerPath.createMany({
    data: analysis.directions.map((direction) => ({
      profileId: profile.id,
      directionName: direction.name,
      matchScore: direction.matchScore,
      strengths: direction.strengths,
      weaknesses: direction.weaknesses,
    })),
  });

  return { ok: true, profileId: profile.id, version, runId: outcome.runId, analysis };
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
