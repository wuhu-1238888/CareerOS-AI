// OpenAI 适配器:官方 API,与 DeepSeek 适配器同构(OpenAI 兼容协议)
import OpenAI from "openai";
import type { ChatMessage, LLMAdapter, LLMOptions, LLMResult, LLMStreamChunk } from "./adapter";

const DEFAULT_MODEL = "gpt-4o-mini";

export class OpenAIAdapter implements LLMAdapter {
  readonly name = "openai";
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
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
