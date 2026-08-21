// @vitest-environment node
// Resume ATS Agent 测试(4.6):固定样例集(1-5 整数分档与标注一致、建议 2-5 条)+
// 边界用例(非法 JSON/违反 Schema/非法输入/温度 0 传给适配器/进度事件/输入透传)+ 意图注册
import { describe, expect, it } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import type { LLMAdapter, LLMOptions } from "@/lib/llm/adapter";
import { atsLlmAnalysisSchema } from "@/lib/resume/analysis-schemas";
import { resumeAtsAgent } from "../resume.agent";
import { AgentInputError, AgentOutputError } from "../types";
import { resumeAtsSamples } from "./resume-ats-samples";

describe("Resume ATS Agent 固定样例集", () => {
  for (const sample of resumeAtsSamples) {
    it(`样例 ${sample.id}(${sample.description}):输出通过 Schema,分项与标注一致`, async () => {
      let capturedUserMessage = "";
      const adapter = new MockAdapter(0, (messages) => {
        capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
        return JSON.stringify(sample.mockOutput);
      });
      const result = await resumeAtsAgent.execute(sample.input, {}, { adapter });

      // 输出通过 outputSchema(execute 内部已校验;此处再独立断言一次)
      expect(atsLlmAnalysisSchema.safeParse(result.data).success).toBe(true);

      // 分项为 1-5 整数,与标注一致
      expect(result.data.llmSubscores.contentQuality).toBe(sample.expectedContentQuality);
      expect(result.data.llmSubscores.relevance).toBe(sample.expectedRelevance);
      expect(result.data.suggestions).toHaveLength(sample.expectedSuggestionCount);

      // 输入透传:最终文本与目标方向原样进入 user 消息
      const sent = JSON.parse(capturedUserMessage) as {
        finalText: string;
        targetDirection: string;
      };
      expect(sent.finalText).toBe(sample.input.finalText);
      expect(sent.targetDirection).toBe(sample.input.targetDirection);
    });
  }

  it("同一输入执行两次:输出结构一致", async () => {
    const sample = resumeAtsSamples[0]!;
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const first = await resumeAtsAgent.execute(sample.input, {}, { adapter });
    const second = await resumeAtsAgent.execute(sample.input, {}, { adapter });
    expect(second.data).toEqual(first.data);
  });
});

describe("Resume ATS Agent 边界用例", () => {
  const sample = resumeAtsSamples[0]!;

  it("温度 0 传给适配器(评分稳定性的 LLM 侧保证)", async () => {
    const captured: { options?: LLMOptions } = {};
    const adapter: LLMAdapter = {
      name: "capture",
      async complete(_messages, options) {
        captured.options = options;
        return { text: JSON.stringify(sample.mockOutput), model: "capture-1" };
      },
      stream: async function* () {
        yield { delta: "" };
      },
    };
    await resumeAtsAgent.execute(sample.input, {}, { adapter });
    expect(captured.options?.temperature).toBe(0);
  });

  it("模型输出非法 JSON → AgentOutputError", async () => {
    const adapter = new MockAdapter(0, () => "抱歉,我无法输出 JSON。");
    await expect(resumeAtsAgent.execute(sample.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出违反 Schema(建议仅 1 条)→ AgentOutputError", async () => {
    const invalid = {
      ...sample.mockOutput,
      suggestions: sample.mockOutput.suggestions.slice(0, 1),
    };
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(resumeAtsAgent.execute(sample.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出违反 Schema(分项超出 1-5)→ AgentOutputError", async () => {
    const invalid = {
      ...sample.mockOutput,
      llmSubscores: { contentQuality: 6, relevance: 1 },
    };
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(resumeAtsAgent.execute(sample.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("输入违反 Schema(最终文本过短)→ AgentInputError", async () => {
    await expect(
      resumeAtsAgent.execute({ finalText: "太短", targetDirection: "后端开发工程师" }, {})
    ).rejects.toBeInstanceOf(AgentInputError);
  });

  it("执行过程产出 5 个顺序生命周期进度事件", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const stages: string[] = [];
    await resumeAtsAgent.execute(sample.input, {}, {
      adapter,
      onProgress: (p) => stages.push(p.stage),
    });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });
});

describe("Resume ATS Agent 注册(4.6)", () => {
  it("intent score-ats 路由到 Resume ATS Agent", async () => {
    const { registry } = await import("../index");
    expect(registry.findByIntent("score-ats").config.name).toBe("resume-ats-agent");
    expect(registry.get("resume-ats-agent")).toBe(resumeAtsAgent);
  });
});
