// ATS 规则评分(4.6,纯 TS 确定性计算,不依赖 LLM):6 子分 × 固定权重 → 规则分;
// 最终总分 = round(0.6×规则分 + 0.4×LLM 分(1-5 分档量化到百分制)),等级 ≥80 优秀 / 60-79 良好 / <60 需改进。
// 同输入恒等(无随机/无模型),是「两次评分分差 ≤10」验收的规则侧保证(LLM 侧温度 0 + 5 分档)。
import type { AtsLlmSubscores, AtsReport, AtsRuleSubscores } from "@/lib/resume/analysis-schemas";

// ---- 分节完整性:五节(基本信息/教育/技能/工作实习/项目)各 20 分 ----
const SECTION_PATTERNS: RegExp[] = [
  /(电话|手机|邮箱|email|求职意向)/i,
  /(教育|学历|大学|学院|学校|毕业|专业)/,
  /(技能|熟练|精通|掌握|证书)/,
  /(工作经历|实习经历|任职|公司|工作内容)/,
  /(项目经历|Project)/i,
];

function scoreSections(text: string): number {
  return SECTION_PATTERNS.filter((pattern) => pattern.test(text)).length * 20;
}

// ---- 量化密度:含数字+单位的行占比;30% 以上满分(线性) ----
const UNIT_PATTERN = /[%％万千百万元人个倍套天月年+]|[¥￥]/;

function scoreQuantified(lines: string[]): number {
  const contentLines = lines.filter((line) => line.trim().length > 0);
  if (contentLines.length === 0) return 0;
  const quantified = contentLines.filter(
    (line) => /\d/.test(line) && UNIT_PATTERN.test(line)
  ).length;
  return Math.min(100, Math.round((quantified / contentLines.length / 0.3) * 100));
}

// ---- 关键词覆盖:方向词典命中数/5 满分(未命中方向用通用词典) ----
const DIRECTION_KEYWORDS: Record<string, string[]> = {
  后端开发: ["Java", "Python", "Go", "Spring", "MySQL", "Redis", "微服务", "分布式", "Linux", "数据库", "API", "缓存", "消息队列", "高并发", "Docker"],
  前端开发: ["JavaScript", "TypeScript", "React", "Vue", "CSS", "HTML", "Webpack", "Vite", "小程序", "Node.js", "组件化", "性能优化", "浏览器", "前端工程化", "响应式"],
  数据分析: ["Python", "SQL", "Pandas", "数据分析", "可视化", "Tableau", "Excel", "统计学", "机器学习", "数据挖掘", "报表", "指标", "A/B", "建模", "数据仓库"],
  人工智能: ["Python", "机器学习", "深度学习", "PyTorch", "TensorFlow", "NLP", "计算机视觉", "模型", "算法", "训练", "推理", "神经网络", "特征工程", "数据", "部署"],
  产品经理: ["需求", "用户", "产品", "PRD", "原型", "竞品", "数据分析", "迭代", "增长", "转化", "体验", "规划", "优先级", "协作", "调研"],
  测试: ["测试", "自动化", "接口", "用例", "回归", "性能测试", "Bug", "缺陷", "Selenium", "Appium", "质量", "覆盖率", "CI", "Jenkins", "验收"],
  运维: ["Linux", "Docker", "Kubernetes", "CI/CD", "监控", "Nginx", "Shell", "Python", "自动化运维", "云平台", "负载均衡", "高可用", "日志", "报警", "部署"],
  设计: ["UI", "UX", "Figma", "Sketch", "视觉", "交互", "设计", "原型", "组件库", "品牌", "插画", "用户研究", "设计规范", "动效", "排版"],
};

const GENERIC_KEYWORDS = [
  "负责", "团队", "沟通", "协作", "优化", "提升", "项目", "分析", "设计", "开发",
  "管理", "文档", "培训", "规划", "落地", "推动", "交付", "质量", "效率", "增长",
  "用户", "数据", "方案",
];

// 目标方向(如「后端开发工程师」)与词典键(如「后端开发」)做包含匹配,未命中回退通用词典
function resolveDictionary(direction: string): string[] {
  const key = Object.keys(DIRECTION_KEYWORDS).find(
    (k) => direction.includes(k) || k.includes(direction)
  );
  return key ? DIRECTION_KEYWORDS[key]! : GENERIC_KEYWORDS;
}

function scoreKeywords(text: string, direction: string): number {
  const dictionary = resolveDictionary(direction);
  const normalized = text.toLowerCase();
  const matched = dictionary.filter((keyword) =>
    normalized.includes(keyword.toLowerCase())
  ).length;
  return Math.min(100, Math.round((matched / 5) * 100));
}

// ---- 动词开头:以动作动词开头的行占比 ----
const ACTION_VERBS = [
  "负责", "主导", "设计", "开发", "实现", "搭建", "构建", "优化", "提升", "推动",
  "完成", "制定", "管理", "带领", "参与", "撰写", "调研", "分析", "重构", "交付",
  "落地", "解决", "建立", "维护", "改进", "策划", "执行", "协调", "培训",
];

function scoreActionVerbs(lines: string[]): number {
  const bullets = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.replace(/^[•·\-*\s\d.、]+/, ""));
  if (bullets.length === 0) return 0;
  const verbLed = bullets.filter((bullet) =>
    ACTION_VERBS.some((verb) => bullet.startsWith(verb))
  ).length;
  return Math.round((verbLed / bullets.length) * 100);
}

// ---- 长度篇幅:全文字符 500-1200 满分带,带外线性衰减 ----
function scoreLength(text: string): number {
  const length = text.trim().length;
  if (length >= 500 && length <= 1200) return 100;
  if (length < 500) return Math.max(0, Math.round((length / 500) * 100));
  return Math.max(0, Math.round(100 - (length - 1200) / 30));
}

// ---- 格式可解析性:特殊符号/连续空行/Tab 扣分(100 起扣,下限 0) ----
// 允许字符:CJK、字母数字、空白与常见标点;其余(emoji/控制符/私有区符号)按可疑字符扣分
const PARSEABLE_CHARS = /[一-龥a-zA-Z0-9\s.,;:!?()[\]{}<>%#@&="'·、。,:;!?()《》【】￥¥_+\-*/–—-]/g;

function scoreParseability(text: string): number {
  let score = 100;
  const remainder = text.replace(PARSEABLE_CHARS, "");
  // 增补平面字符(emoji 等)为代理对,2 个 UTF-16 单元计 1 个可疑字符
  const surrogatePairs = remainder.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) ?? [];
  const suspicious = remainder.length - surrogatePairs.length;
  score -= suspicious * 5;
  const blankRuns = text.match(/\n\s*\n\s*\n/g) ?? [];
  score -= blankRuns.length * 10;
  const tabs = text.match(/\t/g) ?? [];
  score -= tabs.length * 5;
  return Math.max(0, score);
}

// 固定权重(计划的 6 子分)
const RULE_WEIGHTS: Record<keyof AtsRuleSubscores, number> = {
  sections: 0.2,
  quantified: 0.2,
  keywords: 0.2,
  actionVerbs: 0.15,
  length: 0.1,
  parseability: 0.15,
};

/** 6 子分确定性计算(纯文本 + 方向词典) */
export function scoreRuleSubscores(text: string, direction: string): AtsRuleSubscores {
  const lines = text.split("\n");
  return {
    sections: scoreSections(text),
    quantified: scoreQuantified(lines),
    keywords: scoreKeywords(text, direction),
    actionVerbs: scoreActionVerbs(lines),
    length: scoreLength(text),
    parseability: scoreParseability(text),
  };
}

/** 规则分 = 6 子分加权平均(固定权重) */
export function computeRuleScore(subscores: AtsRuleSubscores): number {
  return Math.round(
    (Object.keys(RULE_WEIGHTS) as (keyof AtsRuleSubscores)[]).reduce(
      (sum, key) => sum + subscores[key] * RULE_WEIGHTS[key],
      0
    )
  );
}

/** 合成总分与等级:LLM 两子分(1-5)平均后量化到百分制,与规则分 4:6 加权 */
export function synthesizeAtsScore(
  ruleSubscores: AtsRuleSubscores,
  llmSubscores: AtsLlmSubscores
): { ruleScore: number; total: number; level: AtsReport["level"] } {
  const ruleScore = computeRuleScore(ruleSubscores);
  const llmScore = ((llmSubscores.contentQuality + llmSubscores.relevance) / 2) * 20;
  const total = Math.round(0.6 * ruleScore + 0.4 * llmScore);
  const level: AtsReport["level"] = total >= 80 ? "优秀" : total >= 60 ? "良好" : "需改进";
  return { ruleScore, total, level };
}
