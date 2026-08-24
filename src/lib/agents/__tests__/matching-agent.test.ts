// @vitest-environment node
// Matching Agent 测试(6.1):固定样例集(Schema 通过/拆解与标注一致/纯英文 JD/无画像降级)+ 边界用例
// (非法 JSON、违反 Schema、空 JD、进度事件、纠偏反馈透传、意图注册)
import { describe, it, expect } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import { matchingAgent } from "../matching.agent";
import { matchAnalysisSchema } from "../matching.agent";
import { AgentInputError, AgentOutputError } from "../types";
import { matchingSamples } from "./matching-samples";
import type { MatchAnalysisInput } from "../matching.agent";

describe("Matching Agent 固定样例集", () => {
  for (const sample of matchingSamples) {
    it(`样例 ${sample.id}(${sample.description}):输出通过 Schema,拆解与标注一致`, async () => {
      let capturedUserMessage = "";
      const adapter = new MockAdapter(0, (messages) => {
        capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
        return JSON.stringify(sample.mockOutput);
      });
      const result = await matchingAgent.execute(sample.input, {}, { adapter });

      // 输出通过 outputSchema(execute 内部已校验;此处再独立断言一次)
      expect(matchAnalysisSchema.safeParse(result.data).success).toBe(true);

      // JD 拆解与标注一致:期望关键词出现在要求文本中
      const requirementTexts = result.data.requirements.map((r) => r.text).join("\n");
      for (const keyword of sample.expectedRequirementKeywords) {
        expect(requirementTexts).toContain(keyword);
      }
      // 匹配度与标注一致(降级样例为 null)
      if (sample.expectedScoreRange === null) {
        expect(result.data.overallScore).toBeNull();
        expect(result.data.items).toHaveLength(0);
      } else {
        const [min, max] = sample.expectedScoreRange;
        expect(result.data.overallScore).toBeGreaterThanOrEqual(min);
        expect(result.data.overallScore).toBeLessThanOrEqual(max);
        expect(result.data.items.length).toBeGreaterThan(0);
      }
      // items[].requirementId 均指向存在的 requirements(superRefine 已保证,双保险)
      const ids = new Set(result.data.requirements.map((r) => r.id));
      for (const item of result.data.items) {
        expect(ids.has(item.requirementId)).toBe(true);
      }
      // 输入数据确实传给了模型(JD 片段 + profileSummary 键)
      expect(capturedUserMessage).toContain("jdText");
      expect(capturedUserMessage).toContain("profileSummary");
    });
  }
});

describe("Matching Agent 方向比对(8.1c)", () => {
  it("冲突样例:directionVerdict 通过 Schema,verdict=conflict,alignedDirection 照抄画像方向", async () => {
    const sample = matchingSamples.find((s) => s.id === "conflict-direction")!;
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const result = await matchingAgent.execute(sample.input, {}, { adapter });
    expect(result.data.directionVerdict?.verdict).toBe("conflict");
    expect(result.data.directionVerdict?.alignedDirection).toBe("后端开发");
    expect(result.data.directionVerdict?.reason.length).toBeGreaterThan(0);
  });

  it("一致样例:verdict=aligned,reason 说明一致依据", async () => {
    const sample = matchingSamples.find((s) => s.id === "aligned-direction")!;
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const result = await matchingAgent.execute(sample.input, {}, { adapter });
    expect(result.data.directionVerdict?.verdict).toBe("aligned");
    expect(result.data.directionVerdict?.reason).toContain("一致");
  });

  it("旧夹具无 directionVerdict 字段:解析后为 null(default 生效),零改动兼容", async () => {
    const legacy = matchingSamples.find((s) => s.id === "backend-with-profile")!;
    const adapter = new MockAdapter(0, () => JSON.stringify(legacy.mockOutput));
    const result = await matchingAgent.execute(legacy.input, {}, { adapter });
    expect(result.data.directionVerdict).toBeNull();
  });

  it("模型输出 directionVerdict.reason 超长 → AgentOutputError", async () => {
    const invalid: MatchAnalysisInput = {
      ...matchingSamples[0]!.mockOutput,
      directionVerdict: { alignedDirection: "后端开发", verdict: "conflict", reason: "x".repeat(101) },
    };
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(
      matchingAgent.execute(matchingSamples[0]!.input, {}, { adapter })
    ).rejects.toBeInstanceOf(AgentOutputError);
  });
});

describe("Matching Agent 边界用例", () => {
  it("纯英文 JD:正常拆解,输出为中文(要求文本含中文字符)", async () => {
    const english = matchingSamples.find((s) => s.id === "english-jd")!;
    const adapter = new MockAdapter(0, () => JSON.stringify(english.mockOutput));
    const result = await matchingAgent.execute(english.input, {}, { adapter });
    const requirementTexts = result.data.requirements.map((r) => r.text).join("\n");
    expect(requirementTexts).toMatch(/[一-龥]/);
  });

  it("无画像输入:不报错,items 为空、overallScore 为 null", async () => {
    const noProfile = matchingSamples.find((s) => s.id === "no-profile")!;
    const adapter = new MockAdapter(0, () => JSON.stringify(noProfile.mockOutput));
    const result = await matchingAgent.execute(noProfile.input, {}, { adapter });
    expect(result.data.items).toHaveLength(0);
    expect(result.data.overallScore).toBeNull();
    expect(result.data.requirements.length).toBeGreaterThan(0);
  });

  it("模型输出非法 JSON → AgentOutputError(保留原始文本)", async () => {
    const adapter = new MockAdapter(0, () => "这不是一个 JSON,抱歉。");
    await expect(
      matchingAgent.execute(matchingSamples[0]!.input, {}, { adapter })
    ).rejects.toBeInstanceOf(AgentOutputError);
  });

  it("模型输出违反 Schema(overallScore 超范围)→ AgentOutputError", async () => {
    const invalid: MatchAnalysisInput = { ...matchingSamples[0]!.mockOutput, overallScore: 150 };
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(
      matchingAgent.execute(matchingSamples[0]!.input, {}, { adapter })
    ).rejects.toBeInstanceOf(AgentOutputError);
  });

  it("模型输出违反 Schema(items 指向不存在的 requirementId)→ AgentOutputError", async () => {
    const invalid: MatchAnalysisInput = {
      ...matchingSamples[0]!.mockOutput,
      items: [
        {
          requirementId: "req-999",
          status: "达标",
          matchType: "直接",
          userEvidence: "证据",
          gap: "无明显差距",
        },
      ],
    };
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(
      matchingAgent.execute(matchingSamples[0]!.input, {}, { adapter })
    ).rejects.toBeInstanceOf(AgentOutputError);
  });

  it("输入违反 Schema(空 JD)→ AgentInputError", async () => {
    const badInput = { ...matchingSamples[0]!.input, jdText: "" };
    await expect(matchingAgent.execute(badInput, {})).rejects.toBeInstanceOf(AgentInputError);
  });

  it("执行过程产出 5 个顺序生命周期进度事件", async () => {
    const sample = matchingSamples[0]!;
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const stages: string[] = [];
    await matchingAgent.execute(sample.input, {}, { adapter, onProgress: (p) => stages.push(p.stage) });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });

  it("纠偏反馈透传:requirementId 与 note 内容进入模型输入(6.2 依赖)", async () => {
    let captured = "";
    const adapter = new MockAdapter(0, (messages) => {
      captured = messages.find((m) => m.role === "user")?.content ?? "";
      return JSON.stringify(matchingSamples[0]!.mockOutput);
    });
    await matchingAgent.execute(
      {
        ...matchingSamples[0]!.input,
        feedback: [{ requirementId: "req-3", note: "Redis 我在课程项目里实际用过" }],
      },
      {},
      { adapter }
    );
    expect(captured).toContain("req-3");
    expect(captured).toContain("Redis 我在课程项目里实际用过");
  });
});

describe("Agent 注册(6.1)", () => {
  it("intent analyze-match 路由到 Matching Agent", async () => {
    const { registry } = await import("../index");
    expect(registry.findByIntent("analyze-match").config.name).toBe("job-matching-agent");
    expect(registry.get("job-matching-agent")).toBe(matchingAgent);
  });
});
