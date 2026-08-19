// @vitest-environment node
// LLM 适配器单测(1.5):SDK 全部 mock 化,离线验证四个适配器的结构与参数映射。
// 真实连通验证(Mock 之外)单独进行:实施到 1.5 暂停点向用户索要 DeepSeek Key 后手工执行。
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("openai", () => {
  const state = {
    instances: [] as { config: { apiKey?: string; baseURL?: string } }[],
    create: vi.fn(
      async (params: {
        model: string;
        messages: { role: string; content: string }[];
        max_tokens?: number;
        stream?: boolean;
      }) => ({
        model: params.model,
        choices: [
          {
            message: { content: `[fake] ${params.messages[params.messages.length - 1]?.content}` },
            delta: { content: "逐", role: "assistant" },
          },
        ],
        usage: { prompt_tokens: 7, completion_tokens: 9 },
      })
    ),
  };
  class FakeOpenAI {
    static __state = state;
    chat = { completions: { create: state.create } };
    constructor(config: { apiKey?: string; baseURL?: string }) {
      state.instances.push({ config });
    }
  }
  return { __esModule: true, default: FakeOpenAI };
});

vi.mock("@anthropic-ai/sdk", () => {
  const state = {
    instances: [] as { config: { apiKey?: string } }[],
    create: vi.fn(
      async (params: { model: string; system?: string; messages: { role: string; content: string }[] }) => ({
        model: params.model,
        content: [{ type: "text", text: `[fake-anthropic] ${params.messages[params.messages.length - 1]?.content}` }],
        usage: { input_tokens: 5, output_tokens: 6 },
      })
    ),
    stream: vi.fn(() => {
      const stream = {
        on: vi.fn((event: string, cb: (e: { type: string; delta: { type: string; text: string } }) => void) => {
          if (event === "streamEvent") {
            cb({ type: "content_block_delta", delta: { type: "text_delta", text: "你好。" } });
            cb({ type: "content_block_delta", delta: { type: "text_delta", text: "世界。" } });
          }
        }),
        finalMessage: vi.fn(async () => ({ content: [] })),
      };
      return stream;
    }),
  };
  class FakeAnthropic {
    static __state = state;
    messages = { create: state.create, stream: state.stream };
    constructor(config: { apiKey?: string }) {
      state.instances.push({ config });
    }
  }
  return { __esModule: true, default: FakeAnthropic };
});

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { DeepSeekAdapter } from "../deepseek";
import { OpenAIAdapter } from "../openai";
import { AnthropicAdapter } from "../anthropic";
import { MockAdapter } from "../mock";
import { getLLMAdapter, resolveProvider } from "../index";
import type { ChatMessage, LLMResult } from "../adapter";

const sameInput: ChatMessage[] = [
  { role: "system", content: "你是一个测试助手" },
  { role: "user", content: "你好" },
];

function resultKeys(result: LLMResult) {
  return { text: typeof result.text === "string", model: typeof result.model === "string", usage: !!result.usage };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.LLM_PROVIDER;
});

describe("LLM 适配器统一结构(1.5)", () => {
  it("四个适配器对同一输入返回相同结构 {text, model, usage}", async () => {
    const adapters = [
      new DeepSeekAdapter(),
      new OpenAIAdapter(),
      new AnthropicAdapter(),
      new MockAdapter(),
    ];
    for (const adapter of adapters) {
      const result = await adapter.complete(sameInput);
      expect(resultKeys(result), `${adapter.name} 结构不符`).toEqual({
        text: true,
        model: true,
        usage: true,
      });
      expect(result.text.length).toBeGreaterThan(0);
    }
  });

  it("DeepSeek:默认模型 deepseek-chat、baseURL 指向 api.deepseek.com、token 映射正确", async () => {
    const adapter = new DeepSeekAdapter();
    const result = await adapter.complete(sameInput, { maxTokens: 100 });

    const state = (OpenAI as unknown as { __state: { instances: { config: { baseURL?: string } }[]; create: ReturnType<typeof vi.fn> } }).__state;
    const openAiInstance = state.instances.find((i) => i.config.baseURL === "https://api.deepseek.com");
    expect(openAiInstance).toBeDefined();
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "deepseek-chat", max_tokens: 100 })
    );
    expect(result.usage).toEqual({ inputTokens: 7, outputTokens: 9 });
  });

  it("OpenAI:默认模型 gpt-4o-mini,不设置 baseURL", async () => {
    const adapter = new OpenAIAdapter();
    await adapter.complete(sameInput);

    const state = (OpenAI as unknown as { __state: { instances: { config: { baseURL?: string } }[]; create: ReturnType<typeof vi.fn> } }).__state;
    const instance = state.instances.find((i) => i.config.baseURL === undefined);
    expect(instance).toBeDefined();
    expect(state.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-mini" })
    );
  });

  it("Anthropic:system 拆为顶层参数、剩余消息角色映射、流式增量收集", async () => {
    const adapter = new AnthropicAdapter();
    const result = await adapter.complete(sameInput);
    expect(result.text).toContain("[fake-anthropic] 你好");
    expect(result.usage).toEqual({ inputTokens: 5, outputTokens: 6 });

    const create = (Anthropic as unknown as { __state: { create: ReturnType<typeof vi.fn> } }).__state.create;
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "你是一个测试助手",
        messages: [{ role: "user", content: "你好" }],
      })
    );

    const chunks: string[] = [];
    for await (const chunk of adapter.stream(sameInput)) {
      chunks.push(chunk.delta);
    }
    expect(chunks).toEqual(["你好。", "世界。"]);
  });

  it("Mock:零消耗(usage 全 0)、确定性输出、可配置延迟与自定义回复", async () => {
    const mock = new MockAdapter();
    const r1 = await mock.complete(sameInput);
    const r2 = await mock.complete(sameInput);
    expect(r1.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(r1.text).toBe(r2.text); // 确定性
    expect(r1.text).toContain("你好");

    // 自定义回复(Agent 基座测试依赖此能力)
    const custom = new MockAdapter(0, () => '{"ok":true}');
    expect((await custom.complete(sameInput)).text).toBe('{"ok":true}');

    // 流式按句切分增量到达
    const deltas: string[] = [];
    for await (const c of new MockAdapter(1, () => "第一句。第二句。").stream(sameInput)) {
      deltas.push(c.delta);
    }
    expect(deltas.length).toBeGreaterThanOrEqual(2);
  });
});

describe("LLM Provider 工厂", () => {
  it("getLLMAdapter 按参数选择适配器;未知 Provider 抛错", () => {
    expect(getLLMAdapter("mock").name).toBe("mock");
    expect(getLLMAdapter("deepseek").name).toBe("deepseek");
    expect(getLLMAdapter("openai").name).toBe("openai");
    expect(getLLMAdapter("anthropic").name).toBe("anthropic");
    expect(() => getLLMAdapter("bogus" as never)).toThrow(/未知的 LLM_PROVIDER/);
  });

  it("resolveProvider:默认 mock;读环境变量;非法值抛错", () => {
    expect(resolveProvider()).toBe("mock");
    process.env.LLM_PROVIDER = "deepseek";
    expect(resolveProvider()).toBe("deepseek");
    process.env.LLM_PROVIDER = "bogus";
    expect(() => resolveProvider()).toThrow(/未知的 LLM_PROVIDER/);
  });
});
