// @vitest-environment node
// Skill Coach Agent 测试(6.3):固定样例集(Schema 通过/P0 标注一致/13 周连续/预算不超)+ 边界用例
// (非法 JSON、预算违反、P0 规则违反、周数错误、里程碑越界、空差距清单、进度事件、意图注册)
import { describe, it, expect } from "vitest";
import { MockAdapter } from "@/lib/llm/mock";
import { skillCoachAgent } from "../coach.agent";
import { coachPlanSchema } from "../coach.agent";
import { AgentInputError, AgentOutputError } from "../types";
import { coachSamples } from "./coach-samples";
import type { CoachPlan } from "../coach.agent";

describe("Skill Coach Agent 固定样例集", () => {
  for (const sample of coachSamples) {
    it(`样例 ${sample.id}(${sample.description}):输出通过 Schema,P0 与标注一致,13 周连续且预算不超`, async () => {
      let capturedUserMessage = "";
      const adapter = new MockAdapter(0, (messages) => {
        capturedUserMessage = messages.find((m) => m.role === "user")?.content ?? "";
        return JSON.stringify(sample.mockOutput);
      });
      const result = await skillCoachAgent.execute(sample.input, {}, { adapter });

      // 输出通过 outputSchema(execute 内部已校验;此处再独立断言一次)
      expect(coachPlanSchema.safeParse(result.data).success).toBe(true);

      // P0 技能与标注一致
      const p0Skills = result.data.priorityMatrix
        .filter((item) => item.priority === "P0")
        .map((item) => item.skill);
      for (const expected of sample.expectedP0Skills) {
        expect(p0Skills).toContain(expected);
      }
      // 13 周连续 1..13
      expect(result.data.weeks.map((w) => w.week)).toEqual(
        Array.from({ length: 13 }, (_, i) => i + 1)
      );
      // 每周任务总时长 ≤ 周时预算
      const budget = result.data.weeklyHours * 60;
      for (const week of result.data.weeks) {
        const total = week.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
        expect(total).toBeLessThanOrEqual(budget);
      }
      // 资源全部标注 cost
      for (const resource of result.data.resources) {
        expect(["free", "paid"]).toContain(resource.cost);
      }
      // 输入数据确实传给了模型(岗位名 + 周时键)
      expect(capturedUserMessage).toContain(sample.input.targetPosition);
      expect(capturedUserMessage).toContain("weeklyHours");
    });
  }
});

describe("Skill Coach Agent 边界用例", () => {
  const base = coachSamples[0]!;

  it("模型输出非法 JSON → AgentOutputError(保留原始文本)", async () => {
    const adapter = new MockAdapter(0, () => "这不是一个 JSON,抱歉。");
    await expect(skillCoachAgent.execute(base.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出违反时间预算(第 1 周任务总时长超预算)→ AgentOutputError", async () => {
    const invalid: CoachPlan = structuredClone(base.mockOutput);
    // 2 任务 × 400 分钟 = 800 > 预算 10h×60 = 600,确定违反预算规则
    invalid.weeks[0]!.tasks = invalid.weeks[0]!.tasks.map((t) => ({ ...t, estimatedMinutes: 400 }));
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(skillCoachAgent.execute(base.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型自报违规优先级(重要 5 差距大却标 P1)→ 归一化为 P0,不拒绝(2026-08-23 修正)", async () => {
    const invalid: CoachPlan = structuredClone(base.mockOutput);
    invalid.priorityMatrix[0]!.priority = "P1";
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    const result = await skillCoachAgent.execute(base.input, {}, { adapter });
    expect(result.data.priorityMatrix[0]).toMatchObject({ skill: "Redis 与缓存", priority: "P0" });
  });

  it("模型输出矩阵未按重要性降序 → 归一化重排,不拒绝(2026-08-23 修正)", async () => {
    const invalid: CoachPlan = structuredClone(base.mockOutput);
    invalid.priorityMatrix = [invalid.priorityMatrix[3]!, invalid.priorityMatrix[0]!];
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    const result = await skillCoachAgent.execute(base.input, {}, { adapter });
    const importances = result.data.priorityMatrix.map((m) => m.importance);
    expect(importances).toEqual([...importances].sort((a, b) => b - a));
    expect(result.data.priorityMatrix[0]!.skill).toBe("Redis 与缓存");
  });

  it("真实 LLM 典型违规组合(重要 5/差距中 标 P0、重要 4/差距小 标 P2、乱序)→ 全部归一化", async () => {
    // 复刻 2026-08-23 DeepSeek 实际输出:重要性高但差距非「大」被标 P0、重要性 4 差距小被标 P2、矩阵乱序
    const invalid: CoachPlan = structuredClone(base.mockOutput);
    invalid.priorityMatrix = [
      { skill: "测试文档编写", importance: 5, gapSize: "中", priority: "P0", reason: "x" },
      { skill: "软件测试流程", importance: 4, gapSize: "中", priority: "P0", reason: "x" },
      { skill: "计算机基础知识", importance: 5, gapSize: "小", priority: "P2", reason: "x" },
      { skill: "客户沟通与协作", importance: 4, gapSize: "小", priority: "P2", reason: "x" },
      { skill: "性能测试工具", importance: 3, gapSize: "中", priority: "P1", reason: "x" },
    ];
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    const result = await skillCoachAgent.execute(base.input, {}, { adapter });
    expect(result.data.priorityMatrix.map((m) => [m.skill, m.priority])).toEqual([
      ["测试文档编写", "P1"], // 重要 5 + 差距中 → P1(不是模型自报的 P0);同重要性时差距大者在前
      ["计算机基础知识", "P1"], // 重要 5 + 差距小 → P1(不是模型自报的 P2)
      ["软件测试流程", "P1"],
      ["客户沟通与协作", "P1"], // 重要 4 + 差距小 → P1(不是模型自报的 P2)
      ["性能测试工具", "P2"], // 重要 3 + 差距中 → P2(不是模型自报的 P1)
    ]);
  });

  it("模型输出 12 周(周数不足)→ AgentOutputError", async () => {
    const invalid: CoachPlan = structuredClone(base.mockOutput);
    invalid.weeks = invalid.weeks.slice(0, 12);
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(skillCoachAgent.execute(base.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("模型输出里程碑周次越界(week=99)→ AgentOutputError", async () => {
    const invalid: CoachPlan = structuredClone(base.mockOutput);
    invalid.milestones = [...invalid.milestones, { week: 99, title: "越界里程碑" }];
    const adapter = new MockAdapter(0, () => JSON.stringify(invalid));
    await expect(skillCoachAgent.execute(base.input, {}, { adapter })).rejects.toBeInstanceOf(
      AgentOutputError
    );
  });

  it("输入违反 Schema(空差距清单)→ AgentInputError", async () => {
    const badInput = { ...base.input, requirements: [] };
    await expect(skillCoachAgent.execute(badInput, {})).rejects.toBeInstanceOf(AgentInputError);
  });

  it("执行过程产出 5 个顺序生命周期进度事件", async () => {
    const adapter = new MockAdapter(0, () => JSON.stringify(base.mockOutput));
    const stages: string[] = [];
    await skillCoachAgent.execute(base.input, {}, { adapter, onProgress: (p) => stages.push(p.stage) });
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });
});

describe("Agent 注册(6.3)", () => {
  it("intent build-coach-plan 路由到 Skill Coach Agent", async () => {
    const { registry } = await import("../index");
    expect(registry.findByIntent("build-coach-plan").config.name).toBe("skill-coach-agent");
    expect(registry.get("skill-coach-agent")).toBe(skillCoachAgent);
  });
});
