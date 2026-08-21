// 固定样例集(4.4):3 份手工标注的改写输入(核对后解析数据 + 能力标签 + 目标方向)+ 手工构造的 Mock 输出。
// 用于验证:输出通过 Schema、originalText 逐字摘抄自原文(空白归一化)、无量化数据片段不虚构数字、
// 输入透传(能力标签与目标方向进入 user 消息)。真实 LLM 质量验证待 DeepSeek Key(progress.md 遗留 #1)。
import type { RewriteAnalysis } from "@/lib/resume/analysis-schemas";
import type { ResumeRewriteAgentInput } from "../resume.agent";
import { SAMPLE_RESUME_TEXT } from "@/lib/resume/__tests__/fixtures/expected";

export type ResumeRewriteSample = {
  id: string;
  description: string;
  input: ResumeRewriteAgentInput;
  /** 简历原文(用于断言 originalText 逐字存在) */
  originalText: string;
  /** 仅存在于原文、不出现在 parsedData 中的特征子串(用于断言原文确实进入 user 消息) */
  originalTextOnlyMarker: string;
  /** 「无量化数据不虚构数字」边界:这些下标处的 optimizedText 不得出现任何数字 */
  noDigitsAt: number[];
  expectedModificationCount: number;
  /** 手工构造的 Mock 输出(需通过 rewriteAnalysisSchema) */
  mockOutput: RewriteAnalysis;
};

const backendAbilityTags = [
  { name: "Java", level: "熟练" as const },
  { name: "Spring Boot", level: "熟练" as const },
  { name: "MySQL", level: "熟练" as const },
];

// 前端应届生样例原文(断言与输入共用)
const frontendGradOriginalText = `李娜
求职意向:前端开发工程师
电话:139-1111-2222
邮箱:lina@example.com

教育经历
2018-09 至 2022-06 武汉大学 软件工程 本科
2022-09 至 2025-06 华中科技大学 计算机技术 硕士

技能
JavaScript、TypeScript、Vue、React、HTML/CSS、Node.js、Webpack

实习经历
2024-06 至 2024-09 深圳某互联网公司 前端开发实习生
参与公司内部中台系统的页面开发,独立完成 12 个业务组件
优化首屏加载,打包体积减少 30%

项目经历
2023-10 至 2024-03 校园二手交易平台(课程项目)
负责前端整体架构与页面实现
2024-11 至 2025-02 低代码表单引擎(个人项目)
基于 JSON Schema 实现表单渲染,支持 8 种控件类型`;

// 产品经理样例原文(断言与输入共用)
const productManagerOriginalText = `王强
求职意向:产品经理
电话:137-3333-4444
邮箱:wangqiang@example.com

教育经历
2015-09 至 2019-06 中山大学 市场营销 本科

技能
Axure、SQL、数据分析、项目管理

工作经历
2019-07 至 2022-03 广州某电商公司 产品专员
负责订单后台的产品迭代,上线 5 个版本
2022-04 至今 深圳某科技公司 产品经理
主导客户管理系统从 0 到 1 建设,服务 200 家客户`;

export const resumeRewriteSamples: ResumeRewriteSample[] = [
  {
    id: "backend-engineer",
    description: "后端开发工程师(3 年经验,含量化表达):4 条建议,求职意向/技能片段无数字不虚构",
    input: {
      parsedData: {
        basicInfo: {
          name: "张伟",
          targetPosition: "后端开发工程师",
          phone: "138-0000-0000",
          email: "zhangwei@example.com",
        },
        education: [
          {
            school: "中国科学技术大学",
            degree: "本科",
            major: "计算机科学与技术",
            timeRange: { start: "2016-09", end: "2020-06" },
          },
        ],
        skills: ["Java", "Spring Boot", "MySQL", "Redis", "Docker", "Git"],
        experiences: [
          {
            type: "工作",
            company: "杭州某科技有限公司",
            role: "后端开发工程师",
            timeRange: { start: "2020-07", end: "2023-06" },
            description:
              "负责电商订单系统的开发与维护,日均处理订单 50 万笔\n优化数据库查询,接口响应时间从 800ms 降低到 200ms\n主导商品服务重构,线上故障率下降 60%",
          },
        ],
        projects: [
          {
            name: "分布式秒杀系统",
            role: "",
            timeRange: { start: "2023-01", end: "2023-05" },
            description: "设计并实现基于 Redis 的库存预扣方案,压测 QPS 达到 5000",
          },
        ],
      },
      abilityTags: backendAbilityTags,
      targetDirection: "后端开发工程师",
      originalText: SAMPLE_RESUME_TEXT,
    },
    originalText: SAMPLE_RESUME_TEXT,
    originalTextOnlyMarker: "联系电话:",
    noDigitsAt: [0, 1],
    expectedModificationCount: 4,
    mockOutput: {
      modifications: [
        {
          category: "基本信息",
          originalText: "后端开发工程师",
          optimizedText: "后端开发工程师,专注高并发电商与分布式系统",
          reason: "求职意向补充方向侧写,与经历关键词对齐",
        },
        {
          category: "技能",
          originalText: "Java、Spring Boot、MySQL、Redis、Docker、Git",
          optimizedText: "Spring Boot、MySQL、Redis、Java、Docker、Git",
          reason: "按后端岗位相关性排序,核心框架与存储前置",
        },
        {
          category: "工作经历",
          originalText:
            "负责电商订单系统的开发与维护,日均处理订单 50 万笔\n优化数据库查询,接口响应时间从 800ms 降低到 200ms\n主导商品服务重构,线上故障率下降 60%",
          optimizedText:
            "负责电商订单系统开发与维护,支撑日均 50 万笔订单处理\n主导数据库查询优化,接口响应时间由 800ms 降至 200ms\n主导商品服务重构,线上故障率下降 60%",
          reason: "动词开头并前置量化成果,突出后端岗位要求",
        },
        {
          category: "项目经历",
          originalText: "设计并实现基于 Redis 的库存预扣方案,压测 QPS 达到 5000",
          optimizedText: "设计并实现基于 Redis 的库存预扣方案,压测 QPS 达 5000,支撑秒杀场景高并发下单",
          reason: "补充技术价值的场景表达,复用原文数字",
        },
      ],
    },
  },
  {
    id: "frontend-grad",
    description: "前端应届生(实习 1 段 + 项目 2 个):4 条建议,无数字项目片段不虚构数字",
    input: {
      parsedData: {
        basicInfo: {
          name: "李娜",
          targetPosition: "前端开发工程师",
          phone: "139-1111-2222",
          email: "lina@example.com",
        },
        education: [
          {
            school: "武汉大学",
            degree: "本科",
            major: "软件工程",
            timeRange: { start: "2018-09", end: "2022-06" },
          },
          {
            school: "华中科技大学",
            degree: "硕士",
            major: "计算机技术",
            timeRange: { start: "2022-09", end: "2025-06" },
          },
        ],
        skills: ["JavaScript", "TypeScript", "Vue", "React", "HTML/CSS", "Node.js", "Webpack"],
        experiences: [
          {
            type: "实习",
            company: "深圳某互联网公司",
            role: "前端开发实习生",
            timeRange: { start: "2024-06", end: "2024-09" },
            description:
              "参与公司内部中台系统的页面开发,独立完成 12 个业务组件\n优化首屏加载,打包体积减少 30%",
          },
        ],
        projects: [
          {
            name: "校园二手交易平台",
            role: "",
            timeRange: { start: "2023-10", end: "2024-03" },
            description: "负责前端整体架构与页面实现",
          },
          {
            name: "低代码表单引擎",
            role: "",
            timeRange: { start: "2024-11", end: "2025-02" },
            description: "基于 JSON Schema 实现表单渲染,支持 8 种控件类型",
          },
        ],
      },
      abilityTags: [
        { name: "JavaScript", level: "熟练" as const },
        { name: "Vue", level: "熟练" as const },
      ],
      targetDirection: "前端开发工程师",
      originalText: frontendGradOriginalText,
    },
    originalText: frontendGradOriginalText,
    originalTextOnlyMarker: "(课程项目)",
    noDigitsAt: [0, 3],
    expectedModificationCount: 4,
    mockOutput: {
      modifications: [
        {
          category: "基本信息",
          originalText: "前端开发工程师",
          optimizedText: "前端开发工程师,专注中后台与工程化方向",
          reason: "求职意向结合实习与项目方向定位",
        },
        {
          category: "实习经历",
          originalText:
            "参与公司内部中台系统的页面开发,独立完成 12 个业务组件\n优化首屏加载,打包体积减少 30%",
          optimizedText:
            "参与公司内部中台系统页面开发,独立完成 12 个业务组件\n主导首屏加载优化,打包体积减少 30%",
          reason: "动词开头突出独立产出,复用原文数字",
        },
        {
          category: "项目经历",
          originalText: "基于 JSON Schema 实现表单渲染,支持 8 种控件类型",
          optimizedText: "设计并实现基于 JSON Schema 的表单渲染引擎,支持 8 种控件类型",
          reason: "突出设计能力与实现深度,复用原文数字",
        },
        {
          category: "项目经历",
          originalText: "负责前端整体架构与页面实现",
          optimizedText: "主导平台前端整体架构设计与页面实现",
          reason: "动词强化,体现项目主导角色",
        },
      ],
    },
  },
  {
    id: "product-manager",
    description: "产品经理(两段工作经历,无项目经历):4 条建议,求职意向/技能片段无数字不虚构",
    input: {
      parsedData: {
        basicInfo: {
          name: "王强",
          targetPosition: "产品经理",
          phone: "137-3333-4444",
          email: "wangqiang@example.com",
        },
        education: [
          {
            school: "中山大学",
            degree: "本科",
            major: "市场营销",
            timeRange: { start: "2015-09", end: "2019-06" },
          },
        ],
        skills: ["Axure", "SQL", "数据分析", "项目管理"],
        experiences: [
          {
            type: "工作",
            company: "广州某电商公司",
            role: "产品专员",
            timeRange: { start: "2019-07", end: "2022-03" },
            description: "负责订单后台的产品迭代,上线 5 个版本",
          },
          {
            type: "工作",
            company: "深圳某科技公司",
            role: "产品经理",
            timeRange: { start: "2022-04", end: "至今" },
            description: "主导客户管理系统从 0 到 1 建设,服务 200 家客户",
          },
        ],
        projects: [],
      },
      abilityTags: [{ name: "数据分析", level: "熟练" as const }],
      targetDirection: "产品经理",
      originalText: productManagerOriginalText,
    },
    originalText: productManagerOriginalText,
    originalTextOnlyMarker: "电话:",
    noDigitsAt: [0, 1],
    expectedModificationCount: 4,
    mockOutput: {
      modifications: [
        {
          category: "基本信息",
          originalText: "产品经理",
          optimizedText: "产品经理,专注 B 端后台与客户管理系统方向",
          reason: "求职意向与两段工作经历方向对齐",
        },
        {
          category: "技能",
          originalText: "Axure、SQL、数据分析、项目管理",
          optimizedText: "SQL、数据分析、Axure、项目管理",
          reason: "按岗位价值排序,数据能力前置",
        },
        {
          category: "工作经历",
          originalText: "负责订单后台的产品迭代,上线 5 个版本",
          optimizedText: "负责订单后台产品迭代,主导 5 个版本从规划到上线",
          reason: "动词开头并突出完整交付链路,复用原文数字",
        },
        {
          category: "工作经历",
          originalText: "主导客户管理系统从 0 到 1 建设,服务 200 家客户",
          optimizedText: "主导客户管理系统从 0 到 1 建设,服务 200 家客户,覆盖售前到交付全流程",
          reason: "补充服务深度的表达,复用原文数字",
        },
      ],
    },
  },
];
