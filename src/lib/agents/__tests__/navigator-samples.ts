// 固定样例集(3.3):3 份手工标注的全量路线图输入 + 2 份单阶段重生成输入,均配手工构造的 Mock 输出。
// 用于验证:输出通过 Schema、阶段数/时长与标注一致、周时变化引起时长变化、产出物完备、
// 单阶段模式只返回该阶段且回应反馈。真实 LLM 质量验证待 DeepSeek Key(progress.md 遗留 #1)。
import type {
  NavigatorAgentInput,
  NavigatorStageAgentInput,
  RoadmapAnalysis,
  RoadmapStage,
} from "../navigator.agent";

export type NavigatorSample = {
  id: string;
  description: string;
  input: NavigatorAgentInput;
  /** 标注:期望阶段数(3-4) */
  expectedStageCount: number;
  /** 标注:期望总时长(与 weeklyHours 关联,投入少 → 时长长) */
  expectedTotalDuration: string;
  /** 手工构造的 Mock 输出(需通过 outputSchema,且阶段数/时长与标注一致) */
  mockOutput: RoadmapAnalysis;
};

export const navigatorSamples: NavigatorSample[] = [
  {
    id: "backend-slow",
    description: "后端开发 · 每周 5 小时(投入少)→ 总时长 6 个月、4 阶段",
    input: {
      direction: "后端开发",
      abilityTags: [
        { name: "Python", level: "熟练" },
        { name: "SQL", level: "熟练" },
        { name: "JavaScript", level: "基础" },
      ],
      weeklyHours: 5,
      currentStage: "有一定基础",
    },
    expectedStageCount: 4,
    expectedTotalDuration: "6 个月",
    mockOutput: {
      summary: {
        totalDuration: "6 个月",
        stageCount: 4,
        finalGoal: "具备独立设计与开发中小型后端服务的能力,达到初级后端开发工程师水平",
      },
      stages: [
        {
          name: "夯实后端语言基础",
          goal: "系统掌握 Python 语言核心与网络基础",
          learningContent: ["Python 进阶语法与标准库", "HTTP 协议与 REST 设计", "数据库原理与 SQL 进阶"],
          practiceProjects: [
            { title: "图书管理 API", deliverable: "可运行的 REST API 服务与接口文档" },
          ],
          resources: ["Python 官方文档", "《计算机网络:自顶向下方法》公开课"],
          checkpoints: ["能解释 HTTP 请求完整生命周期", "能独立设计并实现一个 3 资源 REST API"],
          estimatedDuration: "2 个月",
        },
        {
          name: "Web 框架与数据库实战",
          goal: "掌握主流 Web 框架与 ORM,完成完整 CRUD 应用",
          learningContent: ["Flask/FastAPI 框架", "SQLAlchemy ORM", "接口鉴权与中间件"],
          practiceProjects: [
            { title: "任务管理后端", deliverable: "含鉴权与数据持久化的完整后端项目" },
            { title: "接口压测实验", deliverable: "压测报告与性能优化记录" },
          ],
          resources: ["FastAPI 官方教程", "SQLAlchemy 文档"],
          checkpoints: ["实现带 JWT 鉴权的完整 CRUD 服务", "压测报告显示常见接口 P99 < 200ms"],
          estimatedDuration: "2 个月",
        },
        {
          name: "工程化与部署",
          goal: "掌握测试、容器化与部署流程",
          learningContent: ["pytest 单元与集成测试", "Docker 容器化", "CI/CD 与云部署"],
          practiceProjects: [
            { title: "为既有项目补齐工程化", deliverable: "含测试覆盖、Dockerfile 与 CI 管线的仓库" },
          ],
          resources: ["pytest 官方文档", "Docker 入门实战"],
          checkpoints: ["核心模块测试覆盖率 ≥ 70%", "服务可通过 Docker 一键部署并公网访问"],
          estimatedDuration: "1 个月",
        },
        {
          name: "高并发入门与求职准备",
          goal: "理解高并发基础,准备求职作品",
          learningContent: ["消息队列基础", "Redis 缓存", "简历与面试准备"],
          practiceProjects: [
            { title: "秒杀系统简化版", deliverable: "含缓存与消息队列的高并发 demo 与设计文档" },
          ],
          resources: ["Redis 官方文档", "后端面试题精选"],
          checkpoints: ["能解释缓存穿透/雪崩的应对方案", "完成作品集整理与 2 次模拟面试"],
          estimatedDuration: "1 个月",
        },
      ],
    },
  },
  {
    id: "data-fast",
    description: "数据分析 · 每周 30 小时(投入多)→ 总时长 2 个月、3 阶段",
    input: {
      direction: "数据分析",
      abilityTags: [
        { name: "Excel", level: "基础" },
        { name: "SQL", level: "基础" },
      ],
      weeklyHours: 30,
      currentStage: "完全新手",
    },
    expectedStageCount: 3,
    expectedTotalDuration: "2 个月",
    mockOutput: {
      summary: {
        totalDuration: "2 个月",
        stageCount: 3,
        finalGoal: "具备独立完成数据分析项目的能力,达到初级数据分析师水平",
      },
      stages: [
        {
          name: "数据分析工具入门",
          goal: "熟练使用 SQL 与 Python 完成数据提取与清洗",
          learningContent: ["SQL 聚合与多表连接", "Python pandas 基础", "数据清洗常用套路"],
          practiceProjects: [
            { title: "销售数据清洗", deliverable: "清洗后的数据集与数据质量报告" },
          ],
          resources: ["SQL 官方教程", "pandas 官方文档"],
          checkpoints: ["能独立写出 3 表连接聚合查询", "能处理缺失值与异常值"],
          estimatedDuration: "3 周",
        },
        {
          name: "统计基础与可视化",
          goal: "掌握描述统计、常用图表与业务洞察呈现",
          learningContent: ["描述统计与分布", "matplotlib/绘图基础", "指标解读与业务分析框架"],
          practiceProjects: [
            { title: "用户行为分析看板", deliverable: "可视化分析报告(含 3 个业务结论)" },
          ],
          resources: ["可汗学院统计学", "matplotlib 官方文档"],
          checkpoints: ["能判断常见分布与离群点", "产出一份有结论的可视化报告"],
          estimatedDuration: "3 周",
        },
        {
          name: "完整分析项目实战",
          goal: "端到端完成一个真实数据集的分析项目",
          learningContent: ["项目选题与假设", "分析报告结构", "作品集与简历呈现"],
          practiceProjects: [
            { title: "电商转化漏斗分析", deliverable: "端到端分析报告(结论 + 建议 + 图表)" },
            { title: "面试模拟案例", deliverable: "2 道面试案例的完整解题过程" },
          ],
          resources: ["Kaggle 公开数据集", "数据分析面试案例集"],
          checkpoints: ["报告包含明确的业务结论与行动建议", "完成模拟面试并获反馈"],
          estimatedDuration: "2 周",
        },
      ],
    },
  },
  {
    id: "ops-mid",
    description: "新媒体运营 · 每周 10 小时 → 总时长 4 个月、4 阶段",
    input: {
      direction: "新媒体运营",
      abilityTags: [
        { name: "内容运营", level: "熟练" },
        { name: "文案写作", level: "熟练" },
      ],
      weeklyHours: 10,
      currentStage: "接近入门",
    },
    expectedStageCount: 4,
    expectedTotalDuration: "4 个月",
    mockOutput: {
      summary: {
        totalDuration: "4 个月",
        stageCount: 4,
        finalGoal: "具备独立运营一个新媒体账号并产出可量化增长数据的能力",
      },
      stages: [
        {
          name: "平台机制与账号定位",
          goal: "理解主流平台分发机制,完成账号定位与内容规划",
          learningContent: ["平台推荐机制与算法常识", "账号定位与竞品分析", "内容规划与选题库搭建"],
          practiceProjects: [
            { title: "竞品账号拆解", deliverable: "3 个对标账号的拆解报告与选题库" },
          ],
          resources: ["平台官方创作学院", "运营案例合集"],
          checkpoints: ["产出 1 份账号定位文档", "选题库 ≥ 30 条"],
          estimatedDuration: "1 个月",
        },
        {
          name: "内容生产与发布节奏",
          goal: "建立稳定的内容生产流程,掌握基础数据复盘",
          learningContent: ["图文内容创作流程", "封面与标题技巧", "基础数据指标与复盘方法"],
          practiceProjects: [
            { title: "连续发布实验", deliverable: "8 篇内容的发布记录与数据复盘表" },
          ],
          resources: ["内容创作工具合集", "数据复盘模板"],
          checkpoints: ["按节奏发布 8 篇内容", "每篇发布后完成数据复盘"],
          estimatedDuration: "1 个月",
        },
        {
          name: "增长与互动运营",
          goal: "掌握涨粉、互动与活动运营手段",
          learningContent: ["裂变与活动策划", "粉丝互动与私域承接", "A/B 测试基础"],
          practiceProjects: [
            { title: "小活动策划执行", deliverable: "活动方案 + 执行数据 + 复盘报告" },
          ],
          resources: ["增长案例库", "私域运营入门"],
          checkpoints: ["策划并执行 1 场小活动", "产出活动数据复盘报告"],
          estimatedDuration: "1 个月",
        },
        {
          name: "商业化认知与求职准备",
          goal: "理解内容变现路径,准备运营作品集",
          learningContent: ["内容变现模式概览", "运营数据汇报表达", "面试准备与作品集整理"],
          practiceProjects: [
            { title: "账号运营总结", deliverable: "含数据成果与复盘的作品集页面" },
            { title: "模拟面试", deliverable: "2 次模拟面试的复盘记录" },
          ],
          resources: ["运营职业访谈", "作品集案例"],
          checkpoints: ["作品集包含可量化成果", "完成模拟面试"],
          estimatedDuration: "1 个月",
        },
      ],
    },
  },
];

export type NavigatorStageSample = {
  id: string;
  description: string;
  input: NavigatorStageAgentInput;
  /** 标注:反馈对应的调整方向(太难了 → 拆细;已经会了 → 加难) */
  expectedAdjustment: "easier" | "harder";
  /** 手工构造的 Mock 输出(需通过 roadmapStageSchema,且与调整方向一致) */
  mockOutput: RoadmapStage;
};

export const navigatorStageSamples: NavigatorStageSample[] = [
  {
    id: "stage-too-hard",
    description: "「太难了」:算法阶段拆细为更基础的内容,时长拉长",
    input: {
      direction: "后端开发",
      abilityTags: [{ name: "Python", level: "基础" }],
      weeklyHours: 10,
      currentStage: "完全新手",
      stageName: "算法与数据结构",
      stageContent: {
        learningContent: ["红黑树实现", "动态规划进阶", "图论最短路径"],
        practiceProjects: [{ title: "实现跳跃表", deliverable: "可运行的跳跃表库" }],
        estimatedDuration: "2 周",
      },
      feedback: "太难了",
    },
    expectedAdjustment: "easier",
    mockOutput: {
      name: "算法与数据结构入门",
      goal: "掌握最常用的基础数据结构与算法思想",
      learningContent: ["数组与链表", "栈与队列", "哈希表", "二叉搜索树", "基础排序算法"],
      practiceProjects: [
        { title: "实现简单哈希表", deliverable: "含单元测试的哈希表实现" },
        { title: "排序可视化", deliverable: "展示 3 种排序过程的小工具" },
      ],
      resources: ["可视化算法学习网站", "《算法图解》"],
      checkpoints: ["能手写链表与哈希表", "能口述快排与归并的复杂度"],
      estimatedDuration: "4 周",
    },
  },
  {
    id: "stage-known",
    description: "「已经会了」:Python 基础替换为进阶内容,项目升级",
    input: {
      direction: "后端开发",
      abilityTags: [
        { name: "Python", level: "熟练" },
        { name: "SQL", level: "基础" },
      ],
      weeklyHours: 15,
      currentStage: "有一定基础",
      stageName: "Python 基础",
      stageContent: {
        learningContent: ["语法基础", "列表与字典", "函数定义"],
        practiceProjects: [{ title: "命令行待办", deliverable: "CLI 待办工具" }],
        estimatedDuration: "3 周",
      },
      feedback: "已经会了",
    },
    expectedAdjustment: "harder",
    mockOutput: {
      name: "Python 进阶与工程结构",
      goal: "掌握 Python 进阶特性与规范化工程组织",
      learningContent: ["装饰器与上下文管理器", "生成器与协程基础", "类型注解与工程结构"],
      practiceProjects: [
        { title: "异步爬虫框架", deliverable: "支持并发限流的可复用爬虫库" },
      ],
      resources: ["Fluent Python(免费章节)", "Python 官方语言参考"],
      checkpoints: ["能自定义装饰器与上下文管理器", "能组织一个可 pip 安装的包结构"],
      estimatedDuration: "2 周",
    },
  },
];
