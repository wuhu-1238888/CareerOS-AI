// 岗位匹配输出 Schema(6.1,客户端安全,无 node:fs):
// 匹配报告页(客户端组件)需要对从 DB 读回的 matchReport 做渲染前校验,而 matching.agent.ts 经 base.ts
// 引入 node:fs(loadPrompt),不能进入客户端包。agent 与管线继续从本文件导入。
// 结构对应 agent-design 2.4:JD 结构化拆解(显性+隐性+权重)→ 逐项能力对比 → 差距 → 六维雷达
// (jobRadar 复用画像雷达维度)→ 简历针对性优化建议 → 投递建议。
import { z } from "zod";
import { profileRadarSchema } from "@/lib/profile/analysis-schemas";

export { profileRadarSchema };
export type { ProfileRadar } from "@/lib/profile/analysis-schemas";

// 岗位要求拆解条目:稳定 id(纠偏反馈定位用)、文本、显性/隐性、重要度 1-5
export const matchRequirementSchema = z.object({
  id: z.string().regex(/^req-\d+$/, "要求 id 必须形如 req-1"),
  text: z.string().min(1, "要求文本不能为空").max(200, "要求文本最多 200 字"),
  category: z.enum(["显性", "隐性"]),
  importance: z.number().int().min(1).max(5),
});
export type MatchRequirement = z.infer<typeof matchRequirementSchema>;

// 逐项能力对比:requirementId 指向 requirements 中的条目(superRefine 校验存在性)
export const matchItemSchema = z.object({
  requirementId: z.string().min(1, "关联要求不能为空").max(20),
  status: z.enum(["达标", "接近", "不足"]),
  matchType: z.enum(["直接", "间接", "可迁移"]),
  userEvidence: z.string().min(1, "用户证据不能为空").max(200, "用户证据最多 200 字"),
  gap: z.string().min(1, "差距说明不能为空").max(200, "差距说明最多 200 字"),
});
export type MatchItem = z.infer<typeof matchItemSchema>;

// 投递建议三档(agent-design 2.4):建议投递 / 建议补课后投递 / 不推荐
export const recommendationLevelSchema = z.enum(["建议投递", "建议补课后投递", "不推荐"]);
export type RecommendationLevel = z.infer<typeof recommendationLevelSchema>;

export const matchAnalysisSchema = z
  .object({
    // 岗位名(预填技能分析表单目标岗位);无法确定时可为空
    positionTitle: z.string().min(1).max(50).nullable(),
    // 一句话匹配结论
    summary: z.string().min(1, "匹配摘要不能为空").max(200, "匹配摘要最多 200 字"),
    // JD 结构化拆解(显性 + 隐性需求)
    requirements: z
      .array(matchRequirementSchema)
      .min(1, "岗位要求至少 1 条")
      .max(20, "岗位要求最多 20 条"),
    // 逐项能力对比;无画像降级时为空数组(管线层归一化)
    items: z.array(matchItemSchema).max(20, "对比条目最多 20 条"),
    // 整体匹配度 0-100;无画像降级时为 null(UI 渲染「仅拆解」形态)
    overallScore: z.number().int().min(0).max(100).nullable(),
    recommendation: z
      .object({
        level: recommendationLevelSchema,
        reason: z.string().min(1, "投递建议理由不能为空").max(200, "投递建议理由最多 200 字"),
      })
      .nullable(),
    // 岗位要求六维雷达(维度与画像雷达一致);用户线由前端直接读画像 aiAnalysis.radar
    jobRadar: profileRadarSchema,
    // 简历针对性优化建议(agent-design 2.4 输出项)
    resumeSuggestions: z
      .array(
        z.object({
          requirementId: z.string().min(1).max(20).optional(),
          suggestion: z.string().min(1, "优化建议不能为空").max(200, "优化建议最多 200 字"),
        })
      )
      .max(5, "优化建议最多 5 条")
      .default([]),
    // 方向比对(8.1c):比对本岗位方向与画像声明方向。alignedDirection 逐字照抄画像方向,
    // verdict=aligned/conflict,reason 一句话说明;无画像或画像未声明方向时为 null。
    // optional+default(null):旧夹具与存量 matchReport 零改动兼容(冲突并列呈现依赖此字段)。
    directionVerdict: z
      .object({
        alignedDirection: z.string().min(1, "画像方向不能为空").max(20, "画像方向最多 20 字"),
        verdict: z.enum(["aligned", "conflict"]),
        reason: z.string().min(1, "比对理由不能为空").max(100, "比对理由最多 100 字"),
      })
      .nullable()
      .optional()
      .default(null),
  })
  .superRefine((value, ctx) => {
    // 对比条目必须指向存在的岗位要求(镜像 roadmapSummarySchema.stageCount 先例)
    const ids = new Set(value.requirements.map((r) => r.id));
    value.items.forEach((item, index) => {
      if (!ids.has(item.requirementId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `items[${index}].requirementId 不在 requirements 中`,
          path: ["items", index, "requirementId"],
        });
      }
    });
  });
export type MatchAnalysis = z.infer<typeof matchAnalysisSchema>;
// 输入形态:directionVerdict/resumeSuggestions 等带 default 的字段可省略(夹具构造用)
export type MatchAnalysisInput = z.input<typeof matchAnalysisSchema>;
