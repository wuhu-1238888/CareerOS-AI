// 技能教练管线(6.3):差距清单 + 能力基线 + 周时 → Orchestrator(Skill Coach Agent)→ JobMatch 行按列 upsert。
// 关键决策(与匹配管线对称,prisma/schema.prisma 偏差 5):本管线只写自己的列(coachPlan/weeklyHours),
// 绝不整体替换,避免抹掉 matchReport。
// 落库前双重校验:① echo 交叉校验(输出 weeklyHours ≠ 输入 → ok:false 不落库,防模型私自改动预算)
// ② resources 免费前置排序(免费资源靠前的展示约定)。
import type { Prisma } from "@prisma/client";
import { Orchestrator, orchestrator } from "@/lib/orchestration/orchestrator";
import { prisma } from "@/lib/db/prisma";
import type { LLMAdapter } from "@/lib/llm/adapter";
import type { AgentProgress } from "@/lib/agents/types";
import type { CoachPlan } from "@/lib/coach/analysis-schemas";
import type { CoachAgentInput } from "@/lib/agents/coach.agent";
import type { MatchAnalysis } from "@/lib/matching/analysis-schemas";
import "@/lib/agents"; // 副作用:登记 Skill Coach Agent(intent: build-coach-plan)

// 匹配报告 → 教练差距清单组装(6.4,router 层「一键发起」调用;纯函数便于测试):
// 只取有对比条目的要求;gap 由对比状态映射(不足→大/接近→中/达标→小);
// name 截断到教练输入上限 100 字;最多 15 条(教练输入 Schema 上限)。
export function coachRequirementsFromReport(
  report: MatchAnalysis
): { name: string; importance: number; gap: "大" | "中" | "小" }[] {
  const gapByStatus = { 不足: "大", 接近: "中", 达标: "小" } as const;
  const statusByReq = new Map(report.items.map((item) => [item.requirementId, item.status]));
  return report.requirements
    .filter((r) => statusByReq.has(r.id))
    .map((r) => ({
      name: r.text.slice(0, 100),
      importance: r.importance,
      gap: gapByStatus[statusByReq.get(r.id)!],
    }))
    .slice(0, 15);
}

export type RunCoachPlanOutcome =
  | { ok: true; runId: string; plan: CoachPlan }
  | { ok: false; error: string; runId: string };

export async function runCoachPlan(params: {
  userId: string;
  input: CoachAgentInput;
  /** 测试注入用;缺省走全局 llm(生产经 LLM_PROVIDER 切换) */
  adapter?: LLMAdapter;
}): Promise<RunCoachPlanOutcome> {
  const { userId, input, adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  // 进度写库串行化:生命周期事件同步连发,读-改-写不排队会互相覆盖(丢事件)
  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<CoachPlan>({
    intent: "build-coach-plan",
    input,
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

  // Orchestrator 已过 outputSchema 校验;此处做落库前业务校验
  const raw = outcome.result.data;

  // echo 交叉校验:模型必须原样回显用户每周投入(时间预算一致性的前提;不一致不落库,可重试)
  if (raw.weeklyHours !== input.weeklyHours) {
    return {
      ok: false,
      error: "AI 输出与提交的每周投入时间不一致,请重试",
      runId: outcome.runId,
    };
  }

  // 免费资源前置(6.4 资源卡展示约定:free 徽章排在 paid 前)
  const plan: CoachPlan = {
    ...raw,
    resources: [
      ...raw.resources.filter((r) => r.cost === "free"),
      ...raw.resources.filter((r) => r.cost === "paid"),
    ],
  };

  await prisma.jobMatch.upsert({
    where: { userId },
    create: { userId, coachPlan: plan, weeklyHours: input.weeklyHours },
    update: { coachPlan: plan, weeklyHours: input.weeklyHours },
  });

  return { ok: true, runId: outcome.runId, plan };
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
