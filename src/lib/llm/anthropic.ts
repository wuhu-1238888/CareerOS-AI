// Anthropic 适配器:Messages API;system 角色在 Anthropic 是顶层参数,需拆出
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, LLMAdapter, LLMOptions, LLMResult, LLMStreamChunk } from "./adapter";
import { LLM_TIMEOUT_MS, LlmTimeoutError, createTimeoutSignal, isTimeoutLike } from "./adapter";

const DEFAULT_MODEL = "claude-sonnet-5";

export class AnthropicAdapter implements LLMAdapter {
  readonly name = "anthropic";
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
  }

  private splitSystem(messages: ChatMessage[]) {
    const system = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const rest = messages.filter((m) => m.role !== "system");
    return { system, rest };
  }

  async complete(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResult> {
    const { system, rest } = this.splitSystem(messages);
    const timeout = createTimeoutSignal(LLM_TIMEOUT_MS);
    try {
      const res = await this.client.messages
        .create(
          {
            model: options?.model ?? DEFAULT_MODEL,
            max_tokens: options?.maxTokens ?? 1024,
            temperature: options?.temperature,
            system: system || undefined,
            messages: rest.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content,
            })),
          },
          { signal: timeout.signal }
        )
        .catch((err: unknown) => {
          if (isTimeoutLike(err)) throw new LlmTimeoutError();
          throw err;
        });
      const text = res.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");
      return {
        text,
        model: res.model,
        usage: { inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens },
      };
    } finally {
      timeout.clear();
    }
  }

  async *stream(messages: ChatMessage[], options?: LLMOptions): AsyncGenerator<LLMStreamChunk> {
    const { system, rest } = this.splitSystem(messages);
    const stream = this.client.messages.stream({
      model: options?.model ?? DEFAULT_MODEL,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature,
      system: system || undefined,
      messages: rest.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    });
    const deltas: string[] = [];
    stream.on("streamEvent", (event) => {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        deltas.push(event.delta.text);
      }
    });
    await stream.finalMessage(); // 等待流结束,收集全部增量
    for (const delta of deltas) {
      yield { delta };
    }
  }
}
