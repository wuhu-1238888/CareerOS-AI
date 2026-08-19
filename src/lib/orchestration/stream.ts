// 进度流处理(1.6):Agent 执行包装为可异步迭代的进度流,供 tRPC subscription 等消费者逐条转发。
// 已确认决策:进度 = 生命周期确定性文案(非 LLM 逐字流),最终一次性 JSON;本模块为稳定 API 面。
import type { BaseAgent } from "@/lib/agents/base";
import type { AgentContext, AgentResult, ProgressCallback, StreamEvent } from "@/lib/agents/types";
import type { LLMAdapter } from "@/lib/llm/adapter";

export interface StreamAgentOptions {
  adapter?: LLMAdapter;
  onProgress?: ProgressCallback;
}

/** 把一次 Agent 执行转为进度流:先逐条进度事件,最后一条为最终结果 */
export function streamAgentExecution<TInput, TOutput>(
  agent: BaseAgent<TInput, TOutput>,
  input: TInput,
  context: AgentContext,
  options?: StreamAgentOptions
): AsyncGenerator<StreamEvent<TOutput>> {
  return agent.executeStream(input, context, options);
}

export function isResultEvent<TOutput>(
  event: StreamEvent<TOutput>
): event is { type: "result"; result: AgentResult<TOutput> } {
  return event.type === "result";
}
