// @vitest-environment node
// 模拟面试答题评估 Agent 测试(7.2):输出通过 Schema(含/不含追问)、非法输出报错、
// 输入违规报错、输入传递断言、5 进度事件、意图注册
import { describe, it, expect } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import { interviewAnswerEvaluator, interviewEvaluationSchema } from "../interview-evaluator.agent";
import { AgentInputError, AgentOutputError } from "../types";
import { interviewSamples } from "./interview-samples";
import type { InterviewEvaluatorAgentInput } from "../interview-evaluator.agent";

const sample = interviewSamples.find((s) => s.id === "backend-behavioral-5")!;

const baseInput: InterviewEvaluatorAgentInput = {
  resumeText: sample.input.resumeText,
  targetPosition: sample.input.targetPosition,
  interviewType: sample.input.interviewType,
  question: sample.mockOutput.questions[1]!, // 经历深挖题
  answer:
    "我在后端实习中负责订单服务接口开发,独立完成了接口设计、MySQL 数据表设计与前后端联调,日均请求约 1000 次。",
};

const validOutput = {
  contentScore: 8,
  expressionScore: 7,
  improvementSuggestion: "回答有 STAR 雏形,建议补上「结果如何」:上线后接口响应时间、错误率等量化数据。",
  followUpQuestion: "你提到独立完成数据表设计,当时表结构是怎么拆分的?",
};

describe("Interview Answer Evaluator Agent(7.2)", () => {
  it("固定输入 → 输出通过 Schema(含追问),评分与追问原样返回", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(validOutput));
    const result = await interviewAnswerEvaluator.execute(baseInput, {}, { adapter });
    expect(interviewEvaluationSchema.safeParse(result.data).success).toBe(true);
    expect(result.data.contentScore).toBe(8);
    expect(result.data.expressionScore).toBe(7);
    expect(result.data.followUpQuestion).toBe("你提到独立完成数据表设计,当时表结构是怎么拆分的?");
  });

  it("followUpQuestion 为 null(无需追问)→ Schema 通过", async () => {
    const adapter = new MockAdapter(0, () =>
      JSON.stringify({ ...validOutput, followUpQuestion: null })
    );
    const result = await interviewAnswerEvaluator.execute(baseInput, {}, { adapter });
    expect(interviewEvaluationSchema.safeParse(result.data).success).toBe(true);
    expect(result.data.followUpQuestion).toBeNull();
  });

  it("模型输出非法 JSON → AgentOutputError(保留原始文本)", async () => {
    const adapter = new MockAdapter(0, () => "这不是一个 JSON,抱歉。");
    await expect(interviewAnswerEvaluator.execute(baseInput, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出分数越界(11 分)→ AgentOutputError", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify({ ...validOutput, contentScore: 11 }));
    await expect(interviewAnswerEvaluator.execute(baseInput, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出缺少改进建议 → AgentOutputError", async () => {
    const withoutSuggestion = {
      contentScore: validOutput.contentScore,
      expressionScore: validOutput.expressionScore,
      followUpQuestion: validOutput.followUpQuestion,
    };
    const adapter = new MockAdapter(0, () => JSON.stringify(withoutSuggestion));
    await expect(interviewAnswerEvaluator.execute(baseInput, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("输入违反 Schema(空回答)→ AgentInputError", async () => {
    await expect(
      interviewAnswerEvaluator.execute({ ...baseInput, answer: "" }, {})
    ).rejects.toBeInstanceOf(AgentInputError);
  });

  it("输入数据确实传给模型(岗位名 + 题目 id + 回答)", async () => {
    let capturedUserMessage = "";
    const adapter = new MockAdapter(0, (messages) => {
      capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
      return JSON.stringify(validOutput);
    });
    await interviewAnswerEvaluator.execute(baseInput, {}, { adapter });
    expect(capturedUserMessage).toContain(baseInput.targetPosition);
    expect(capturedUserMessage).toContain(`"id": "${baseInput.question.id}"`);
    expect(capturedUserMessage).toContain(baseInput.answer);
  });

  it("执行过程产出 5 个顺序生命周期进度事件", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(validOutput));
    const stages: string[] = [];
    await interviewAnswerEvaluator.execute(baseInput, {}, {
      adapter,
      onProgress: (p) => stages.push(p.stage),
    });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });
});

describe("Agent 注册(7.2)", () => {
  it("intent evaluate-interview-answer 路由到答题评估 Agent", async () => {
    const { registry } = await import("../index");
    expect(registry.findByIntent("evaluate-interview-answer").config.name).toBe(
      "interview-answer-evaluator"
    );
    expect(registry.get("interview-answer-evaluator")).toBe(interviewAnswerEvaluator);
  });
});
