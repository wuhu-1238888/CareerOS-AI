// DeepSeek 适配器(开发与生产默认):OpenAI 兼容协议,经 openai SDK 直连 api.deepseek.com
import OpenAI from "openai";
import type { ChatMessage, LLMAdapter, LLMOptions, LLMResult, LLMStreamChunk } from "./adapter";

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
    const res = await this.client.chat.completions.create({
      model: options?.model ?? DEFAULT_MODEL,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
