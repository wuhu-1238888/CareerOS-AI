// Mock 适配器:零 API 费用。可配置延迟模拟耗时;可注入 replyFn 供测试定制回复。
// 默认回复按 Agent 名(LLMOptions.agentName,由 BaseAgent 传入)分发 schema 合规的演示 JSON
// (matching/coach,见 mock-fixtures.ts),使 LLM_PROVIDER=mock 时浏览器端也能走通全链路;
// 未识别 Agent 保持回显行为(输入传递断言与旧测试依赖)。
import type { ChatMessage, LLMAdapter, LLMOptions, LLMResult, LLMStreamChunk } from "./adapter";
import { mockCoachPlanFixture, mockMatchAnalysisFixture } from "./mock-fixtures";

export type MockReplyFn = (messages: ChatMessage[], options?: LLMOptions) => string;

/** 按 Agent 名分发演示数据;未命中 → 回显最后一条用户消息(便于测试断言输入传递) */
export const defaultMockReply: MockReplyFn = (messages, options) => {
  if (options?.agentName === "job-matching-agent") {
    logDispatch("job-matching-agent");
    return JSON.stringify(mockMatchAnalysisFixture());
  }
  if (options?.agentName === "skill-coach-agent") {
    logDispatch("skill-coach-agent");
    return JSON.stringify(mockCoachPlanFixture(messages));
  }
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return `[mock] 已收到:${lastUser?.content ?? "(无用户消息)"}`;
};

/** dev 环境可见性日志(测试环境静默,避免污染测试输出) */
function logDispatch(agentName: string) {
  if (process.env.NODE_ENV !== "test") {
    console.log(`[careeros][mock] agent=${agentName}:返回内置演示数据(LLM_PROVIDER=mock)`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockAdapter implements LLMAdapter {
  readonly name = "mock";
  private delayMs: number;
  private replyFn: MockReplyFn;

  constructor(delayMs = 0, replyFn: MockReplyFn = defaultMockReply) {
    this.delayMs = delayMs;
    this.replyFn = replyFn;
  }

  async complete(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResult> {
    if (this.delayMs > 0) {
      await sleep(this.delayMs);
    }
    return {
      text: this.replyFn(messages, options),
      model: "mock-1",
      usage: { inputTokens: 0, outputTokens: 0 }, // 零消耗
    };
  }

  async *stream(messages: ChatMessage[], options?: LLMOptions): AsyncGenerator<LLMStreamChunk> {
    const result = await this.complete(messages, options);
    // 按句切分,模拟增量到达
    const parts = result.text.split(/(?<=。)/);
    for (const part of parts) {
      if (this.delayMs > 0) {
        await sleep(this.delayMs);
      }
      yield { delta: part };
    }
  }
}
