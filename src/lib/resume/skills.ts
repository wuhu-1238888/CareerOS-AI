// 技能文本解析与校验(纯函数,客户端安全):核对表单 Textarea ↔ 技能数组的转换 + 前端预校验。
// 限制与 parsedResumeSchema.skills 同源(MAX_SKILLS / MAX_SKILL_LENGTH),避免前后端数字漂移。
import { MAX_SKILLS, MAX_SKILL_LENGTH } from "@/lib/resume/analysis-schemas";

// 上限常量透出,供核对表单计数展示复用,与 schema 保持单一事实源
export { MAX_SKILLS, MAX_SKILL_LENGTH };

/** 仅由标点/符号组成的噪声行(不含 CJK/ASCII 字母或数字;tsconfig target < es6,不用 \p 转义) */
function isNoise(skill: string): boolean {
  return !/[一-龥a-zA-Z0-9]/.test(skill);
}

/**
 * 技能文本 → 技能数组:换行/逗号/顿号分隔 → trim(含全角空格)→ 去空行与纯标点噪声行
 * → 精确去重(大小写敏感,保留首次出现顺序)。不截断:超限由 skillsErrorText 提示,
 * 合法数据绝不静默丢弃。
 */
export function parseSkillsText(text: string): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const raw of text.split(/[\n,、,]/)) {
    const skill = raw.trim();
    if (skill.length === 0 || isNoise(skill)) continue;
    if (seen.has(skill)) continue;
    seen.add(skill);
    skills.push(skill);
  }
  return skills;
}

/**
 * 技能列表校验(action 为入口动词后缀:"保存" | "开始优化")。
 * 合法返回 null;超限/超长返回用户可读错误文案(发生了什么 + 怎么修)。优先级:数量 > 单条长度。
 */
export function skillsErrorText(
  skills: string[],
  action: "保存" | "开始优化"
): string | null {
  if (skills.length > MAX_SKILLS) {
    return `技能最多 ${MAX_SKILLS} 项,当前 ${skills.length} 项,请删除或合并 ${skills.length - MAX_SKILLS} 项后再${action}。`;
  }
  const overLong = skills.filter((s) => s.length > MAX_SKILL_LENGTH).length;
  if (overLong > 0) {
    return `单个技能最多 ${MAX_SKILL_LENGTH} 字,请精简超长技能后再${action}。`;
  }
  return null;
}
