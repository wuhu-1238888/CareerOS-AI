// LLM 适配器统一接口(technical-design 6.2:Adapter Pattern)
// 所有 Provider 实现同一接口,业务代码(Agent 基座)只依赖本接口,不感知具体 Provider。

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface LLMOptions {
  /** 模型名(缺省用适配器默认模型) */
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMResult {
  text: string;
  model: string;
  usage?: LLMUsage;
}

export interface LLMStreamChunk {
  /** 增量文本片段 */
  delta: string;
}

export interface LLMAdapter {
  /** Provider 标识:deepseek | openai | anthropic | mock */
  readonly name: string;
  /** 一次性补全:发送完整消息,返回完整结果(Agent 最终 JSON 走此通道) */
  complete(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResult>;
  /** 流式补全:逐片段产出(仅用于 LLM 逐字流场景;Agent 进度文案不走此通道,见 technical-design 6.3) */
  stream(messages: ChatMessage[], options?: LLMOptions): AsyncGenerator<LLMStreamChunk>;
}
