// @vitest-environment node
// 匹配报告 → 教练差距清单组装(6.4,纯函数):status→gap 映射、跳过无对比条目、
// name 截断 100 字、最多 15 条、importance 原样带出。
import { describe, it, expect } from "vitest";
import { coachRequirementsFromReport } from "../pipeline";
import type { MatchAnalysis } from "@/lib/matching/analysis-schemas";

// 最小可用报告夹具(雷达六维 + 建议 + 摘要,与输出 Schema 形态一致)
function makeReport(requirements: MatchAnalysis["requirements"], items: MatchAnalysis["items"]): MatchAnalysis {
  return {
    positionTitle: "测试岗位",
    summary: "测试摘要",
    overallScore: 80,
    recommendation: { level: "建议投递", reason: "匹配较好" },
    requirements,
    items,
    jobRadar: { 产品: 50, 技术: 60, 数据: 40, 沟通: 70, 项目: 55, 行业: 45 },
    resumeSuggestions: [],
    directionVerdict: null,
  };
}

describe("coachRequirementsFromReport(6.4 组装逻辑)", () => {
  it("status→gap 映射:不足→大、接近→中、达标→小;importance 原样带出", () => {
    const report = makeReport(
      [
        { id: "req-1", text: "Redis 与缓存", category: "显性", importance: 5 },
        { id: "req-2", text: "沟通表达", category: "显性", importance: 3 },
        { id: "req-3", text: "SQL 基础", category: "显性", importance: 2 },
      ],
      [
        { requirementId: "req-1", status: "不足", matchType: "直接", userEvidence: "略懂", gap: "缺乏实战" },
        { requirementId: "req-2", status: "接近", matchType: "可迁移", userEvidence: "社团经验", gap: "深度不足" },
        { requirementId: "req-3", status: "达标", matchType: "直接", userEvidence: "课程项目", gap: "无明显差距" },
      ]
    );
    expect(coachRequirementsFromReport(report)).toEqual([
      { name: "Redis 与缓存", importance: 5, gap: "大" },
      { name: "沟通表达", importance: 3, gap: "中" },
      { name: "SQL 基础", importance: 2, gap: "小" },
    ]);
  });

  it("跳过无对比条目的要求(仅取有 items 覆盖的条目)", () => {
    const report = makeReport(
      [
        { id: "req-1", text: "有对比", category: "显性", importance: 5 },
        { id: "req-2", text: "无对比", category: "隐性", importance: 4 },
      ],
      [{ requirementId: "req-1", status: "不足", matchType: "直接", userEvidence: "证据", gap: "差距" }]
    );
    expect(coachRequirementsFromReport(report)).toEqual([{ name: "有对比", importance: 5, gap: "大" }]);
  });

  it("name 截断到 100 字(教练输入上限)", () => {
    const longText = "长".repeat(150);
    const report = makeReport(
      [{ id: "req-1", text: longText, category: "显性", importance: 4 }],
      [{ requirementId: "req-1", status: "接近", matchType: "直接", userEvidence: "证据", gap: "差距" }]
    );
    const [result] = coachRequirementsFromReport(report);
    expect(result!.name).toHaveLength(100);
    expect(result!.name).toBe("长".repeat(100));
  });

  it("最多 15 条(截取前 15,与教练输入 Schema 上限一致)", () => {
    const requirements = Array.from({ length: 16 }, (_, i) => ({
      id: `req-${i + 1}`,
      text: `要求 ${i + 1}`,
      category: "显性" as const,
      importance: 5,
    }));
    const items = requirements.map((r) => ({
      requirementId: r.id,
      status: "不足" as const,
      matchType: "直接" as const,
      userEvidence: "证据",
      gap: "差距",
    }));
    const result = coachRequirementsFromReport(makeReport(requirements, items));
    expect(result).toHaveLength(15);
    expect(result[0]!.name).toBe("要求 1");
    expect(result[14]!.name).toBe("要求 15");
  });
});
