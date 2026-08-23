// 固定样例集(6.3):3 份手工标注的技能教练输入 + 手工构造的 Mock 输出。
// 用于验证:输出通过 Schema、13 周连续、时间预算不超、P0 优先级与标注一致。
// 真实 LLM 质量验证待 DeepSeek Key(progress.md 遗留 #1),本样例集保证管线正确性。
import type { CoachAgentInput, CoachPlan } from "../coach.agent";

export type CoachSample = {
  id: string;
  description: string;
  input: CoachAgentInput;
  /** 标注:期望 P0 技能(至少一个) */
  expectedP0Skills: string[];
  mockOutput: CoachPlan;
};

// 13 周计划构造器:每周 2 个任务、各 120 分钟(每周 240 分钟,远低于 10h 预算上限 600);
// 周次连续 1..13,内容为固定形态的夹具文本(质量验证靠真实 LLM 阶段)。
function buildWeeks(themes: string[]): CoachPlan["weeks"] {
  return themes.map((theme, i) => ({
    week: i + 1,
    theme,
    tasks: [
      {
        title: `${theme}:学习与练习`,
        estimatedMinutes: 120,
        deliverable: "学习笔记与练习记录",
        completionCriteria: "能用自己的话解释本周核心概念,并完成配套练习",
      },
      {
        title: `${theme}:实践输出`,
        estimatedMinutes: 120,
        deliverable: "可展示的练习产物",
        completionCriteria: "产物可运行或可复述,并能说明与目标岗位的关联",
      },
    ],
  }));
}

const backendThemes = [
  "缓存基础与 Redis 入门",
  "Redis 数据结构与场景",
  "缓存接入项目实战",
  "高并发核心概念",
  "消息队列入门",
  "分布式基础理论",
  "综合项目:缓存 + 队列",
  "性能优化实战",
  "高频算法强化",
  "项目复盘与简历化",
  "沟通表达训练",
  "模拟面试",
  "冲刺与查漏补缺",
];

const opsThemes = [
  "新媒体平台基础",
  "内容选题与策划",
  "公众号排版与视觉",
  "数据分析入门",
  "短视频脚本基础",
  "剪辑工具实战",
  "社群运营方法",
  "商业文案写作",
  "用户增长基础",
  "数据复盘与优化",
  "作品集整理",
  "模拟面试",
  "冲刺与查漏补缺",
];

export const coachSamples: CoachSample[] = [
  {
    id: "backend-gaps",
    description: "后端岗位差距清单(2 条大差距)+ 10h/周:完整 13 周计划",
    input: {
      targetPosition: "后端开发工程师",
      requirements: [
        { name: "Redis 与缓存", importance: 5, gap: "大" },
        { name: "高并发与分布式", importance: 5, gap: "大" },
        { name: "数据结构与算法", importance: 4, gap: "中" },
        { name: "沟通表达", importance: 3, gap: "小" },
      ],
      abilityBaseline: {
        abilityTags: [
          { name: "Python", level: "熟练" },
          { name: "SQL", level: "熟练" },
          { name: "JavaScript", level: "基础" },
        ],
      },
      weeklyHours: 10,
      learningPreference: "偏好视频课程与动手项目",
    },
    expectedP0Skills: ["Redis 与缓存", "高并发与分布式"],
    mockOutput: {
      weeklyHours: 10,
      priorityMatrix: [
        { skill: "Redis 与缓存", importance: 5, gapSize: "大", priority: "P0", reason: "核心存储要求且差距最大" },
        { skill: "高并发与分布式", importance: 5, gapSize: "大", priority: "P0", reason: "后端进阶核心能力且差距大" },
        { skill: "数据结构与算法", importance: 4, gapSize: "中", priority: "P1", reason: "面试高频考点,差距中等" },
        { skill: "沟通表达", importance: 3, gapSize: "小", priority: "P2", reason: "软技能要求,差距较小可低频投入" },
      ],
      weeks: buildWeeks(backendThemes),
      milestones: [
        { week: 4, title: "完成第一个带缓存的 CRUD 项目" },
        { week: 8, title: "完成缓存 + 队列综合项目" },
        { week: 13, title: "完成一次模拟面试并输出复盘" },
      ],
      resources: [
        { title: "Redis 官方文档", type: "文档", cost: "free", url: "https://redis.io/docs/", note: "官方教程与命令参考" },
        { title: "《Redis 设计与实现》", type: "书籍", cost: "paid", url: "", note: "二手书平台或图书馆可获取" },
        { title: "RabbitMQ 官方教程", type: "文档", cost: "free", url: "https://www.rabbitmq.com/tutorials" },
      ],
      risks: [
        { risk: "周期较长难以坚持", mitigation: "每周固定学习时间,并加入学习社群打卡" },
        { risk: "分布式理论抽象难懂", mitigation: "先实践后理论,用项目问题倒逼理解" },
      ],
    },
  },
  {
    id: "ops-turn",
    description: "转运营岗位差距清单(4 小时/周):低预算下的计划(预算 240 分钟/周,每周 1 任务 120 分钟)",
    input: {
      targetPosition: "新媒体运营",
      requirements: [
        { name: "内容策划", importance: 5, gap: "大" },
        { name: "数据分析", importance: 4, gap: "中" },
      ],
      abilityBaseline: {
        abilityTags: [
          { name: "文案写作", level: "熟练" },
          { name: "PPT 汇报", level: "熟练" },
        ],
      },
      weeklyHours: 4,
      learningPreference: "",
    },
    expectedP0Skills: ["内容策划"],
    mockOutput: {
      weeklyHours: 4,
      priorityMatrix: [
        { skill: "内容策划", importance: 5, gapSize: "大", priority: "P0", reason: "岗位核心能力且差距大" },
        { skill: "数据分析", importance: 4, gapSize: "中", priority: "P1", reason: "重要但差距中等" },
      ],
      weeks: opsThemes.map((theme, i) => ({
        week: i + 1,
        theme,
        tasks: [
          {
            title: `${theme}:练习`,
            estimatedMinutes: 120,
            deliverable: "练习作品",
            completionCriteria: "完成本周主题对应的练习并输出作品",
          },
        ],
      })),
      milestones: [
        { week: 6, title: "发布第一篇独立策划内容" },
        { week: 13, title: "整理作品集并复盘数据" },
      ],
      resources: [
        { title: "运营技能公开课", type: "课程", cost: "free", url: "", note: "平台公开课频道可检索" },
        { title: "《从零开始做运营》", type: "书籍", cost: "paid", url: "" },
      ],
      risks: [
        { risk: "每周投入时间少,进度缓慢", mitigation: "聚焦 P0 单项,砍掉低优先级任务" },
      ],
    },
  },
  {
    id: "minimal-gap",
    description: "最小差距清单(1 条,边界用例):正常产出 13 周计划",
    input: {
      targetPosition: "数据分析师",
      requirements: [{ name: "SQL 进阶", importance: 5, gap: "大" }],
      abilityBaseline: {
        abilityTags: [{ name: "SQL", level: "基础" }],
      },
      weeklyHours: 6,
      learningPreference: undefined,
    },
    expectedP0Skills: ["SQL 进阶"],
    mockOutput: {
      weeklyHours: 6,
      priorityMatrix: [
        { skill: "SQL 进阶", importance: 5, gapSize: "大", priority: "P0", reason: "唯一差距且重要性最高" },
      ],
      weeks: buildWeeks(
        Array.from({ length: 13 }, (_, i) => (i < 8 ? `SQL 进阶专题 ${i + 1}` : `综合实战 ${i - 7}`))
      ),
      milestones: [{ week: 8, title: "完成一个完整的数据分析实战项目" }],
      resources: [
        { title: "SQL 官方文档", type: "文档", cost: "free", url: "" },
        { title: "《SQL 必知必会》", type: "书籍", cost: "paid", url: "" },
      ],
      risks: [],
    },
  },
];
