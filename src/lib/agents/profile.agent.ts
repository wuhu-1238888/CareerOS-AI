// Profile Agent(2.3):职业画像分析师,严格按 agent-design 2.1 ——
// 角色锚定/五步推理(信息完整性→能力提炼分级→方向匹配→差距分析→叙事生成)/六维雷达/边界限制/不确定性表达
import { z } from "zod";
import { BaseAgent } from "./base";
import type { AgentContext } from "./types";
import type { ChatMessage } from "@/lib/llm/adapter";
import { educationEntrySchema, skillEntrySchema, experienceEntrySchema } from "@/lib/profile/schemas";
// 输出 Schema 已移入 analysis-schemas(客户端安全,2.5 结果页渲染前校验用);此处转发保持原导入路径
import { profileAnalysisSchema, profileRadarSchema } from "@/lib/profile/analysis-schemas";
import type { ProfileAnalysis, ProfileRadar } from "@/lib/profile/analysis-schemas";

export { profileAnalysisSchema, profileRadarSchema };
export type { ProfileAnalysis, ProfileRadar };

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
