// 固定样例集(4.3):3 份手工标注的简历原文 + 手工构造的 Mock 解析输出。
// 用于验证:输出通过 Schema、分区条目数与标注一致、字段忠实(不虚构)、输入透传。
// 真实 LLM 质量验证待 DeepSeek Key(progress.md 遗留 #1)。
import type { ParsedResume } from "@/lib/resume/analysis-schemas";
import type { ResumeParseAgentInput } from "../resume.agent";
import { SAMPLE_RESUME_TEXT } from "@/lib/resume/__tests__/fixtures/expected";

export type ResumeParseSample = {
  id: string;
  description: string;
  input: ResumeParseAgentInput;
  /** 标注:基本信息姓名与求职意向 */
  expectedName: string;
  expectedTargetPosition: string;
  /** 标注:各分区条目数 */
  expectedEducationCount: number;
  expectedSkillCount: number;
  expectedExperienceCount: number;
  expectedProjectCount: number;
  /** 手工构造的 Mock 输出(需通过 parsedResumeSchema,且各分区数量与标注一致) */
  mockOutput: ParsedResume;
};

export const resumeParseSamples: ResumeParseSample[] = [
  {
    id: "backend-engineer",
    description: "后端开发工程师(3 年经验,含量化表达):教育 1 / 技能 6 / 工作 1 / 项目 1",
    input: { resumeText: SAMPLE_RESUME_TEXT },
    expectedName: "张伟",
    expectedTargetPosition: "后端开发工程师",
    expectedEducationCount: 1,
    expectedSkillCount: 6,
    expectedExperienceCount: 1,
    expectedProjectCount: 1,
    mockOutput: {
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
          description: "负责电商订单系统的开发与维护,日均处理订单 50 万笔\n优化数据库查询,接口响应时间从 800ms 降低到 200ms\n主导商品服务重构,线上故障率下降 60%",
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
  },
  {
    id: "frontend-grad",
    description: "前端应届生(实习 1 段 + 项目 2 个,无工作经历):教育 2 / 技能 7 / 实习 1 / 项目 2",
    input: {
      resumeText: `李娜
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
基于 JSON Schema 实现表单渲染,支持 8 种控件类型`,
    },
    expectedName: "李娜",
    expectedTargetPosition: "前端开发工程师",
    expectedEducationCount: 2,
    expectedSkillCount: 7,
    expectedExperienceCount: 1,
    expectedProjectCount: 2,
    mockOutput: {
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
          description: "参与公司内部中台系统的页面开发,独立完成 12 个业务组件\n优化首屏加载,打包体积减少 30%",
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
  },
  {
    id: "product-manager",
    description: "产品经理(两段工作经历,无项目经历):教育 1 / 技能 4 / 工作 2 / 项目 0",
    input: {
      resumeText: `王强
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
主导客户管理系统从 0 到 1 建设,服务 200 家客户`,
    },
    expectedName: "王强",
    expectedTargetPosition: "产品经理",
    expectedEducationCount: 1,
    expectedSkillCount: 4,
    expectedExperienceCount: 2,
    expectedProjectCount: 0,
    mockOutput: {
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
  },
];
