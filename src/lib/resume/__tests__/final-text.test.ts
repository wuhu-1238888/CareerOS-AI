// @vitest-environment node
// 最终采纳文本纯函数测试(4.4):validateModifications(逐字存在/空白折叠/重叠拦截/按位置排序)
// + buildFinalResumeText(全 pending/全 accepted/混合/乱序输入/空白归一化替换/未匹配回退/重叠防御)
import { describe, it, expect } from "vitest";
import { buildFinalResumeText, normalizeWhitespace, validateModifications } from "../final-text";
import type { OptimizationText } from "../final-text";
import type { Modification } from "@/lib/resume/analysis-schemas";

const original = `张伟
求职意向:后端开发工程师
技能
Java、Spring Boot、MySQL
工作经历
负责电商订单系统开发,日均处理订单 50 万笔`;

function mod(originalText: string, optimizedText: string): Modification {
  return { category: "工作经历", originalText, optimizedText, reason: "测试理由" };
}

function opt(status: string, originalText: string, optimizedText: string): OptimizationText {
  return { status, originalText, optimizedText };
}

describe("normalizeWhitespace", () => {
  it("连续空白折叠为单空格并去首尾", () => {
    expect(normalizeWhitespace("  a\n\n b \t")).toBe("a b");
  });
});

describe("validateModifications", () => {
  it("片段全部逐字存在(允许空白差异):ok 且按原文位置升序返回", () => {
    const result = validateModifications(original, [
      mod("负责电商订单系统开发,日均处理订单 50 万笔", "改写1"),
      mod("Java、Spring Boot、MySQL", "改写2"),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.modifications.map((m) => m.originalText)).toEqual([
      "Java、Spring Boot、MySQL",
      "负责电商订单系统开发,日均处理订单 50 万笔",
    ]);
  });

  it("片段不在原文 → 失败(整次拒绝)", () => {
    const result = validateModifications(original, [mod("不存在的原文片段", "改写")]);
    expect(result).toEqual({ ok: false, error: "改写结果与简历原文不一致,请重新分析" });
  });

  it("空白片段 → 失败", () => {
    const result = validateModifications(original, [mod("   ", "改写")]);
    expect(result).toEqual({ ok: false, error: "存在空白的原文引用,请重新分析" });
  });

  it("区间重叠 → 失败", () => {
    const result = validateModifications(original, [
      mod("Java、Spring Boot", "改写1"),
      mod("Spring Boot、MySQL", "改写2"),
    ]);
    expect(result).toEqual({ ok: false, error: "修改建议区间重叠,请重新分析" });
  });
});

describe("buildFinalResumeText", () => {
  it("全部 pending:返回原文", () => {
    const optimizations = [
      opt("pending", "Java、Spring Boot、MySQL", "改写1"),
      opt("pending", "负责电商订单系统开发,日均处理订单 50 万笔", "改写2"),
    ];
    expect(buildFinalResumeText(original, optimizations)).toBe(original);
  });

  it("全部 accepted:替换为优化文本", () => {
    const result = buildFinalResumeText(original, [
      opt("accepted", "Java、Spring Boot、MySQL", "技能改写"),
      opt("accepted", "负责电商订单系统开发,日均处理订单 50 万笔", "经历改写"),
    ]);
    expect(result).toContain("技能改写");
    expect(result).toContain("经历改写");
    expect(result).not.toContain("Java、Spring Boot、MySQL");
    expect(result).not.toContain("负责电商订单系统开发");
  });

  it("混合状态:accepted 替换,pending/rejected 保持原文", () => {
    const result = buildFinalResumeText(original, [
      opt("accepted", "Java、Spring Boot、MySQL", "技能改写"),
      opt("pending", "负责电商订单系统开发,日均处理订单 50 万笔", "经历改写"),
      opt("rejected", "后端开发工程师", "求职意向改写"),
    ]);
    expect(result).toContain("技能改写");
    expect(result).toContain("负责电商订单系统开发,日均处理订单 50 万笔");
    expect(result).toContain("后端开发工程师");
  });

  it("乱序输入:仍按原文位置升序替换(结果与输入顺序无关)", () => {
    const a = opt("accepted", "负责电商订单系统开发,日均处理订单 50 万笔", "经历改写");
    const b = opt("accepted", "Java、Spring Boot、MySQL", "技能改写");
    const forward = buildFinalResumeText(original, [b, a]);
    const backward = buildFinalResumeText(original, [a, b]);
    expect(forward).toBe(backward);
    expect(forward).toContain("技能改写");
    expect(forward).toContain("经历改写");
  });

  it("片段与原文存在空白差异(空白串长度/换行差异):空白归一化定位并精确替换", () => {
    const result = buildFinalResumeText(original, [
      opt("accepted", "负责电商订单系统开发,日均处理订单  50 万笔", "经历改写"),
      opt("accepted", "Java、Spring\nBoot、MySQL", "技能改写"),
    ]);
    expect(result).toBe(
      `张伟
求职意向:后端开发工程师
技能
技能改写
工作经历
经历改写`
    );
  });

  it("accepted 片段未命中原文:跳过该条,其余照常替换", () => {
    const result = buildFinalResumeText(original, [
      opt("accepted", "原文没有的片段", "不会出现"),
      opt("accepted", "Java、Spring Boot、MySQL", "技能改写"),
    ]);
    expect(result).toContain("技能改写");
    expect(result).not.toContain("不会出现");
  });

  it("重叠的 accepted 片段:防御性跳过后者(管线层已校验,此处兜底)", () => {
    const result = buildFinalResumeText(original, [
      opt("accepted", "Java、Spring Boot", "改写A"),
      opt("accepted", "Spring Boot、MySQL", "改写B"),
    ]);
    expect(result).toContain("改写A");
    expect(result).not.toContain("改写B");
    expect(result).toContain("MySQL");
  });
});
