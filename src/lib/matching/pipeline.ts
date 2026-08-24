// 岗位匹配管线(6.1):JD + 画像/简历 → Orchestrator(Matching Agent)→ JobMatch 行按列 upsert。
// 关键决策:matchReport 与 coachPlan 由两条独立管线先后写入同一行 → 本管线只写自己的列
// (jdText/jdTitle/matchReport),绝不整体替换,避免抹掉 coachPlan(prisma/schema.prisma 偏差 5)。
// 无画像降级:Agent 级安全网 —— profileSummary 为 null 时归一化 items=[]、overallScore=null、
// recommendation=null、resumeSuggestions=[],UI 渲染「仅拆解」形态。
import type { Prisma } from "@prisma/client";
import { Orchestrator, orchestrator } from "@/lib/orchestration/orchestrator";
import * as contextBuilder from "@/lib/orchestration/context-builder";
import { prisma } from "@/lib/db/prisma";
import type { LLMAdapter } from "@/lib/llm/adapter";
import type { AgentProgress } from "@/lib/agents/types";
import type { MatchAnalysis } from "@/lib/matching/analysis-schemas";
import "@/lib/agents"; // 副作用:登记 Matching Agent(intent: analyze-match)

export type MatchCorrectionFeedback = {
  requirementId: string;
  note: string;
};

export type RunMatchOutcome =
  | { ok: true; runId: string; analysis: MatchAnalysis }
  | { ok: false; error: string; runId: string };

export async function runMatch(params: {
  userId: string;
  jdText: string;
  profileSummary?: string | null;
  optimizedResumeText?: string | null;
  feedback?: MatchCorrectionFeedback[];
  /** 测试注入用;缺省走全局 llm(生产经 LLM_PROVIDER 切换) */
  adapter?: LLMAdapter;
}): Promise<RunMatchOutcome> {
  const { userId, jdText, profileSummary, optimizedResumeText, feedback, adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  // 进度写库串行化:生命周期事件同步连发,读-改-写不排队会互相覆盖(丢事件)
  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<MatchAnalysis>({
    intent: "analyze-match",
    input: { jdText, profileSummary: profileSummary ?? null, optimizedResumeText: optimizedResumeText ?? null, feedback },
    context: await contextBuilder.buildUserContext(prisma, userId, "job-matching-agent"),
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

  // Orchestrator 已过 outputSchema 校验;无画像时归一化为「仅拆解」形态
  const raw = outcome.result.data;
  const analysis: MatchAnalysis =
    profileSummary == null
      ? { ...raw, items: [], overallScore: null, recommendation: null, resumeSuggestions: [] }
      : raw;

  await prisma.jobMatch.upsert({
    where: { userId },
    create: { userId, jdText, jdTitle: analysis.positionTitle, matchReport: analysis },
    update: { jdText, jdTitle: analysis.positionTitle, matchReport: analysis },
  });

  return { ok: true, runId: outcome.runId, analysis };
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
