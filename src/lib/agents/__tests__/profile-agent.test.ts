// @vitest-environment node
// Profile Agent 测试(2.3):固定样例集(Schema 通过/方向与标注一致/置信度随完整度变化)+ 边界用例
// (非法 JSON、违反 Schema、非法输入、进度事件、纠偏反馈透传、意图注册)
import { describe, it, expect } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import { profileAgent } from "../profile.agent";
import { profileAnalysisSchema } from "../profile.agent";
import { AgentInputError, AgentOutputError } from "../types";
import { profileSamples } from "./profile-samples";
import type { ProfileAnalysis } from "../profile.agent";

describe("Profile Agent 固定样例集", () => {
  for (const sample of profileSamples) {
    it(`样例 ${sample.id}(${sample.description}):输出通过 Schema,方向与标注一致,置信度 ${sample.expectedConfidence}`, async () => {
      let capturedUserMessage = "";
      const adapter = new MockAdapter(0, (messages) => {
        capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
        return JSON.stringify(sample.mockOutput);
      });
      const result = await profileAgent.execute(sample.input, {}, { adapter });

      // 输出通过 outputSchema(execute 内部已校验;此处再独立断言一次)
      expect(profileAnalysisSchema.safeParse(result.data).success).toBe(true);

      // 方向推荐与标注一致
      const directionNames = result.data.directions.map((d) => d.name);
      for (const expected of sample.expectedDirections) {
        expect(directionNames).toContain(expected);
      }
      // 置信度随信息完整度变化
      expect(result.data.confidence.level).toBe(sample.expectedConfidence);
      // 数量约束:方向 2-4、优势 3-5、匹配度 0-100
      expect(result.data.directions.length).toBeGreaterThanOrEqual(2);
      expect(result.data.directions.length).toBeLessThanOrEqual(4);
      expect(result.data.strengths.length).toBeGreaterThanOrEqual(3);
      for (const direction of result.data.directions) {
        expect(direction.matchScore).toBeGreaterThanOrEqual(0);
        expect(direction.matchScore).toBeLessThanOrEqual(100);
      }
      // 输入数据确实传给了模型(含教育专业与反馈键)
      expect(capturedUserMessage).toContain(sample.input.education[0]!.major);
      expect(capturedUserMessage).toContain("feedback");
    });
  }
});

describe("Profile Agent 边界用例", () => {
  it("最小输入(仅必填项):正常产出,低置信度,不报错", async () => {
    const minimal = profileSamples.find((s) => s.id === "minimal")!;
    const adapter = new MockAdapter(0, () => JSON.stringify(minimal.mockOutput));
    const result = await profileAgent.execute(minimal.input, {}, { adapter });
    expect(result.data.confidence.level).toBe("低");
    expect(result.data.summary).toBeTruthy();
  });

  it("模型输出非法 JSON → AgentOutputError(保留原始文本)", async () => {
    const adapter = new MockAdapter(0, () => "这不是一个 JSON,抱歉。");
    await expect(profileAgent.execute(profileSamples[0]!.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出违反 Schema(matchScore 超范围)→ AgentOutputError", async () => {
    const invalid: ProfileAnalysis = { ...profileSamples[0]!.mockOutput };
    invalid.directions = invalid.directions.map((d) => ({ ...d, matchScore: 150 }));
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(profileAgent.execute(profileSamples[0]!.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("输入违反 Schema(技能为空)→ AgentInputError", async () => {
    const badInput = { ...profileSamples[0]!.input, skills: [] };
    await expect(profileAgent.execute(badInput, {})).rejects.toBeInstanceOf(AgentInputError);
  });

  it("执行过程产出 5 个顺序生命周期进度事件", async () => {
    const sample = profileSamples[0]!;
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const stages: string[] = [];
    await profileAgent.execute(sample.input, {}, { adapter, onProgress: (p) => stages.push(p.stage) });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });

  it("纠偏反馈透传:feedback 内容进入模型输入(2.6 依赖)", async () => {
    let captured = "";
    const adapter = new MockAdapter(0, (messages) => {
      captured = messages.find((m) => m.role === "user")?.content ?? "";
      return JSON.stringify(profileSamples[0]!.mockOutput);
    });
    await profileAgent.execute(
      {
        ...profileSamples[0]!.input,
        feedback: { areas: ["ability"], note: "Python 其实只写过课程作业" },
      },
      {},
      { adapter }
    );
    expect(captured).toContain("ability");
    expect(captured).toContain("Python 其实只写过课程作业");
  });
});

describe("Agent 注册(2.3)", () => {
  it("intent analyze-profile 路由到 Profile Agent", async () => {
    const { registry } = await import("../index");
    expect(registry.findByIntent("analyze-profile").config.name).toBe("career-profile-analyzer");
    expect(registry.get("career-profile-analyzer")).toBe(profileAgent);
  });
});
