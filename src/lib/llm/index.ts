// LLM Provider 工厂:按环境变量 LLM_PROVIDER 选择适配器(mock | deepseek | openai | anthropic)
// 开发默认 mock(零费用);生产默认 deepseek(technical-design 6.2)
import type { LLMAdapter } from "./adapter";
import { DeepSeekAdapter } from "./deepseek";
import { OpenAIAdapter } from "./openai";
import { AnthropicAdapter } from "./anthropic";
import { MockAdapter } from "./mock";

export type LLMProvider = "mock" | "deepseek" | "openai" | "anthropic";

export function resolveProvider(): LLMProvider {
  const raw = process.env.LLM_PROVIDER ?? "mock";
  const provider = raw.toLowerCase() as LLMProvider;
  if (!["mock", "deepseek", "openai", "anthropic"].includes(provider)) {
    throw new Error(`未知的 LLM_PROVIDER:${raw}(支持 mock / deepseek / openai / anthropic)`);
  }
  return provider;
}

export function getLLMAdapter(provider?: LLMProvider): LLMAdapter {
  switch (provider ?? resolveProvider()) {
    case "deepseek":
      return new DeepSeekAdapter();
    case "openai":
      return new OpenAIAdapter();
    case "anthropic":
      return new AnthropicAdapter();
    case "mock":
      return new MockAdapter();
    default:
      throw new Error(`未知的 LLM_PROVIDER:${String(provider)}`);
  }
}

// 模块级默认实例:构造仅创建 SDK 客户端,不发任何网络请求
export const llm: LLMAdapter = getLLMAdapter();
