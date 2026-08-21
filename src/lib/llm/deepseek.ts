// DeepSeek 适配器(开发与生产默认):OpenAI 兼容协议,经 openai SDK 直连 api.deepseek.com
// 2026-08 修订:complete 加统一超时(AbortSignal.timeout(LLM_TIMEOUT_MS))——此前无超时,慢请求会让
// 前端无限停留在分析中;超时统一映射 LlmTimeoutError(run 落 failed,前端可重试)。
import OpenAI from "openai";
import type { ChatMessage, LLMAdapter, LLMOptions, LLMResult, LLMStreamChunk } from "./adapter";
import { LLM_TIMEOUT_MS, LlmTimeoutError, createTimeoutSignal, isTimeoutLike } from "./adapter";

const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-chat";

export class DeepSeekAdapter implements LLMAdapter {
  readonly name = "deepseek";
  private client: OpenAI;

  constructor(apiKey?: string, baseURL: string = DEFAULT_BASE_URL) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.DEEPSEEK_API_KEY,
      baseURL,
    });
  }

  async complete(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResult> {
    const timeout = createTimeoutSignal(LLM_TIMEOUT_MS);
    try {
      const res = await this.client.chat.completions
        .create(
          {
            model: options?.model ?? DEFAULT_MODEL,
            temperature: options?.temperature,
            max_tokens: options?.maxTokens,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          },
          { signal: timeout.signal }
        )
        .catch((err: unknown) => {
          if (isTimeoutLike(err)) throw new LlmTimeoutError();
          throw err;
        });
      return {
        text: res.choices[0]?.message?.content ?? "",
        model: res.model,
        usage: res.usage
          ? {
              inputTokens: res.usage.prompt_tokens ?? 0,
              outputTokens: res.usage.completion_tokens ?? 0,
            }
          : undefined,
      };
    } finally {
      timeout.clear();
    }
  }

  async *stream(messages: ChatMessage[], options?: LLMOptions): AsyncGenerator<LLMStreamChunk> {
    const stream = await this.client.chat.completions.create({
      model: options?.model ?? DEFAULT_MODEL,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield { delta };
      }
    }
  }
}
