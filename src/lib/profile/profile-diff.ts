// 画像能力变化追踪纯函数(6.5):最新 vs 上次的六维雷达逐维对比与能力标签变化清单。
// 能力标签等级序:基础 < 熟练 < 精通。标签移除(上次有、当前无)不在追踪范围
// (implementation-plan 6.5 定义 提升/下降/新增 三类变化)。
import type { ProfileRadar } from "@/lib/profile/analysis-schemas";

export type RadarDimDiff = {
  dimension: keyof ProfileRadar;
  current: number;
  previous: number;
  /** 差值 = 当前 - 上次(正数提升,负数下降) */
  delta: number;
};

export type AbilityLevel = "基础" | "熟练" | "精通";

export type AbilityTagChange = {
  name: string;
  kind: "提升" | "下降" | "新增";
  /** 变化前等级(新增时为 null) */
  from: AbilityLevel | null;
  to: AbilityLevel;
};

const LEVEL_ORDER: Record<AbilityLevel, number> = { 基础: 0, 熟练: 1, 精通: 2 };

// 六维雷达逐维对比:按 Schema 维度顺序返回(与结果页雷达同源数据)
export function diffRadar(current: ProfileRadar, previous: ProfileRadar): RadarDimDiff[] {
  return (Object.keys(current) as (keyof ProfileRadar)[]).map((dimension) => ({
    dimension,
    current: current[dimension],
    previous: previous[dimension],
    delta: current[dimension] - previous[dimension],
  }));
}

// 能力标签变化:按当前标签逐条对照上次(同名对比等级);新增 = 上次不存在;等级升降 → 提升/下降
export function diffAbilityTags(
  current: { name: string; level: AbilityLevel }[],
  previous: { name: string; level: AbilityLevel }[]
): AbilityTagChange[] {
  const previousByName = new Map(previous.map((tag) => [tag.name, tag.level]));
  const changes: AbilityTagChange[] = [];
  for (const tag of current) {
    const prevLevel = previousByName.get(tag.name);
    if (prevLevel === undefined) {
      changes.push({ name: tag.name, kind: "新增", from: null, to: tag.level });
    } else if (LEVEL_ORDER[tag.level] > LEVEL_ORDER[prevLevel]) {
      changes.push({ name: tag.name, kind: "提升", from: prevLevel, to: tag.level });
    } else if (LEVEL_ORDER[tag.level] < LEVEL_ORDER[prevLevel]) {
      changes.push({ name: tag.name, kind: "下降", from: prevLevel, to: tag.level });
    }
  }
  return changes;
}
