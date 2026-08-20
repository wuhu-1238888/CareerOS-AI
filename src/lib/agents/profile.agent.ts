// Profile Agent(2.3):职业画像分析师,严格按 agent-design 2.1 ——
// 角色锚定/五步推理(信息完整性→能力提炼分级→方向匹配→差距分析→叙事生成)/六维雷达/边界限制/不确定性表达
import { z } from "zod";
import { BaseAgent } from "./base";
import type { AgentContext } from "./types";
import type { ChatMessage } from "@/lib/llm/adapter";
import { educationEntrySchema, skillEntrySchema, experienceEntrySchema } from "@/lib/profile/schemas";

export const profileAgentInputSchema = z.object({
  education: z.array(educationEntrySchema).min(1, "教育背景不能为空"),
  skills: z.array(skillEntrySchema).min(1, "技能不能为空"),
  experiences: z.array(experienceEntrySchema).max(10).default([]),
  interests: z.array(z.string()).max(10).default([]),
  targets: z.array(z.string()).max(5).default([]),
  // 2.6 纠偏反馈:用户指出的不准确部分(方向/能力/优势)+ 补充说明
  feedback: z
    .object({
      areas: z.array(z.enum(["direction", "ability", "strength"])).min(1, "请选择不准确的部分"),
      note: z.string().max(500, "补充说明最多 500 字").optional(),
    })
    .optional(),
});
export type ProfileAgentInput = z.infer<typeof profileAgentInputSchema>;

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

export class ProfileAgent extends BaseAgent<ProfileAgentInput, ProfileAnalysis> {
  readonly config = {
    name: "career-profile-analyzer",
    description: "职业画像分析师:提炼能力、推荐方向、生成画像摘要与发展建议(agent-design 2.1)",
    promptPath: "profile-analyst.md",
    inputSchema: profileAgentInputSchema,
    outputSchema: profileAnalysisSchema,
  };

  buildMessages(input: ProfileAgentInput, context: AgentContext): ChatMessage[] {
    // 结构化输入 + 纠偏反馈一并交给模型;上下文信封仅作执行间透传,无需注入 Prompt
    void context;
    return [
      {
        role: "user",
        content: JSON.stringify(
          {
            education: input.education,
            skills: input.skills,
            experiences: input.experiences,
            interests: input.interests,
            targets: input.targets,
            feedback: input.feedback ?? null,
          },
          null,
          2
        ),
      },
    ];
  }
}

export const profileAgent = new ProfileAgent();
