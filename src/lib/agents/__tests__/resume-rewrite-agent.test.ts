// @vitest-environment node
// Resume Rewrite Agent 测试(4.4):固定样例集(修改数一致、originalText 逐字摘抄、
// 无量化数据片段不虚构数字、输入透传)+ 边界用例(非法 JSON/违反 Schema/非法输入/进度事件)+ 意图注册
import { describe, it, expect } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import { normalizeWhitespace } from "@/lib/resume/final-text";
import { rewriteAnalysisSchema } from "@/lib/resume/analysis-schemas";
import { resumeRewriteAgent } from "../resume.agent";
import { AgentInputError, AgentOutputError } from "../types";
import { resumeRewriteSamples } from "./resume-rewrite-samples";

describe("Resume Rewrite Agent 固定样例集", () => {
  for (const sample of resumeRewriteSamples) {
    it(`样例 ${sample.id}(${sample.description}):输出通过 Schema,originalText 逐字摘抄,无数字片段不虚构`, async () => {
      let capturedUserMessage = "";
      const adapter = new MockAdapter(0, (messages) => {
        capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
        return JSON.stringify(sample.mockOutput);
      });
      const result = await resumeRewriteAgent.execute(sample.input, {}, { adapter });

      // 输出通过 outputSchema(execute 内部已校验;此处再独立断言一次)
      expect(rewriteAnalysisSchema.safeParse(result.data).success).toBe(true);
      expect(result.data.modifications).toHaveLength(sample.expectedModificationCount);

      // 原文逐字约束:每条 originalText 空白归一化后必须存在于原文
      const normalizedOriginal = normalizeWhitespace(sample.originalText);
      for (const modification of result.data.modifications) {
        expect(normalizedOriginal).toContain(normalizeWhitespace(modification.originalText));
      }

      // 无量化数据不虚构数字:标注片段改写后不得出现任何数字
      for (const index of sample.noDigitsAt) {
        const optimized = result.data.modifications[index]!.optimizedText;
        expect(optimized).not.toMatch(/\d/);
      }

      // 输入数据确实传给了模型(能力标签与目标方向进入 user 消息)
      for (const tag of sample.input.abilityTags) {
        expect(capturedUserMessage).toContain(tag.name);
      }
      expect(capturedUserMessage).toContain(sample.input.targetDirection);
    });
  }

  it("同一输入执行两次:输出结构一致", async () => {
    const sample = resumeRewriteSamples[0]!;
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const first = await resumeRewriteAgent.execute(sample.input, {}, { adapter });
    const second = await resumeRewriteAgent.execute(sample.input, {}, { adapter });
    expect(second.data).toEqual(first.data);
  });
});

describe("Resume Rewrite Agent 边界用例", () => {
  const sample = resumeRewriteSamples[0]!;

  it("模型输出非法 JSON → AgentOutputError", async () => {
    const adapter = new MockAdapter(0, () => "抱歉,我无法输出 JSON。");
    await expect(resumeRewriteAgent.execute(sample.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出违反 Schema(建议不足 3 条)→ AgentOutputError", async () => {
    const invalid = { modifications: sample.mockOutput.modifications.slice(0, 2) };
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(resumeRewriteAgent.execute(sample.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("输入违反 Schema(目标方向为空)→ AgentInputError", async () => {
    await expect(
      resumeRewriteAgent.execute({ ...sample.input, targetDirection: "" }, {})
    ).rejects.toBeInstanceOf(AgentInputError);
  });

  it("执行过程产出 5 个顺序生命周期进度事件", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const stages: string[] = [];
    await resumeRewriteAgent.execute(sample.input, {}, {
      adapter,
      onProgress: (p) => stages.push(p.stage),
    });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });
});

describe("Resume Rewrite Agent 注册(4.4)", () => {
  it("intent rewrite-resume 路由到 Resume Rewrite Agent", async () => {
    const { registry } = await import("../index");
    expect(registry.findByIntent("rewrite-resume").config.name).toBe("resume-rewrite-agent");
    expect(registry.get("resume-rewrite-agent")).toBe(resumeRewriteAgent);
  });
});
