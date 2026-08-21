// 固定样例集(4.6):3 份手工标注的 ATS 评分输入(最终采纳文本 + 目标方向)+ 手工构造的 Mock 输出。
// 用于验证:输出通过 Schema、分项为 1-5 整数分档、建议 2-5 条、输入透传(最终文本与方向进入 user 消息)。
import type { AtsLlmAnalysis } from "@/lib/resume/analysis-schemas";
import type { ResumeAtsAgentInput } from "../resume.agent";
import { SAMPLE_RESUME_TEXT } from "@/lib/resume/__tests__/fixtures/expected";

export type ResumeAtsSample = {
  id: string;
  description: string;
  input: ResumeAtsAgentInput;
  /** 手工标注的分档(1-5 整数) */
  expectedContentQuality: number;
  expectedRelevance: number;
  expectedSuggestionCount: number;
  /** 手工构造的 Mock 输出(需通过 atsLlmAnalysisSchema) */
  mockOutput: AtsLlmAnalysis;
};

export const resumeAtsSamples: ResumeAtsSample[] = [
  {
    id: "backend-engineer",
    description: "后端开发工程师最终文本:五节齐全含量化成果,高分高相关(5/5)",
    input: { finalText: SAMPLE_RESUME_TEXT, targetDirection: "后端开发工程师" },
    expectedContentQuality: 5,
    expectedRelevance: 5,
    expectedSuggestionCount: 2,
    mockOutput: {
      llmSubscores: { contentQuality: 5, relevance: 5 },
      suggestions: [
        {
          title: "项目经历补充团队与周期信息",
          detail: "分布式秒杀系统可补充团队规模与个人职责边界,增强项目可信度。",
        },
        {
          title: "教育经历补充主修课程",
          detail: "可增加与后端方向相关的核心课程(如数据库、操作系统),提升岗位匹配度。",
        },
      ],
    },
  },
  {
    id: "frontend-grad",
    description: "前端应届生文本:结构完整但量化偏少,中等分档(3/2)",
    input: {
      finalText: `李娜
求职意向:前端开发工程师
电话:139-1111-2222

教育经历
2018-09 至 2022-06 武汉大学 软件工程 本科

技能
JavaScript、TypeScript、Vue、React

实习经历
2024-06 至 2024-09 深圳某互联网公司 前端开发实习生
参与公司内部中台系统的页面开发,独立完成 12 个业务组件

项目经历
2023-10 至 2024-03 校园二手交易平台
负责前端整体架构与页面实现`,
      targetDirection: "前端开发工程师",
    },
    expectedContentQuality: 3,
    expectedRelevance: 2,
    expectedSuggestionCount: 3,
    mockOutput: {
      llmSubscores: { contentQuality: 3, relevance: 2 },
      suggestions: [
        {
          title: "补充量化成果",
          detail: "项目经历缺少可量化指标,可补充页面数、性能提升或用户规模。",
        },
        {
          title: "突出组件化能力",
          detail: "技能列表可补充组件库、工程化工具等关键词,与目标岗位对齐。",
        },
        {
          title: "实习经历补充产出细节",
          detail: "12 个业务组件可展开为类型与复杂度,体现独立完成度。",
        },
      ],
    },
  },
  {
    id: "career-switch",
    description: "跨行求职文本:内容与目标方向关联弱,低分档(1/1)",
    input: {
      finalText: `王强
求职意向:数据分析师
电话:137-3333-4444

教育经历
2015-09 至 2019-06 中山大学 市场营销 本科

工作经历
2019-07 至 2022-03 广州某电商公司 产品专员
负责订单后台的产品迭代

2022-04 至今 深圳某科技公司 产品经理
主导客户管理系统建设`,
      targetDirection: "数据分析师",
    },
    expectedContentQuality: 1,
    expectedRelevance: 1,
    expectedSuggestionCount: 4,
    mockOutput: {
      llmSubscores: { contentQuality: 1, relevance: 1 },
      suggestions: [
        {
          title: "补充数据分析技能",
          detail: "技能区缺失,应补充 SQL、Python、Excel 等数据分析岗位核心技能。",
        },
        {
          title: "经历向数据叙事改写",
          detail: "产品迭代经历缺少数据成果,可补充埋点分析、报表产出等数据相关职责。",
        },
        {
          title: "增加量化指标",
          detail: "全文缺少量化表达,建议用数字描述产出规模与提升幅度。",
        },
        {
          title: "目标方向与经历对齐",
          detail: "当前经历均为产品方向,建议补充数据分析项目或培训经历以支撑转岗。",
        },
      ],
    },
  },
];
