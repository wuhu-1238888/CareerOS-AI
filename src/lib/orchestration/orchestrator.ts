// Orchestrator(1.6):意图路由 → 组装上下文 → 执行 Agent → AgentRun 日志。
// 契约:业务错误(未注册意图 / 输入非法 / 输出非法)一律转为友好文案返回,不向上抛、不崩溃;
// AgentRun 成功与失败都落库(观测与排障)。真实业务 Agent 于 2.3/3.3/4.3 接入。
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { LLMAdapter } from "@/lib/llm/adapter";
import { llm } from "@/lib/llm";
import { registry as defaultRegistry } from "@/lib/agents/registry";
import type { AgentRegistry } from "@/lib/agents/registry";
import type { AgentContext, AgentProgress, AgentResult, ProgressCallback } from "@/lib/agents/types";
import { AgentInputError, AgentNotFoundError, AgentOutputError } from "@/lib/agents/types";

export interface RunAgentParams {
  /** 调用意图,如 "analyze-profile"(注册表路由依据) */
  intent: string;
  input: unknown;
  context: AgentContext;
  userId?: string;
  onProgress?: ProgressCallback;
  /** 携带 runId 的进度回调(2.4 起):管线把生命周期事件实时写入 AgentRun.progress,供轮询与刷新恢复 */
  onRunProgress?: (runId: string, progress: AgentProgress) => void;
}

export type RunAgentOutcome<TOutput> =
  | { ok: true; result: AgentResult<TOutput>; runId: string }
  | { ok: false; error: string; runId: string };

// 面向最终用户的友好文案(不暴露模型原文与内部细节)
const FRIENDLY_ERRORS = {
  AgentNotFoundError: "暂不支持该任务类型",
  AgentInputError: "输入内容不符合要求,请检查后重试",
  AgentOutputError: "AI 返回了无法识别的结果,请稍后重试",
  Fallback: "任务执行失败,请稍后重试",
} as const;

export class Orchestrator {
  constructor(
    private db: PrismaClient = prisma,
    private adapter: LLMAdapter = llm,
    private agents: AgentRegistry = defaultRegistry
  ) {}

  async run<TOutput>(params: RunAgentParams): Promise<RunAgentOutcome<TOutput>> {
    let agent: ReturnType<AgentRegistry["findByIntent"]>;
    try {
      agent = this.agents.findByIntent(params.intent);
    } catch (err) {
      // 路由失败:尚无 Agent 可执行,不落 AgentRun,直接给友好错误
      return { ok: false, error: this.friendlyMessage(err), runId: "" };
    }

    const run = await this.db.agentRun.create({
      data: {
        agentName: agent.config.name,
        intent: params.intent,
        userId: params.userId ?? null,
        status: "running",
        input: params.input as Prisma.InputJsonValue,
      },
    });
    const runId = run.id;
    const startedAt = Date.now();

    try {
      const result = await agent.execute(params.input, params.context, {
        adapter: this.adapter,
        onProgress: (progress) => {
          params.onProgress?.(progress);
          params.onRunProgress?.(runId, progress);
        },
      });
      await this.db.agentRun.update({
        where: { id: runId },
        data: {
          status: "succeeded",
          output: result.data as Prisma.InputJsonValue,
          durationMs: Date.now() - startedAt,
        },
      });
      return { ok: true, result: result as AgentResult<TOutput>, runId };
    } catch (err) {
      const message = this.friendlyMessage(err);
      await this.db.agentRun.update({
        where: { id: runId },
        data: { status: "failed", error: message, durationMs: Date.now() - startedAt },
      });
      return { ok: false, error: message, runId };
    }
  }

  private friendlyMessage(err: unknown): string {
    if (err instanceof AgentNotFoundError) return FRIENDLY_ERRORS.AgentNotFoundError;
    if (err instanceof AgentInputError) return FRIENDLY_ERRORS.AgentInputError;
    if (err instanceof AgentOutputError) return FRIENDLY_ERRORS.AgentOutputError;
    return FRIENDLY_ERRORS.Fallback;
  }
}

/** 全局单例:tRPC 路由(2.3 起)直接使用 */
export const orchestrator = new Orchestrator();
