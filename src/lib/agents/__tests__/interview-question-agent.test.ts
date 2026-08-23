// @vitest-environment node
// 模拟面试出题 Agent 测试(7.1):固定样例集(Schema 通过/五类覆盖/3 题能从输入简历找到出处/
// 换岗位题目差异明显/题数恒等)+ 边界用例(非法 JSON、缺题型、输入违规、进度事件、意图注册)
import { describe, it, expect } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import { interviewQuestionAgent } from "../interview-question.agent";
import { interviewQuestionsSchema } from "../interview-question.agent";
import { AgentInputError, AgentOutputError } from "../types";
import { interviewSamples } from "./interview-samples";
import type { InterviewQuestions } from "../interview-question.agent";

describe("Interview Question Agent 固定样例集", () => {
  for (const sample of interviewSamples) {
    it(`样例 ${sample.id}(${sample.description}):输出通过 Schema,五类覆盖,题目锚定简历,题数恒等`, async () => {
      let capturedUserMessage = "";
      const adapter = new MockAdapter(0, (messages) => {
        capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
        return JSON.stringify(sample.mockOutput);
      });
      const result = await interviewQuestionAgent.execute(sample.input, {}, { adapter });

      // 输出通过 outputSchema(execute 内部已校验;此处再独立断言一次)
      expect(interviewQuestionsSchema.safeParse(result.data).success).toBe(true);

      // 五类题型全覆盖(agent-design 2.6 输出定义)
      const types = new Set(result.data.questions.map((q) => q.type));
      expect(types).toEqual(new Set(["自我介绍", "经历深挖", "技术案例", "情景假设", "反问"]));

      // 题数恒等于档位(管线 echo 校验的前提)
      expect(result.data.questions.length).toBe(sample.input.questionCount);

      // 至少 3 题能从输入简历找到出处(evidence 短语须是简历文本的真实子串,禁虚构)
      const evidenceQuestions = result.data.questions.filter(
        (q) => q.evidence.length > 0 && q.evidence.some((e) => sample.input.resumeText.includes(e))
      );
      expect(evidenceQuestions.length).toBeGreaterThanOrEqual(3);

      // 输入数据确实传给了模型(岗位名 + 档位 + 面试类型键)
      expect(capturedUserMessage).toContain(sample.input.targetPosition);
      expect(capturedUserMessage).toContain(`"questionCount": ${sample.input.questionCount}`);
      expect(capturedUserMessage).toContain(`"interviewType": "${sample.input.interviewType}"`);
    });
  }

  it("换岗位题目差异明显:后端开发 vs 产品经理样例的题目集互不相同", () => {
    const backend = interviewSamples.find((s) => s.id === "backend-behavioral-5")!;
    const product = interviewSamples.find((s) => s.id === "product-behavioral-5")!;
    const backendTexts = new Set(backend.mockOutput.questions.map((q) => q.question));
    const productTexts = new Set(product.mockOutput.questions.map((q) => q.question));
    // 除「反问」通用题外,其余题干应随岗位变化(至少 3 道不同)
    const overlap = Array.from(backendTexts).filter((t) => productTexts.has(t));
    expect(overlap.length).toBeLessThanOrEqual(2);
  });
});

describe("Interview Question Agent 边界用例", () => {
  const base = interviewSamples[0]!;

  it("模型输出非法 JSON → AgentOutputError(保留原始文本)", async () => {
    const adapter = new MockAdapter(0, () => "这不是一个 JSON,抱歉。");
    await expect(interviewQuestionAgent.execute(base.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出缺少某一类题型(无反问)→ AgentOutputError", async () => {
    const invalid: InterviewQuestions = structuredClone(base.mockOutput);
    invalid.questions = invalid.questions.filter((q) => q.type !== "反问");
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(interviewQuestionAgent.execute(base.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出题数少于档位(10 档只输出 5 道)→ 通过 outputSchema 但由管线 echo 校验拦截", async () => {
    // outputSchema 不校验题数(echo 属业务规则,在管线层校验):10 档输出 5 道时 schema 仍通过
    // (五类各 1 且 ≥5),题数差异由管线断言 ok:false(见 pipeline.test.ts)
    const sample10 = interviewSamples.find((s) => s.id === "backend-technical-10")!;
    const short: InterviewQuestions = structuredClone(sample10.mockOutput);
    short.questions = short.questions.slice(0, 5);
    expect(interviewQuestionsSchema.safeParse(short).success).toBe(true);
  });

  it("输入违反 Schema(空简历文本)→ AgentInputError", async () => {
    const badInput = { ...base.input, resumeText: "" };
    await expect(interviewQuestionAgent.execute(badInput, {})).rejects.toBeInstanceOf(AgentInputError);
  });

  it("执行过程产出 5 个顺序生命周期进度事件", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(base.mockOutput));
    const stages: string[] = [];
    await interviewQuestionAgent.execute(base.input, {}, {
      adapter,
      onProgress: (p) => stages.push(p.stage),
    });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });
});

describe("Agent 注册(7.1)", () => {
  it("intent generate-interview-questions 路由到面试出题 Agent", async () => {
    const { registry } = await import("../index");
    expect(registry.findByIntent("generate-interview-questions").config.name).toBe(
      "interview-question-agent"
    );
    expect(registry.get("interview-question-agent")).toBe(interviewQuestionAgent);
  });
});
