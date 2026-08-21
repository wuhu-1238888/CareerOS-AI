// 简历解析管线(4.3):原文 → Orchestrator(Resume Parse Agent)→ 写 Resume.parsedData。
// 关键决策(与画像/路线图管线一致):生命周期进度事件经 onRunProgress 实时写入 AgentRun.progress(客户端轮询/刷新恢复);
// 成功才写 parsedData,失败不落(保留旧解析结果);送 LLM 文本截断 20000 字符(DB 存全文)。
// 4.4 起追加 rewriteResume,4.6 起追加 scoreAts。
import type { Prisma } from "@prisma/client";
import { Orchestrator, orchestrator } from "@/lib/orchestration/orchestrator";
import { prisma } from "@/lib/db/prisma";
import type { LLMAdapter } from "@/lib/llm/adapter";
import type { AgentProgress } from "@/lib/agents/types";
import type { ParsedResume } from "@/lib/resume/analysis-schemas";
import { parsedResumeSchema } from "@/lib/resume/analysis-schemas";
import "@/lib/agents"; // 副作用:登记 Resume Parse Agent(intent: parse-resume)

export type { ParsedResume };

// 送 LLM 的文本上限(DB 存全文;超长截断避免超上下文窗口)
export const MAX_RESUME_TEXT_FOR_LLM = 20000;

// 防御解析(4.3):parsedData Json 列不直接信任数据库原始 JSON,损坏/缺失 → null(展示层按未解析处理)
export function parseParsedData(value: unknown): ParsedResume | null {
  const parsed = parsedResumeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export type ParseResumeOutcome =
  | { ok: true; resumeId: string; runId: string; parsed: ParsedResume }
  | { ok: false; error: string; runId: string };

export async function parseResume(params: {
  userId: string;
  resumeId: string;
  resumeText: string;
  /** 测试注入用;缺省走全局 llm */
  adapter?: LLMAdapter;
}): Promise<ParseResumeOutcome> {
  const { userId, resumeId, resumeText, adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  // 进度写库串行化(同画像/路线图管线):事件同步连发,读-改-写不排队会互相覆盖
  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<ParsedResume>({
    intent: "parse-resume",
    // resumeId 一并落 AgentRun.input 供 retryParse 重放定位;Agent inputSchema 会剔除多余字段
    input: { resumeText: resumeText.slice(0, MAX_RESUME_TEXT_FOR_LLM), resumeId },
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

  await prisma.resume.update({
    where: { id: resumeId },
    data: { parsedData: outcome.result.data as Prisma.InputJsonValue },
  });

  return { ok: true, resumeId, runId: outcome.runId, parsed: outcome.result.data };
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
