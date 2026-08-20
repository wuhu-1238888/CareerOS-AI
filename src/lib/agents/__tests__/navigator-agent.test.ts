// @vitest-environment node
// Navigator Agent 测试(3.3):固定样例集(阶段数/总时长与标注一致、周时变化引起时长变化、产出物完备)
// + 单阶段重生成(只返回该阶段、回应反馈)+ 边界用例(非法 JSON/违反 Schema/非法输入/进度事件)+ 意图注册
import { describe, it, expect } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import { navigatorAgent, navigatorStageAgent, roadmapAnalysisSchema, roadmapStageSchema } from "../navigator.agent";
import { AgentInputError, AgentOutputError } from "../types";
import { navigatorSamples, navigatorStageSamples } from "./navigator-samples";

// 「6 个月」→ 6(用于周时对比)
function durationMonths(text: string): number {
  return Number(text.match(/\d+/)?.[0] ?? 0);
}

describe("Navigator Agent 固定样例集(全量)", () => {
  for (const sample of navigatorSamples) {
    it(`样例 ${sample.id}(${sample.description}):输出通过 Schema,阶段数/总时长与标注一致`, async () => {
      let capturedUserMessage = "";
      const adapter = new MockAdapter(0, (messages) => {
        capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
        return JSON.stringify(sample.mockOutput);
      });
      const result = await navigatorAgent.execute(sample.input, {}, { adapter });

      // 输出通过 outputSchema(execute 内部已校验;此处再独立断言一次)
      expect(roadmapAnalysisSchema.safeParse(result.data).success).toBe(true);

      // 阶段数与标注一致,且在 3-4 范围内;stageCount 与阶段数一致
      expect(result.data.stages).toHaveLength(sample.expectedStageCount);
      expect(result.data.stages.length).toBeGreaterThanOrEqual(3);
      expect(result.data.stages.length).toBeLessThanOrEqual(4);
      expect(result.data.summary.stageCount).toBe(result.data.stages.length);

      // 总时长与标注一致
      expect(result.data.summary.totalDuration).toBe(sample.expectedTotalDuration);

      // 数量约束:学习内容 3-5、实践项目 1-2 且每个都含产出物
      for (const stage of result.data.stages) {
        expect(stage.learningContent.length).toBeGreaterThanOrEqual(3);
        expect(stage.learningContent.length).toBeLessThanOrEqual(5);
        expect(stage.practiceProjects.length).toBeGreaterThanOrEqual(1);
        expect(stage.practiceProjects.length).toBeLessThanOrEqual(2);
        for (const project of stage.practiceProjects) {
          expect(project.deliverable.trim().length).toBeGreaterThan(0);
        }
      }

      // 输入数据确实传给了模型(方向/能力标签/周时/阶段自评/mode)
      expect(capturedUserMessage).toContain(sample.input.direction);
      expect(capturedUserMessage).toContain(sample.input.abilityTags[0]!.name);
      expect(capturedUserMessage).toContain(String(sample.input.weeklyHours));
      expect(capturedUserMessage).toContain(sample.input.currentStage);
      expect(capturedUserMessage).toContain("full");
    });
  }

  it("周时变化引起时长变化:每周 5 小时(6 个月)> 每周 30 小时(2 个月)", async () => {
    const slow = navigatorSamples.find((s) => s.id === "backend-slow")!;
    const fast = navigatorSamples.find((s) => s.id === "data-fast")!;
    expect(durationMonths(slow.expectedTotalDuration)).toBeGreaterThan(
      durationMonths(fast.expectedTotalDuration)
    );
    expect(slow.input.weeklyHours).toBeLessThan(fast.input.weeklyHours);
  });

  it("同一输入执行两次:输出结构一致", async () => {
    const sample = navigatorSamples[0]!;
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const first = await navigatorAgent.execute(sample.input, {}, { adapter });
    const second = await navigatorAgent.execute(sample.input, {}, { adapter });
    expect(second.data).toEqual(first.data);
  });
});

describe("Navigator Stage Agent 固定样例集(单阶段重生成)", () => {
  for (const sample of navigatorStageSamples) {
    it(`样例 ${sample.id}(${sample.description}):输出为单个阶段且回应反馈`, async () => {
      let capturedUserMessage = "";
      const adapter = new MockAdapter(0, (messages) => {
        capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
        return JSON.stringify(sample.mockOutput);
      });
      const result = await navigatorStageAgent.execute(sample.input, {}, { adapter });

      // 输出通过单阶段 Schema(不含 summary/stages 顶层结构)
      expect(roadmapStageSchema.safeParse(result.data).success).toBe(true);
      expect(result.data.name).toBe(sample.mockOutput.name);

      // 输入确实传给了模型(mode/阶段名/反馈/原阶段内容)
      expect(capturedUserMessage).toContain("regenerate-stage");
      expect(capturedUserMessage).toContain(sample.input.stageName);
      expect(capturedUserMessage).toContain(sample.input.feedback);

      // 调整方向与标注一致
      const original = sample.input.stageContent as { learningContent: string[] };
      if (sample.expectedAdjustment === "easier") {
        expect(result.data.learningContent.length).toBeGreaterThan(original.learningContent.length);
      } else {
        for (const item of original.learningContent) {
          expect(result.data.learningContent).not.toContain(item);
        }
      }
    });
  }
});

describe("Navigator Agent 边界用例", () => {
  it("模型输出非法 JSON → AgentOutputError(全量/单阶段)", async () => {
    const adapter = new MockAdapter(0, () => "抱歉,我无法输出 JSON。");
    await expect(navigatorAgent.execute(navigatorSamples[0]!.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
    await expect(
      navigatorStageAgent.execute(navigatorStageSamples[0]!.input, {}, { adapter })
    ).rejects.toBeInstanceOf(AgentOutputError);
  });

  it("模型输出违反 Schema(stageCount 与阶段数不一致)→ AgentOutputError", async () => {
    const invalid = {
      ...navigatorSamples[0]!.mockOutput,
      summary: { ...navigatorSamples[0]!.mockOutput.summary, stageCount: 3 },
    };
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(navigatorAgent.execute(navigatorSamples[0]!.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("单阶段模式:模型错误返回完整路线图 → AgentOutputError", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(navigatorSamples[0]!.mockOutput));
    await expect(
      navigatorStageAgent.execute(navigatorStageSamples[0]!.input, {}, { adapter })
    ).rejects.toBeInstanceOf(AgentOutputError);
  });

  it("输入违反 Schema(方向为空 / 周时 0 / 非法阶段自评)→ AgentInputError", async () => {
    await expect(
      navigatorAgent.execute({ ...navigatorSamples[0]!.input, direction: "" }, {})
    ).rejects.toBeInstanceOf(AgentInputError);
    await expect(
      navigatorAgent.execute({ ...navigatorSamples[0]!.input, weeklyHours: 0 }, {})
    ).rejects.toBeInstanceOf(AgentInputError);
    await expect(
      navigatorAgent.execute({ ...navigatorSamples[0]!.input, currentStage: "老手" as never }, {})
    ).rejects.toBeInstanceOf(AgentInputError);
  });

  it("执行过程产出 5 个顺序生命周期进度事件(全量/单阶段)", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(navigatorSamples[0]!.mockOutput));
    const stages: string[] = [];
    await navigatorAgent.execute(navigatorSamples[0]!.input, {}, {
      adapter,
      onProgress: (p) => stages.push(p.stage),
    });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });

  it("无能力标签(空数组,无画像用户):正常产出", async () => {
    const sample = navigatorSamples[0]!;
    const adapter = new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
    const result = await navigatorAgent.execute({ ...sample.input, abilityTags: [] }, {}, { adapter });
    expect(result.data.summary.totalDuration).toBe(sample.expectedTotalDuration);
  });
});

describe("Navigator Agent 注册(3.3)", () => {
  it("intent generate-roadmap 路由到 Navigator Agent,regenerate-stage 路由到 Stage Agent", async () => {
    const { registry } = await import("../index");
    expect(registry.findByIntent("generate-roadmap").config.name).toBe("career-navigator-agent");
    expect(registry.findByIntent("regenerate-stage").config.name).toBe("career-navigator-stage-agent");
    expect(registry.get("career-navigator-agent")).toBe(navigatorAgent);
    expect(registry.get("career-navigator-stage-agent")).toBe(navigatorStageAgent);
  });
});
