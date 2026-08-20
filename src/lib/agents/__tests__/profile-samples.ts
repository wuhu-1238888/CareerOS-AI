// 固定样例集(2.3):3 份手工标注的画像输入 + 手工构造的 Mock 输出。
// 用于验证:输出通过 Schema、方向推荐与标注一致、置信度随信息完整度变化。
// 真实 LLM 质量验证待 DeepSeek Key(progress.md 遗留 #1),本样例集保证管线正确性。
import type { ProfileAgentInput, ProfileAnalysis } from "../profile.agent";

export type ProfileSample = {
  id: string;
  description: string;
  input: ProfileAgentInput;
  /** 标注:期望出现在推荐方向中的方向名(至少一个) */
  expectedDirections: string[];
  /** 标注:信息完整度 → 期望置信度等级 */
  expectedConfidence: ProfileAnalysis["confidence"]["level"];
  /** 手工构造的 Mock 输出(需通过 outputSchema,且方向/置信度与标注一致) */
  mockOutput: ProfileAnalysis;
};

export const profileSamples: ProfileSample[] = [
  {
    id: "cs-grad",
    description: "计算机应届生:教育+技能+实习+项目+目标齐全",
    input: {
      education: [
        { degree: "本科", major: "计算机科学与技术", school: "示例大学", graduationYear: 2026 },
      ],
      skills: [
        { name: "Python", level: "熟练" },
        { name: "SQL", level: "熟练" },
        { name: "JavaScript", level: "基础" },
      ],
      experiences: [
        {
          type: "internship",
          organization: "示例科技",
          role: "后端实习生",
          description: "参与内部数据平台接口开发与联调",
        },
        {
          type: "project",
          organization: "校园二手交易平台",
          role: "后端开发",
          description: "独立完成订单模块的设计与开发",
        },
      ],
      interests: ["后端开发", "人工智能"],
      targets: ["后端开发工程师"],
    },
    expectedDirections: ["后端开发"],
    expectedConfidence: "高",
    mockOutput: {
      summary:
        "计算机专业应届生,具备后端开发与数据处理的实践基础,岗位目标与能力积累方向一致,适合以工程岗位切入并逐步走向更细分的技术方向。",
      abilityTags: [
        { name: "Python", level: "熟练" },
        { name: "SQL", level: "熟练" },
        { name: "JavaScript", level: "基础" },
        { name: "后端开发", level: "熟练" },
        { name: "数据分析", level: "熟练" },
      ],
      strengths: [
        { title: "实践经历对口", detail: "两段开发经历均与目标岗位直接相关" },
        { title: "目标清晰", detail: "岗位目标与能力积累方向一致" },
        { title: "技能组合完整", detail: "编程语言与数据库技能配套" },
      ],
      directions: [
        {
          name: "后端开发",
          matchScore: 85,
          reason: "技术栈与实习项目经历均与后端岗位高度匹配",
          strengths: ["Python 熟练", "后端实习经历对口"],
          weaknesses: ["缺少高并发与分布式实战经验"],
        },
        {
          name: "数据分析",
          matchScore: 70,
          reason: "SQL 与数据处理基础可迁移至数据岗位",
          strengths: ["SQL 熟练"],
          weaknesses: ["缺少统计建模经验"],
        },
      ],
      radar: { 产品: 40, 技术: 80, 数据: 68, 沟通: 50, 项目: 66, 行业: 45 },
      suggestions: [
        {
          gap: "缺少高并发与分布式项目经验",
          action: "完成一个包含消息队列与缓存的工程实践项目",
        },
        { gap: "技术深度待提升", action: "系统学习一门后端框架的底层原理与源码" },
      ],
      confidence: { level: "高", note: "教育、技能、实习与目标信息齐全,结论可信度较高" },
    },
  },
  {
    id: "liberal-to-ops",
    description: "文科背景转运营:无实习经历、无明确目标",
    input: {
      education: [{ degree: "本科", major: "新闻传播" }],
      skills: [
        { name: "内容运营", level: "熟练" },
        { name: "文案写作", level: "熟练" },
        { name: "PPT 汇报", level: "熟练" },
      ],
      experiences: [
        {
          type: "project",
          organization: "校园公众号",
          role: "主编",
          description: "运营一年,产出 60+ 篇推文",
        },
      ],
      interests: ["运营"],
      targets: [],
    },
    expectedDirections: ["新媒体运营"],
    expectedConfidence: "中",
    mockOutput: {
      summary:
        "新闻传播背景学生,内容生产与账号运营实践扎实,适合以内容运营岗位切入互联网行业,后续可向用户运营方向拓展。",
      abilityTags: [
        { name: "内容运营", level: "熟练" },
        { name: "文案写作", level: "熟练" },
        { name: "PPT 汇报", level: "熟练" },
      ],
      strengths: [
        { title: "内容生产经验扎实", detail: "校园公众号一年主编经验,产出稳定" },
        { title: "表达与文案能力强", detail: "传播学背景支撑内容策划能力" },
        { title: "转型方向聚焦", detail: "兴趣方向明确聚焦运营" },
      ],
      directions: [
        {
          name: "新媒体运营",
          matchScore: 78,
          reason: "内容运营与文案能力与岗位要求高度匹配",
          strengths: ["文案写作熟练", "公众号运营经验"],
          weaknesses: ["缺少商业账号运营经验"],
        },
        {
          name: "内容策划",
          matchScore: 66,
          reason: "传播学背景与内容生产能力可支撑策划岗位",
          strengths: ["内容运营熟练"],
          weaknesses: ["缺少活动策划经历"],
        },
      ],
      radar: { 产品: 55, 技术: 30, 数据: 42, 沟通: 70, 项目: 60, 行业: 50 },
      suggestions: [
        {
          gap: "缺少商业化运营实践",
          action: "投递互联网内容运营实习,积累商业账号运营经验",
        },
      ],
      confidence: { level: "中", note: "有教育、技能与项目经历,缺少实习与明确目标,部分结论偏保守" },
    },
  },
  {
    id: "minimal",
    description: "仅必填信息(教育+技能),边界用例",
    input: {
      education: [{ degree: "本科", major: "电子商务" }],
      skills: [{ name: "数据分析", level: "基础" }],
      experiences: [],
      interests: [],
      targets: [],
    },
    expectedDirections: ["数据分析"],
    expectedConfidence: "低",
    mockOutput: {
      summary:
        "电子商务专业学生,具备数据分析入门基础,当前信息有限,画像仅供初步参考,建议补充经历与职业目标后获得更准确的建议。",
      abilityTags: [
        { name: "数据分析", level: "基础" },
        { name: "电子商务", level: "基础" },
        { name: "商业知识", level: "基础" },
      ],
      strengths: [
        { title: "专业方向对口", detail: "电子商务背景与数据分析方向存在协同" },
        { title: "已有入门技能", detail: "具备数据分析基础,可继续深入学习" },
        { title: "可塑性强", detail: "处于求职早期,发展方向选择空间大" },
      ],
      directions: [
        {
          name: "数据分析",
          matchScore: 45,
          reason: "已有入门技能,但证据有限,匹配度为保守估计",
          strengths: ["数据分析基础"],
          weaknesses: ["缺少项目或实习验证"],
        },
        {
          name: "电商运营",
          matchScore: 40,
          reason: "专业背景与电商行业存在对口关系",
          strengths: ["电子商务专业背景"],
          weaknesses: ["缺少运营实践证据"],
        },
      ],
      radar: { 产品: 25, 技术: 20, 数据: 40, 沟通: 30, 项目: 15, 行业: 35 },
      suggestions: [
        {
          gap: "信息不足,画像参考价值有限",
          action: "补充实习、项目经历与职业目标后更新画像",
        },
      ],
      confidence: { level: "低", note: "仅有必填信息,结论为保守估计,建议补充信息后更新画像" },
    },
  },
];
