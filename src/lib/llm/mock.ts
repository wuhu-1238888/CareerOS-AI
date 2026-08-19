// Mock 适配器:零 API 费用。返回确定性内容;可配置延迟模拟耗时;可注入 replyFn 供测试定制回复。
import type { ChatMessage, LLMAdapter, LLMResult, LLMStreamChunk } from "./adapter";

export type MockReplyFn = (messages: ChatMessage[]) => string;

/** 默认回复:把最后一条用户消息原样回显,便于测试断言输入传递 */
export const defaultMockReply: MockReplyFn = (messages) => {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return `[mock] 已收到:${lastUser?.content ?? "(无用户消息)"}`;
};

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

  async complete(messages: ChatMessage[]): Promise<LLMResult> {
    if (this.delayMs > 0) {
      await sleep(this.delayMs);
    }
    return {
      text: this.replyFn(messages),
      model: "mock-1",
      usage: { inputTokens: 0, outputTokens: 0 }, // 零消耗
    };
  }

  async *stream(messages: ChatMessage[]): AsyncGenerator<LLMStreamChunk> {
    const result = await this.complete(messages);
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
