// @vitest-environment node
// BaseAgent 单测(1.6):执行过 schema、进度多条有序增量、非法输入/输出报领域错误、Prompt 文件加载
import { describe, it, expect } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import type { ChatMessage, LLMAdapter, LLMOptions } from "@/lib/llm/adapter";
import { extractJson } from "../base";
import { AgentInputError, AgentOutputError } from "../types";
import { SummaryAgent, VALID_JSON_REPLY, summaryOutputSchema, DEFAULT_CONTEXT } from "./fixtures";

const agent = new SummaryAgent();
const validInput = { text: "我是计算机专业大三学生,想找后端开发实习" };

function adapterWith(reply: string, delayMs = 5) {
  return new MockAdapter(delayMs, () => reply);
}

describe("BaseAgent.execute", () => {
  it("输出通过 outputSchema,返回结果含模型/耗时/用量", async () => {
    const result = await agent.execute(validInput, DEFAULT_CONTEXT, { adapter: adapterWith(VALID_JSON_REPLY) });
    // 结果再次过 schema 校验(双重保险)
    expect(() => summaryOutputSchema.parse(result.data)).not.toThrow();
    expect(result.data.keywords).toContain("后端");
    expect(result.model).toBe("mock-1");
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("进度回调:5 条生命周期事件,顺序固定,文案非空", async () => {
    const stages: string[] = [];
    await agent.execute(validInput, DEFAULT_CONTEXT, {
      adapter: adapterWith(VALID_JSON_REPLY),
      onProgress: (p) => {
        stages.push(p.stage);
        expect(p.message.length).toBeGreaterThan(0);
      },
    });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });

  it("系统提示词从 Markdown 文件加载并置于首条消息", async () => {
    let captured: ChatMessage[] = [];
    const adapter = new MockAdapter(0, (messages) => {
      captured = messages;
      return VALID_JSON_REPLY;
    });
    await agent.execute(validInput, DEFAULT_CONTEXT, { adapter });
    expect(captured[0].role).toBe("system");
    expect(captured[0].content).toContain("职业画像摘要助手"); // 来自 sample-analyst.md
    expect(captured[1].role).toBe("user");
    expect(captured[1].content).toContain("后端开发");
  });

  it("输入未通过 inputSchema → AgentInputError(含 Agent 名)", async () => {
    await expect(
      agent.execute({ text: "" } as { text: string }, DEFAULT_CONTEXT, {
        adapter: adapterWith(VALID_JSON_REPLY),
      })
    ).rejects.toBeInstanceOf(AgentInputError);
    await expect(
      agent.execute({ text: "" } as { text: string }, DEFAULT_CONTEXT, {
        adapter: adapterWith(VALID_JSON_REPLY),
      })
    ).rejects.toThrow("sample-summary");
  });

  it("Mock 返回非 JSON → AgentOutputError,保留原始文本", async () => {
    const garbage = "抱歉,我无法处理这个问题。";
    const error = await agent
      .execute(validInput, DEFAULT_CONTEXT, { adapter: adapterWith(garbage) })
      .catch((e) => e);
    expect(error).toBeInstanceOf(AgentOutputError);
    expect((error as AgentOutputError).rawText).toBe(garbage);
    expect((error as AgentOutputError).agentName).toBe("sample-summary");
  });

  it("JSON 合法但字段不符 schema → AgentOutputError(校验失败细节)", async () => {
    const wrongShape = JSON.stringify({ summary: 123, keywords: "不是数组" });
    await expect(
      agent.execute(validInput, DEFAULT_CONTEXT, { adapter: adapterWith(wrongShape) })
    ).rejects.toThrow(/未通过校验/);
  });

  it("complete 调用携带 options.agentName = config.name(Mock 分发依据,2026-08 补)", async () => {
    const capturedOptions: (LLMOptions | undefined)[] = [];
    const spyAdapter: LLMAdapter = {
      name: "spy",
      async complete(_messages: ChatMessage[], options?: LLMOptions) {
        capturedOptions.push(options);
        return { text: VALID_JSON_REPLY, model: "spy", usage: { inputTokens: 0, outputTokens: 0 } };
      },
      async *stream() {
        yield { delta: "" };
      },
    };
    await agent.execute(validInput, DEFAULT_CONTEXT, { adapter: spyAdapter });
    expect(capturedOptions[0]).toMatchObject({ agentName: "sample-summary" });
  });
});

describe("BaseAgent.executeStream", () => {
  it("先逐条产出进度事件,最后一条为最终结果", async () => {
    const events = [];
    for await (const event of agent.executeStream(validInput, DEFAULT_CONTEXT, {
      adapter: adapterWith(VALID_JSON_REPLY),
    })) {
      events.push(event);
    }
    expect(events.length).toBe(6); // 5 进度 + 1 结果
    const resultEvent = events.at(-1);
    expect(resultEvent?.type).toBe("result");
    if (resultEvent?.type === "result") {
      expect(resultEvent.result.data.summary).toContain("后端");
    }
    expect(events.slice(0, 5).every((e) => e.type === "progress")).toBe(true);
  });
});

describe("extractJson 容错提取", () => {
  it("纯 JSON 直接解析", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("```json 围栏内解析", () => {
    expect(extractJson('好的,结果如下:\n```json\n{"a":1}\n```\n以上。')).toEqual({ a: 1 });
  });

  it("前后有废话时按首尾花括号截取", () => {
    expect(extractJson('这是结果 {"a":1,"b":[2]} 结束')).toEqual({ a: 1, b: [2] });
  });

  it("无任何 JSON 时抛错", () => {
    expect(() => extractJson("完全没有结构化内容")).toThrow("无法从模型输出中提取 JSON");
  });
});
