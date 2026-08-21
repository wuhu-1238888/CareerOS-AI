// 简历模块输出 Schema(4.3,客户端安全,无 node:fs):解析结果 / 修改建议 / ATS 报告。
// 供 Agent outputSchema、DB Json 列防御解析与前端渲染前校验共用(同 navigator/analysis-schemas.ts 惯例)。
import { z } from "zod";

/** 时间段:start 必填,end 缺省「至今」(在校/在任经历) */
export const timeRangeSchema = z.object({
  start: z.string().min(1, "开始时间不能为空").max(20),
  end: z.string().max(20).default("至今"),
});
export type TimeRange = z.infer<typeof timeRangeSchema>;

/** 工作/实习经历条目 */
export const experienceEntrySchema = z.object({
  type: z.enum(["工作", "实习"]),
  company: z.string().min(1, "公司/组织不能为空").max(100),
  role: z.string().min(1, "职位不能为空").max(100),
  timeRange: timeRangeSchema,
  description: z.string().max(2000).default(""),
});
export type ExperienceEntry = z.infer<typeof experienceEntrySchema>;

/** 项目经历条目 */
export const projectEntrySchema = z.object({
  name: z.string().min(1, "项目名称不能为空").max(100),
  role: z.string().max(100).default(""),
  timeRange: timeRangeSchema,
  description: z.string().max(2000).default(""),
});
export type ProjectEntry = z.infer<typeof projectEntrySchema>;

/** 简历解析结果(4.3):基本信息 / 教育 / 技能 / 工作实习 / 项目,分区结构与核对表单一致 */
export const parsedResumeSchema = z.object({
  basicInfo: z.object({
    name: z.string().max(50).default(""),
    targetPosition: z.string().max(100).default(""),
    phone: z.string().max(30).default(""),
    email: z.string().max(100).default(""),
  }),
  education: z
    .array(
      z.object({
        school: z.string().min(1, "学校不能为空").max(100),
        degree: z.string().max(50).default(""),
        major: z.string().max(100).default(""),
        timeRange: timeRangeSchema,
      })
    )
    .max(10)
    .default([]),
  skills: z.array(z.string().min(1, "技能不能为空").max(50)).max(30).default([]),
  experiences: z.array(experienceEntrySchema).max(15).default([]),
  projects: z.array(projectEntrySchema).max(15).default([]),
});
export type ParsedResume = z.infer<typeof parsedResumeSchema>;

/** 单条修改建议(4.4):原文片段 + 优化后片段 + 理由,原文须逐字摘抄自简历原文 */
export const modificationSchema = z.object({
  category: z.string().min(1, "类别不能为空").max(20),
  originalText: z.string().min(1, "原文片段不能为空").max(2000),
  optimizedText: z.string().min(1, "优化后片段不能为空").max(2000),
  reason: z.string().min(1, "理由不能为空").max(500),
});
export type Modification = z.infer<typeof modificationSchema>;

/** 改写分析结果(4.4):3-8 条修改建议 */
export const rewriteAnalysisSchema = z.object({
  modifications: z.array(modificationSchema).min(3, "修改建议至少 3 条").max(8, "修改建议最多 8 条"),
});
export type RewriteAnalysis = z.infer<typeof rewriteAnalysisSchema>;

/** ATS LLM 分项(4.6):内容质量与岗位相关度,量化到 5 分档(建议列表在报告层,4.7 起共用) */
export const atsLlmSubscoresSchema = z.object({
  contentQuality: z.number().int().min(1, "内容质量 1-5").max(5, "内容质量 1-5"),
  relevance: z.number().int().min(1, "岗位相关度 1-5").max(5, "岗位相关度 1-5"),
});
export type AtsLlmSubscores = z.infer<typeof atsLlmSubscoresSchema>;

/** 改进建议条目(4.6) */
export const atsSuggestionSchema = z.object({
  title: z.string().min(1, "建议标题不能为空").max(50),
  detail: z.string().min(1, "建议说明不能为空").max(300),
});
export type AtsSuggestion = z.infer<typeof atsSuggestionSchema>;

/** ATS 规则分项(4.6,TS 确定性计算):固定 6 子分 */
export const atsRuleSubscoresSchema = z.object({
  sections: z.number().int().min(0).max(100),
  quantified: z.number().int().min(0).max(100),
  keywords: z.number().int().min(0).max(100),
  actionVerbs: z.number().int().min(0).max(100),
  length: z.number().int().min(0).max(100),
  parseability: z.number().int().min(0).max(100),
});
export type AtsRuleSubscores = z.infer<typeof atsRuleSubscoresSchema>;

/** ATS 完整报告(4.6):规则分 + LLM 分项 + 合成总分与等级 + 建议(2-5 条) */
export const atsReportSchema = z.object({
  total: z.number().int().min(0).max(100),
  level: z.enum(["优秀", "良好", "需改进"]),
  ruleSubscores: atsRuleSubscoresSchema,
  ruleScore: z.number().int().min(0).max(100),
  llmSubscores: atsLlmSubscoresSchema,
  suggestions: z.array(atsSuggestionSchema).min(2, "建议至少 2 条").max(5, "建议最多 5 条"),
});
export type AtsReport = z.infer<typeof atsReportSchema>;
