// 画像分析输出 Schema(2.3 定义,2.5 起移入本文件):
// 结果页(客户端组件)需要对从 DB 读回的 aiAnalysis 做渲染前校验,而 profile.agent.ts 经 base.ts 引入
// node:fs(loadPrompt),不能进入客户端包。agent 与管线继续从本文件导入。
import { z } from "zod";

// 六维雷达:agent-design 2.1 维度(产品/技术/数据/沟通/项目/行业),每维 0-100
export const profileRadarSchema = z.object({
  产品: z.number().int().min(0).max(100),
  技术: z.number().int().min(0).max(100),
  数据: z.number().int().min(0).max(100),
  沟通: z.number().int().min(0).max(100),
  项目: z.number().int().min(0).max(100),
  行业: z.number().int().min(0).max(100),
});
export type ProfileRadar = z.infer<typeof profileRadarSchema>;

// 画像分析输出:画像摘要 / 能力标签 / 优势 / 推荐方向(含匹配度与理由)/ 六维雷达 / 发展建议 / 置信度
export const profileAnalysisSchema = z.object({
  summary: z.string().min(1, "画像摘要不能为空").max(200, "画像摘要最多 200 字"),
  abilityTags: z
    .array(z.object({ name: z.string().min(1).max(20), level: z.enum(["基础", "熟练", "精通"]) }))
    .min(3, "能力标签至少 3 项")
    .max(10, "能力标签最多 10 项"),
  strengths: z
    .array(z.object({ title: z.string().min(1).max(30), detail: z.string().min(1).max(100) }))
    .min(3, "优势至少 3 项")
    .max(5, "优势最多 5 项"),
  directions: z
    .array(
      z.object({
        name: z.string().min(1).max(20),
        matchScore: z.number().int().min(0).max(100),
        reason: z.string().min(1).max(100),
        strengths: z.array(z.string().min(1).max(100)).max(5),
        weaknesses: z.array(z.string().min(1).max(100)).max(5),
      })
    )
    .min(2, "推荐方向至少 2 个")
    .max(4, "推荐方向最多 4 个"),
  radar: profileRadarSchema,
  suggestions: z
    .array(z.object({ gap: z.string().min(1).max(50), action: z.string().min(1).max(200) }))
    .min(1, "发展建议至少 1 条")
    .max(5, "发展建议最多 5 条"),
  confidence: z.object({
    level: z.enum(["高", "中", "低"]),
    note: z.string().min(1).max(200),
  }),
});
export type ProfileAnalysis = z.infer<typeof profileAnalysisSchema>;
