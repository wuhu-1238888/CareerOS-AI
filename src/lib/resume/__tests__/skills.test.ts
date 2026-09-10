// 技能文本解析与校验单测:分隔/过滤/去重/边界 + skillsErrorText 文案。
import { describe, expect, it } from "vitest";
import { parseSkillsText, skillsErrorText } from "../skills";

describe("parseSkillsText", () => {
  it("按换行 / 逗号 / 顿号混排拆分,并 trim 空白与全角空格", () => {
    expect(parseSkillsText("Java、 Spring Boot,MySQL\nRedis")).toEqual([
      "Java",
      "Spring Boot",
      "MySQL",
      "Redis",
    ]);
    expect(parseSkillsText("  Java  \n\tPython  ")).toEqual(["Java", "Python"]);
  });

  it("过滤空行与纯分隔符文本", () => {
    expect(parseSkillsText("")).toEqual([]);
    expect(parseSkillsText("\n,\n、\n")).toEqual([]);
    expect(parseSkillsText("Java\n\nPython\n")).toEqual(["Java", "Python"]);
  });

  it("过滤纯标点噪声行,保留含字母/数字的技能", () => {
    expect(parseSkillsText("Java\n——\n!!!\n···\nC++")).toEqual(["Java", "C++"]);
    expect(parseSkillsText("C#\n·\nGo 1.21\n中文写作")).toEqual(["C#", "Go 1.21", "中文写作"]);
  });

  it("精确重复只留首次出现并保持顺序(大小写敏感)", () => {
    expect(parseSkillsText("React\nReact\nPython\nReact\nPython")).toEqual(["React", "Python"]);
    // 大小写不同不合并(语义合并风险,不做)
    expect(parseSkillsText("React\nreact")).toEqual(["React", "react"]);
  });

  it("30 条唯一 + 1 条重复 → 去重后 30 条;31 条唯一不截断", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `skill${i}`);
    const text = [...lines, "skill0"].join("\n");
    expect(parseSkillsText(text)).toHaveLength(30);
    // 合法但超限:不静默截断,由 skillsErrorText 提示用户处理
    const thirtyOne = Array.from({ length: 31 }, (_, i) => `skill${i}`).join("\n");
    expect(parseSkillsText(thirtyOne)).toHaveLength(31);
  });

  it("边界:0 / 1 / 30 条", () => {
    expect(parseSkillsText("")).toEqual([]);
    expect(parseSkillsText("Java")).toEqual(["Java"]);
    const thirty = Array.from({ length: 30 }, (_, i) => `s${i}`).join("\n");
    expect(parseSkillsText(thirty)).toHaveLength(30);
  });

  it("500 条不同短技能不崩、不截断", () => {
    const text = Array.from({ length: 500 }, (_, i) => `s${i}`).join("\n");
    expect(parseSkillsText(text)).toHaveLength(500);
  });
});

describe("skillsErrorText", () => {
  it("30 条以内合法 → null", () => {
    expect(skillsErrorText([], "保存")).toBeNull();
    expect(skillsErrorText(["Java"], "保存")).toBeNull();
    expect(skillsErrorText(Array.from({ length: 30 }, (_, i) => `s${i}`), "保存")).toBeNull();
  });

  it("31 条 → 说明当前数量与需删减数量", () => {
    const skills = Array.from({ length: 31 }, (_, i) => `s${i}`);
    expect(skillsErrorText(skills, "保存")).toBe(
      "技能最多 30 项,当前 31 项,请删除或合并 1 项后再保存。"
    );
  });

  it("36 条 → 需删减 6 项", () => {
    const skills = Array.from({ length: 36 }, (_, i) => `s${i}`);
    expect(skillsErrorText(skills, "保存")).toBe(
      "技能最多 30 项,当前 36 项,请删除或合并 6 项后再保存。"
    );
  });

  it("action 参数对应「开始优化」文案", () => {
    const skills = Array.from({ length: 31 }, (_, i) => `s${i}`);
    expect(skillsErrorText(skills, "开始优化")).toBe(
      "技能最多 30 项,当前 31 项,请删除或合并 1 项后再开始优化。"
    );
  });

  it("单条恰好 50 字合法,51 字拦截", () => {
    const fifty = "a".repeat(50);
    expect(skillsErrorText([fifty], "保存")).toBeNull();
    const fiftyOne = "a".repeat(51);
    expect(skillsErrorText([fiftyOne], "保存")).toBe(
      "单个技能最多 50 字,请精简超长技能后再保存。"
    );
  });

  it("数量超限优先于单条超长", () => {
    const skills = [...Array.from({ length: 30 }, (_, i) => `s${i}`), "b".repeat(51)];
    expect(skillsErrorText(skills, "保存")).toBe(
      "技能最多 30 项,当前 31 项,请删除或合并 1 项后再保存。"
    );
  });
});
