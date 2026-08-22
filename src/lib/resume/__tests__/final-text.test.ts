// @vitest-environment node
// 最终采纳文本纯函数测试(4.4,校验修订后):validateModifications(逐字存在/空白折叠/逐条过滤——
// 无效条目丢弃不拖垮整次,≥1 条有效即成功;同短语多处出现取下一处不重叠命中/按位置升序)
// + buildFinalResumeText(全 pending/全 accepted/混合/乱序输入/空白归一化替换/未匹配回退/重叠防御)
import { describe, it, expect } from "vitest";
import {
  buildFinalResumeText,
  buildFinalTextForVersion,
  normalizeWhitespace,
  validateModifications,
} from "../final-text";
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

  it("片段不在原文 → 0 条有效,整次失败", () => {
    const result = validateModifications(original, [mod("不存在的原文片段", "改写")]);
    expect(result).toEqual({ ok: false, error: "改写结果与简历原文不一致,请重新分析" });
  });

  it("空白片段 → 丢弃,0 条有效时整次失败(统一文案)", () => {
    const result = validateModifications(original, [mod("   ", "改写")]);
    expect(result).toEqual({ ok: false, error: "改写结果与简历原文不一致,请重新分析" });
  });

  it("区间重叠 → 丢弃后条,保留先接受的一条", () => {
    const result = validateModifications(original, [
      mod("Java、Spring Boot", "改写1"),
      mod("Spring Boot、MySQL", "改写2"),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.modifications.map((m) => m.originalText)).toEqual(["Java、Spring Boot"]);
  });

  it("同短语多处出现:各取下一处不重叠命中,两条都保留", () => {
    const repeated = `工作经历
负责订单系统开发
项目经历
负责订单系统开发`;
    const result = validateModifications(repeated, [
      mod("负责订单系统开发", "改写1"),
      mod("负责订单系统开发", "改写2"),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.modifications).toHaveLength(2);
  });

  it("混合有效/无效/空白:过滤后保留有效子集并按位置升序", () => {
    const result = validateModifications(original, [
      mod("原文没有的片段", "不会出现"),
      mod("负责电商订单系统开发,日均处理订单 50 万笔", "改写1"),
      mod("  ", "空白"),
      mod("Java、Spring Boot、MySQL", "改写2"),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.modifications.map((m) => m.originalText)).toEqual([
      "Java、Spring Boot、MySQL",
      "负责电商订单系统开发,日均处理订单 50 万笔",
    ]);
  });

  it("片段与原文存在空白差异(换行/多空格):空白归一化后仍命中", () => {
    const result = validateModifications(original, [
      mod("负责电商订单系统开发,日均处理订单  50 万笔", "改写1"),
      mod("Java、Spring\nBoot、MySQL", "改写2"),
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.modifications).toHaveLength(2);
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

describe("buildFinalTextForVersion(canonical finalText 单一构造入口,4.10-layout)", () => {
  // DB 行形状:文本列可空;serializeVersion(预览/复制/导出)与 scoreAts(ATS 评分)共用此入口
  it("与 buildFinalResumeText 输出一致,并过滤空文本行", () => {
    const rows = [
      { status: "accepted", originalText: "Java、Spring Boot、MySQL", optimizedText: "技能改写" },
      { status: "accepted", originalText: null, optimizedText: null }, // 防御过滤
      { status: "rejected", originalText: "负责订单系统", optimizedText: "不应出现" },
    ];
    expect(buildFinalTextForVersion(original, rows)).toBe(
      buildFinalResumeText(original, [opt("accepted", "Java、Spring Boot、MySQL", "技能改写")])
    );
    expect(buildFinalTextForVersion(original, rows)).not.toContain("不应出现");
  });

  it("全空文本行:退化为原文(与 serializeVersion/scoreAts 共用语义)", () => {
    const rows = [
      { status: "accepted", originalText: null, optimizedText: null },
      { status: "accepted", originalText: null, optimizedText: "孤立改写" },
    ];
    expect(buildFinalTextForVersion(original, rows)).toBe(original);
  });
});
