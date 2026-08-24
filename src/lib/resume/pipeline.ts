// 简历解析管线(4.3):原文 → Orchestrator(Resume Parse Agent)→ 写 Resume.parsedData。
// 关键决策(与画像/路线图管线一致):生命周期进度事件经 onRunProgress 实时写入 AgentRun.progress(客户端轮询/刷新恢复);
// 成功才写 parsedData,失败不落(保留旧解析结果);送 LLM 文本截断 20000 字符(DB 存全文)。
// 4.4 起追加 rewriteResume,4.6 起追加 scoreAts(规则分 + LLM 分项合成落库)。
import type { Prisma } from "@prisma/client";
import { Orchestrator, orchestrator } from "@/lib/orchestration/orchestrator";
import * as contextBuilder from "@/lib/orchestration/context-builder";
import { prisma } from "@/lib/db/prisma";
import type { LLMAdapter } from "@/lib/llm/adapter";
import type { AgentProgress } from "@/lib/agents/types";
import type {
  AtsLlmAnalysis,
  AtsReport,
  ParsedResume,
  RewriteAnalysis,
} from "@/lib/resume/analysis-schemas";
import { parsedResumeSchema } from "@/lib/resume/analysis-schemas";
import { scoreRuleSubscores, synthesizeAtsScore } from "@/lib/resume/ats-rules";
import { validateModifications } from "@/lib/resume/final-text";
import "@/lib/agents"; // 副作用:登记简历 Agent(parse-resume / rewrite-resume / score-ats)

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
    context: await contextBuilder.buildUserContext(prisma, userId, "resume-parse-agent"),
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

export type RewriteResumeOutcome =
  | { ok: true; versionId: string; runId: string; modificationCount: number }
  | { ok: false; error: string; runId: string };

export async function rewriteResume(params: {
  userId: string;
  resumeId: string;
  /** 核对后的解析结果(用户修正优先,已由 router 侧 saveParsedData 落库) */
  parsedData: ParsedResume;
  abilityTags: { name: string; level: string }[];
  targetDirection: string;
  /** 测试注入用;缺省走全局 llm */
  adapter?: LLMAdapter;
}): Promise<RewriteResumeOutcome> {
  const { userId, resumeId, parsedData, abilityTags, targetDirection, adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    select: { originalText: true },
  });
  if (!resume?.originalText) {
    // router 侧已挡 BAD_REQUEST;此处兜底(管线直调场景),无 run 时 runId 为空串(同 Orchestrator 契约)
    return { ok: false, error: "简历原文缺失,请重新上传或粘贴简历内容", runId: "" };
  }

  // 进度写库串行化(同解析管线)
  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<RewriteAnalysis>({
    intent: "rewrite-resume",
    // resumeId 一并落 AgentRun.input 供前端按简历行归属判断;Agent inputSchema 会剔除多余字段;
    // originalText 为引用片段逐字摘抄的唯一来源(本次修复:此前 Agent 收不到原文,引用必然校验失败)
    input: {
      resumeId,
      originalText: resume.originalText.slice(0, MAX_RESUME_TEXT_FOR_LLM),
      parsedData,
      abilityTags,
      targetDirection,
    },
    context: await contextBuilder.buildUserContext(prisma, userId, "resume-rewrite-agent"),
    userId,
    onRunProgress: (runId, progress: AgentProgress) => {
      progressChain.current = progressChain.current.then(() => appendProgress(runId, progress));
    },
  });
  await progressChain.current;

  if (!outcome.ok) {
    return outcome;
  }

  // 硬校验(逐条过滤):每条 originalText 必须逐字存在于原文、区间互不重叠;无效条目丢弃,
  // 0 条有效 → 整次失败并落 failed run(刷新后失败视图可恢复,错误原因真实可见)
  const validated = validateModifications(resume.originalText, outcome.result.data.modifications);
  if (!validated.ok) {
    await prisma.agentRun.update({
      where: { id: outcome.runId },
      data: { status: "failed", error: validated.error },
    });
    return { ok: false, error: validated.error, runId: outcome.runId };
  }

  // 不可变快照:重新分析 = 新版本;事务内建版本 + 批量建议(order 按原文位置升序,status 默认 pending)
  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.resumeVersion.create({
      data: {
        resumeId,
        targetDirection,
        changes: {
          modificationCount: validated.modifications.length,
        } as unknown as Prisma.InputJsonValue,
      },
    });
    await Promise.all(
      validated.modifications.map((modification, index) =>
        tx.optimization.create({
          data: {
            resumeVersionId: created.id,
            category: modification.category,
            originalText: modification.originalText,
            optimizedText: modification.optimizedText,
            reason: modification.reason,
            order: index,
            status: "pending",
          },
        })
      )
    );
    return created;
  });

  return {
    ok: true,
    versionId: version.id,
    runId: outcome.runId,
    modificationCount: validated.modifications.length,
  };
}

export type ScoreAtsOutcome =
  | { ok: true; versionId: string; runId: string; report: AtsReport }
  | { ok: false; error: string; runId: string };

export async function scoreAts(params: {
  userId: string;
  versionId: string;
  /** 最终采纳文本(服务端由 accepted 片段合成,单一事实源) */
  finalText: string;
  targetDirection: string;
  /** 测试注入用;缺省走全局 llm */
  adapter?: LLMAdapter;
}): Promise<ScoreAtsOutcome> {
  const { userId, versionId, finalText, targetDirection, adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  // 进度写库串行化(同解析/改写管线)
  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<AtsLlmAnalysis>({
    intent: "score-ats",
    input: { finalText: finalText.slice(0, MAX_RESUME_TEXT_FOR_LLM), targetDirection },
    context: await contextBuilder.buildUserContext(prisma, userId, "resume-ats-agent"),
    userId,
    onRunProgress: (runId, progress: AgentProgress) => {
      progressChain.current = progressChain.current.then(() => appendProgress(runId, progress));
    },
  });
  await progressChain.current;

  if (!outcome.ok) {
    return outcome;
  }

  // 规则分(TS 确定性)+ LLM 分项(5 分档)合成;成功才落库(失败不覆盖旧评分)
  const ruleSubscores = scoreRuleSubscores(finalText, targetDirection);
  const { ruleScore, total, level } = synthesizeAtsScore(
    ruleSubscores,
    outcome.result.data.llmSubscores
  );
  const report: AtsReport = {
    total,
    level,
    ruleSubscores,
    ruleScore,
    llmSubscores: outcome.result.data.llmSubscores,
    suggestions: outcome.result.data.suggestions,
  };
  await prisma.resumeVersion.update({
    where: { id: versionId },
    data: {
      atsScore: total,
      atsReport: report as unknown as Prisma.InputJsonValue,
      atsScoredAt: new Date(),
    },
  });

  return { ok: true, versionId, runId: outcome.runId, report };
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
