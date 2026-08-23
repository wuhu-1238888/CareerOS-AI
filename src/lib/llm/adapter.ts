// LLM 适配器统一接口(technical-design 6.2:Adapter Pattern)
// 所有 Provider 实现同一接口,业务代码(Agent 基座)只依赖本接口,不感知具体 Provider。

// 单次 LLM 调用超时(2026-08 修订):管线同步等待 LLM,此前无超时,慢请求会让前端无限停留在分析中;
// 统一 3 分钟:超时 → 抛 LlmTimeoutError → run 落 failed(真实原因 + 可重试)。serializeRun 的 stale 阈值依赖本值(须大于超时)。
export const LLM_TIMEOUT_MS = 3 * 60 * 1000;

/** LLM 调用超时错误:Orchestrator 映射为友好文案,run 落 failed 供前端重试 */
export class LlmTimeoutError extends Error {
  constructor() {
    super("AI 响应超时,请重试");
    this.name = "LlmTimeoutError";
  }
}

/** 超时类 SDK 错误判定:openai SDK 经 AbortSignal 中止抛 APIUserAbortError;兼容 AbortError/TimeoutError */
export function isTimeoutLike(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: unknown }).name;
  return name === "APIUserAbortError" || name === "AbortError" || name === "TimeoutError";
}

/** 带超时的 AbortSignal:定时器由调用方在 finally 中经 clear 释放(避免长驻定时器与测试句柄泄漏) */
export function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

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
  /**
   * 发起调用的 Agent 名(config.name)。仅供 Mock 适配器按 Agent 分发 schema 合规的演示数据;
   * 真实 Provider(deepseek/openai/anthropic)忽略该字段。
   */
  agentName?: string;
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
