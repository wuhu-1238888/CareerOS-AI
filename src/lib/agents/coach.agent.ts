// Skill Coach Agent(6.3):技能教练,按 agent-design 2.5 ——
// 差距优先级矩阵(重要性 × 差距 → P0/P1/P2)→ 90 天(13 周)提升计划(时间预算约束)
// → 里程碑 → 资源推荐(必标 free/paid)→ 风险提示。
// 输出 Schema 放 analysis-schemas(客户端安全,6.4 计划页渲染前校验用);此处转发保持原导入路径。
import { z } from "zod";
import { BaseAgent } from "./base";
import type { AgentContext } from "./types";
import type { ChatMessage } from "@/lib/llm/adapter";
import { coachPlanSchema } from "@/lib/coach/analysis-schemas";
import type { CoachPlan } from "@/lib/coach/analysis-schemas";

export { coachPlanSchema };
export type { CoachPlan };

export const coachAgentInputSchema = z.object({
  // 目标岗位(预填 JobMatch.jdTitle,6.4)
  targetPosition: z.string().min(1, "目标岗位不能为空").max(50, "岗位名最多 50 字"),
  // 差距清单(6.4 服务端从 matchReport 组装:未达标/接近项 + importance)
  requirements: z
    .array(
      z.object({
        name: z.string().min(1, "要求描述不能为空").max(100, "要求描述最多 100 字"),
        importance: z.number().int().min(1).max(5),
        gap: z.enum(["大", "中", "小"]),
      })
    )
    .min(1, "差距清单至少 1 条")
    .max(15, "差距清单最多 15 条"),
  // 能力基线(与 Navigator 输入同构:画像能力标签)
  abilityBaseline: z.object({
    abilityTags: z
      .array(
        z.object({
          name: z.string().min(1).max(50),
          level: z.enum(["基础", "熟练", "精通"]),
        })
      )
      .max(20),
  }),
  // 每周可投入小时(1-80)
  weeklyHours: z.number().int("每周投入须为整数").min(1, "每周投入至少 1 小时").max(80, "每周投入最多 80 小时"),
  // 学习偏好(选填,≤200 字;如「喜欢视频课程、讨厌长文档」)
  learningPreference: z.string().max(200, "学习偏好最多 200 字").optional(),
});
export type CoachAgentInput = z.infer<typeof coachAgentInputSchema>;

export class SkillCoachAgent extends BaseAgent<CoachAgentInput, CoachPlan> {
  readonly config = {
    name: "skill-coach-agent",
    description: "技能教练:差距优先级矩阵 + 90 天提升计划 + 资源推荐(agent-design 2.5)",
    promptPath: "coach/skill-coach.md",
    inputSchema: coachAgentInputSchema,
    outputSchema: coachPlanSchema,
  };

  buildMessages(input: CoachAgentInput, context: AgentContext): ChatMessage[] {
    // 结构化输入一并交给模型;上下文信封仅作执行间透传,无需注入 Prompt
    void context;
    return [
      {
        role: "user",
        content: JSON.stringify(
          {
            targetPosition: input.targetPosition,
            requirements: input.requirements,
            abilityBaseline: input.abilityBaseline,
            weeklyHours: input.weeklyHours,
            learningPreference: input.learningPreference ?? null,
          },
          null,
          2
        ),
      },
    ];
  }
}

export const skillCoachAgent = new SkillCoachAgent();
