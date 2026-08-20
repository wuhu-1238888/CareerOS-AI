// 画像采集预设清单(2.2):PRD 要求「技能预设列表 + 自由输入」但未给定清单,以下为实现侧建议值,可迭代
export const SKILL_PRESETS = [
  "Python",
  "Java",
  "JavaScript",
  "TypeScript",
  "C++",
  "SQL",
  "数据分析",
  "机器学习",
  "深度学习",
  "产品设计",
  "用户研究",
  "原型设计",
  "内容运营",
  "新媒体运营",
  "活动策划",
  "文案写作",
  "项目管理",
  "沟通协作",
  "市场调研",
  "Excel",
  "PPT 汇报",
  "英语",
  "Git",
  "Linux",
  "HTML/CSS",
  "React",
  "Node.js",
  "Docker",
  "销售技巧",
  "视频剪辑",
] as const;

// 兴趣方向预设(步骤 4 选填,多选)
export const INTEREST_PRESETS = [
  "产品经理",
  "后端开发",
  "前端开发",
  "数据分析",
  "人工智能",
  "软件测试",
  "运营",
  "市场营销",
  "人力资源",
  "设计",
] as const;

// 学历选项(步骤 1 必填)
export const DEGREE_OPTIONS = ["大专", "本科", "硕士", "博士", "其他"] as const;

// 毕业年份选项(选填)
export const GRADUATION_YEARS = Array.from({ length: 36 }, (_, i) => 2035 - i);
