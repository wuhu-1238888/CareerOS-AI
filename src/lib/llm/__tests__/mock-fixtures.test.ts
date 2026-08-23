// @vitest-environment node
// Mock 分发与演示数据测试(2026-08 补):LLM_PROVIDER=mock 时浏览器端可走通匹配/教练全链路。
// 验证:①默认 Mock 回复按 agentName 分发 schema 合规 JSON;②教练演示数据 weeklyHours 回显、
//    时间预算、矩阵排序与 schema 约束;③未知 Agent 保持回显;④真实 Agent 走默认 Mock 全链路成功。
import { describe, it, expect } from "vitest";
import { MockAdapter, defaultMockReply } from "../mock";
import { matchAnalysisSchema } from "@/lib/matching/analysis-schemas";
import { coachPlanSchema } from "@/lib/coach/analysis-schemas";
import { MatchingAgent } from "@/lib/agents/matching.agent";
import { SkillCoachAgent } from "@/lib/agents/coach.agent";
import type { ChatMessage } from "../adapter";

function coachMessages(weeklyHours: number, requirements?: unknown[]): ChatMessage[] {
  return [
    { role: "system", content: "技能教练 system" },
    {
      role: "user",
      content: JSON.stringify({
        targetPosition: "后端开发工程师",
        requirements:
          requirements ?? [
            { name: "Redis 与缓存", importance: 5, gap: "大" },
            { name: "高并发与分布式", importance: 5, gap: "大" },
            { name: "数据结构与算法", importance: 4, gap: "中" },
            { name: "沟通表达", importance: 3, gap: "小" },
          ],
        abilityBaseline: { abilityTags: [{ name: "Python", level: "熟练" }] },
        weeklyHours,
        learningPreference: null,
      }),
    },
  ];
}

describe("Mock 默认回复按 agentName 分发(2026-08 补)", () => {
  it("job-matching-agent:返回可通过 matchAnalysisSchema 的演示报告,且确定性", () => {
    const reply = defaultMockReply([{ role: "user", content: "{\"jdText\":\"测试 JD\"}" }], {
      agentName: "job-matching-agent",
    });
    const parsed = matchAnalysisSchema.safeParse(JSON.parse(reply));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.requirements[0].id).toBe("req-1");
      expect(parsed.data.items.length).toBeGreaterThan(0);
      expect(parsed.data.overallScore).toBe(78);
    }
    expect(defaultMockReply([{ role: "user", content: "x" }], { agentName: "job-matching-agent" })).toBe(reply);
  });

  it("skill-coach-agent:weeklyHours 原样回显、13 周、每周任务不超预算、矩阵按重要性降序", () => {
    const reply = defaultMockReply(coachMessages(10), { agentName: "skill-coach-agent" });
    const parsed = coachPlanSchema.safeParse(JSON.parse(reply));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.weeklyHours).toBe(10);
      expect(parsed.data.weeks).toHaveLength(13);
      parsed.data.weeks.forEach((week) => {
        const total = week.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
        expect(total).toBeLessThanOrEqual(600);
      });
      const importances = parsed.data.priorityMatrix.map((m) => m.importance);
      expect(importances).toEqual([...importances].sort((a, b) => b - a));
      expect(parsed.data.priorityMatrix[0].priority).toBe("P0");
    }
  });

  it("skill-coach-agent:最小投入 1h/周也通过 schema(预算 60 分钟)", () => {
    const reply = defaultMockReply(coachMessages(1), { agentName: "skill-coach-agent" });
    const parsed = coachPlanSchema.safeParse(JSON.parse(reply));
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.weeklyHours).toBe(1);
      parsed.data.weeks.forEach((week) => {
        const total = week.tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
        expect(total).toBeLessThanOrEqual(60);
      });
    }
  });

  it("skill-coach-agent:输入非 JSON 或缺失时回退默认(weeklyHours=10)仍产出合规计划", () => {
    const garbage = defaultMockReply([{ role: "user", content: "纯文本不是 JSON" }], {
      agentName: "skill-coach-agent",
    });
    const parsed = coachPlanSchema.safeParse(JSON.parse(garbage));
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.weeklyHours).toBe(10);
  });

  it("未知 agentName:保持回显行为(旧测试与输入传递断言依赖)", () => {
    const reply = defaultMockReply([{ role: "user", content: "你好" }], { agentName: "some-other-agent" });
    expect(reply).toContain("你好");
    expect(reply).toContain("[mock] 已收到:");
  });

  it("MockAdapter.complete 把 options 透传给 replyFn(不带 agentName 时回显)", async () => {
    const mock = new MockAdapter();
    const dispatched = await mock.complete(coachMessages(10), { agentName: "skill-coach-agent" });
    expect(coachPlanSchema.safeParse(JSON.parse(dispatched.text)).success).toBe(true);
    const echoed = await mock.complete([{ role: "user", content: "你好" }]);
    expect(echoed.text).toContain("你好");
  });
});

describe("真实 Agent × 默认 Mock 全链路(2026-08 补)", () => {
  it("MatchingAgent 默认 Mock:execute 成功且数据过 schema", async () => {
    const agent = new MatchingAgent();
    const result = await agent.execute(
      {
        jdText: "招聘后端开发工程师,熟悉 Python/MySQL。",
        profileSummary: "计算机专业,Py 熟练",
        optimizedResumeText: null,
      },
      {}
    );
    expect(() => matchAnalysisSchema.parse(result.data)).not.toThrow();
    expect(result.model).toBe("mock-1");
  });

  it("SkillCoachAgent 默认 Mock:execute 成功且 weeklyHours 回显", async () => {
    const agent = new SkillCoachAgent();
    const result = await agent.execute(
      {
        targetPosition: "后端开发工程师",
        requirements: [{ name: "Redis 与缓存", importance: 5, gap: "大" }],
        abilityBaseline: { abilityTags: [{ name: "Python", level: "熟练" }] },
        weeklyHours: 7,
      },
      {}
    );
    expect(() => coachPlanSchema.parse(result.data)).not.toThrow();
    expect(result.data.weeklyHours).toBe(7);
  });
});
