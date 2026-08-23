// @vitest-environment node
// 画像能力变化追踪纯函数测试(6.5):雷达逐维差值、能力标签 提升/下降/新增、不变跳过、移除不在追踪范围。
import { describe, it, expect } from "vitest";
import { diffRadar, diffAbilityTags, type AbilityLevel } from "../profile-diff";
import type { ProfileRadar } from "../analysis-schemas";

type Tag = { name: string; level: AbilityLevel };

function radar(overrides: Partial<ProfileRadar> = {}): ProfileRadar {
  return { 产品: 50, 技术: 60, 数据: 40, 沟通: 70, 项目: 55, 行业: 45, ...overrides };
}

describe("diffRadar(6.5)", () => {
  it("逐维计算差值(delta = 当前 - 上次),返回全部 6 维且顺序与 Schema 一致", () => {
    const current = radar({ 技术: 80, 沟通: 60 });
    const previous = radar({ 技术: 60, 沟通: 70 });
    expect(diffRadar(current, previous)).toEqual([
      { dimension: "产品", current: 50, previous: 50, delta: 0 },
      { dimension: "技术", current: 80, previous: 60, delta: 20 },
      { dimension: "数据", current: 40, previous: 40, delta: 0 },
      { dimension: "沟通", current: 60, previous: 70, delta: -10 },
      { dimension: "项目", current: 55, previous: 55, delta: 0 },
      { dimension: "行业", current: 45, previous: 45, delta: 0 },
    ]);
  });

  it("无变化时全部 delta 为 0", () => {
    const value = radar();
    expect(diffRadar(value, value).every((d) => d.delta === 0)).toBe(true);
  });
});

describe("diffAbilityTags(6.5)", () => {
  it("提升/下降/新增 三类变化与等级差一致", () => {
    const current: Tag[] = [
      { name: "Python", level: "精通" },
      { name: "SQL", level: "基础" },
      { name: "React", level: "熟练" },
      { name: "沟通表达", level: "熟练" },
    ];
    const previous: Tag[] = [
      { name: "Python", level: "熟练" },
      { name: "SQL", level: "熟练" },
      { name: "沟通表达", level: "熟练" },
    ];
    expect(diffAbilityTags(current, previous)).toEqual([
      { name: "Python", kind: "提升", from: "熟练", to: "精通" },
      { name: "SQL", kind: "下降", from: "熟练", to: "基础" },
      { name: "React", kind: "新增", from: null, to: "熟练" },
    ]);
  });

  it("等级不变 → 跳过;上次有而当前无(移除)→ 不在追踪范围", () => {
    const current: Tag[] = [{ name: "Python", level: "熟练" }];
    const previous: Tag[] = [
      { name: "Python", level: "熟练" },
      { name: "摄影", level: "基础" },
    ];
    expect(diffAbilityTags(current, previous)).toEqual([]);
  });

  it("跨级提升(基础 → 精通)按提升计", () => {
    const current: Tag[] = [{ name: "Python", level: "精通" }];
    const previous: Tag[] = [{ name: "Python", level: "基础" }];
    expect(diffAbilityTags(current, previous)).toEqual([
      { name: "Python", kind: "提升", from: "基础", to: "精通" },
    ]);
  });

  it("空清单 → 空变化", () => {
    expect(diffAbilityTags([], [])).toEqual([]);
    expect(diffAbilityTags([{ name: "Python", level: "基础" }], [])).toEqual([
      { name: "Python", kind: "新增", from: null, to: "基础" },
    ]);
  });
});
