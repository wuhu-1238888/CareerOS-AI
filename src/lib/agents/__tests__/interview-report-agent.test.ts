// @vitest-environment node
// 模拟面试综合报告 Agent 测试(7.3):输出通过 Schema(四要素)、数量边界违规报错、
// 输入违规报错、输入传递断言、5 进度事件、意图注册
import { describe, it, expect } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import { interviewReportAgent, interviewReportAgentInputSchema } from "../interview-report.agent";
import { AgentInputError, AgentOutputError } from "../types";
import type { InterviewReportAgentInput } from "../interview-report.agent";

const baseInput: InterviewReportAgentInput = {
  targetPosition: "后端开发工程师",
  interviewType: "行为面",
  summary: [
    {
      type: "自我介绍",
      question: "请围绕后端开发工程师这个岗位做一个 1 分钟左右的自我介绍。",
      answer: "我是一名计算机专业学生,有两段后端实习经历,熟悉 Python 与 MySQL。",
      contentScore: 8,
      expressionScore: 7,
    },
    {
      type: "经历深挖",
      question: "你在后端实习 3 个月里,具体负责什么?",
      answer: "我负责订单服务接口开发,独立完成接口设计与 MySQL 数据表设计。",
      contentScore: 7,
      expressionScore: 8,
    },
    {
      type: "技术案例",
      question: "商品发布与订单模块你是怎么设计的?",
      answer: "我用 MySQL 存储商品与订单,做了基础索引与事务处理。",
      contentScore: 6,
      expressionScore: 7,
    },
  ],
};

const validOutput = {
  overallEvaluation: "整体表现:能结合真实经历作答,结构基本清晰,但成果量化不足,故事说服力有提升空间。",
  strengths: ["经历真实具体,不空谈", "回答结构基本清晰"],
  weaknesses: ["成果缺乏量化数据支撑", "深挖细节展开不足"],
  keyImprovements: ["用 STAR + 量化结果重写两段核心经历"],
};

describe("Interview Report Agent(7.3)", () => {
  it("固定输入 → 输出通过 Schema(四要素齐全)", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(validOutput));
    const result = await interviewReportAgent.execute(baseInput, {}, { adapter });
    expect(result.data.overallEvaluation).toBe(validOutput.overallEvaluation);
    expect(result.data.strengths).toHaveLength(2);
    expect(result.data.weaknesses).toHaveLength(2);
    expect(result.data.keyImprovements).toHaveLength(1);
  });

  it("keyImprovements 3 条 → AgentOutputError(1-2 条边界)", async () => {
    const adapter = new MockAdapter(0, () =>
      JSON.stringify({ ...validOutput, keyImprovements: ["a", "b", "c"] })
    );
    await expect(interviewReportAgent.execute(baseInput, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("strengths 为空数组 → AgentOutputError(至少 1 条优势)", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify({ ...validOutput, strengths: [] }));
    await expect(interviewReportAgent.execute(baseInput, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出非法 JSON → AgentOutputError(保留原始文本)", async () => {
    const adapter = new MockAdapter(0, () => "这不是一个 JSON,抱歉。");
    await expect(interviewReportAgent.execute(baseInput, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("输入违反 Schema(空摘要)→ AgentInputError", async () => {
    await expect(
      interviewReportAgent.execute({ ...baseInput, summary: [] }, {})
    ).rejects.toBeInstanceOf(AgentInputError);
  });

  it("输入 Schema 拒绝 answer 超过 800 字的摘要(管线截断依赖此上限)", () => {
    const tooLong = interviewReportAgentInputSchema.safeParse({
      ...baseInput,
      summary: [{ ...baseInput.summary[0]!, answer: "长".repeat(801) }],
    });
    expect(tooLong.success).toBe(false);
  });

  it("输入数据确实传给模型(岗位名 + 一道题干 + 一条回答)", async () => {
    let capturedUserMessage = "";
    const adapter = new MockAdapter(0, (messages) => {
      capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
      return JSON.stringify(validOutput);
    });
    await interviewReportAgent.execute(baseInput, {}, { adapter });
    expect(capturedUserMessage).toContain(baseInput.targetPosition);
    expect(capturedUserMessage).toContain(baseInput.summary[0]!.question);
    expect(capturedUserMessage).toContain(baseInput.summary[1]!.answer);
  });

  it("执行过程产出 5 个顺序生命周期进度事件", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(validOutput));
    const stages: string[] = [];
    await interviewReportAgent.execute(baseInput, {}, {
      adapter,
      onProgress: (p) => stages.push(p.stage),
    });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });
});

describe("Agent 注册(7.3)", () => {
  it("intent generate-interview-report 路由到报告 Agent", async () => {
    const { registry } = await import("../index");
    expect(registry.findByIntent("generate-interview-report").config.name).toBe(
      "interview-report-agent"
    );
    expect(registry.get("interview-report-agent")).toBe(interviewReportAgent);
  });
});
