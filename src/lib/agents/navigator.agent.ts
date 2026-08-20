// Navigator Agent(3.3):职业规划师,严格按 agent-design 2.2 ——
// 双 Agent 共用同一 Prompt(navigator/navigator.md,以 mode 字段区分):
//  - NavigatorAgent(全量):目标方向 + 能力标签 + 周时 + 阶段自评 → 完整路线图(概要 + 3-4 阶段)
//  - NavigatorStageAgent(单阶段重生成,3.5 反馈依赖):附加原阶段内容 + 反馈 → 单个新阶段
import { z } from "zod";
import { BaseAgent } from "./base";
import type { AgentContext } from "./types";
import type { ChatMessage } from "@/lib/llm/adapter";
// 输出 Schema 位于 analysis-schemas(客户端安全);此处转发保持与 Profile Agent 相同的导入惯例
import { roadmapAnalysisSchema, roadmapStageSchema } from "@/lib/navigator/analysis-schemas";
import type { RoadmapAnalysis, RoadmapStage } from "@/lib/navigator/analysis-schemas";

export { roadmapAnalysisSchema, roadmapStageSchema };
export type { RoadmapAnalysis, RoadmapStage };

export const navigatorAgentInputSchema = z.object({
  direction: z.string().min(1, "目标方向不能为空").max(30),
  abilityTags: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        level: z.enum(["基础", "熟练", "精通"]),
      })
    )
    .max(20)
    .default([]),
  weeklyHours: z.number().int().min(1, "每周投入至少 1 小时").max(80, "每周投入最多 80 小时"),
  currentStage: z.enum(["完全新手", "有一定基础", "接近入门"]),
});
export type NavigatorAgentInput = z.infer<typeof navigatorAgentInputSchema>;

// 单阶段重生成输入 = 全量输入 + 原阶段内容与用户反馈(3.5)
export const navigatorStageAgentInputSchema = navigatorAgentInputSchema.extend({
  stageName: z.string().min(1, "阶段名称不能为空").max(30),
  stageContent: z.unknown(),
  feedback: z.enum(["太难了", "已经会了"]),
});
export type NavigatorStageAgentInput = z.infer<typeof navigatorStageAgentInputSchema>;

export class NavigatorAgent extends BaseAgent<NavigatorAgentInput, RoadmapAnalysis> {
  readonly config = {
    name: "career-navigator-agent",
    description: "职业规划师:将目标方向拆解为 3-4 个递进阶段的成长路线图(agent-design 2.2)",
    promptPath: "navigator/navigator.md",
    inputSchema: navigatorAgentInputSchema,
    outputSchema: roadmapAnalysisSchema,
  };

  buildMessages(input: NavigatorAgentInput, context: AgentContext): ChatMessage[] {
    // 结构化输入直接交给模型;上下文信封仅作执行间透传,无需注入 Prompt
    void context;
    return [
      {
        role: "user",
        content: JSON.stringify(
          {
            mode: "full",
            direction: input.direction,
            abilityTags: input.abilityTags,
            weeklyHours: input.weeklyHours,
            currentStage: input.currentStage,
          },
          null,
          2
        ),
      },
    ];
  }
}

export class NavigatorStageAgent extends BaseAgent<NavigatorStageAgentInput, RoadmapStage> {
  readonly config = {
    name: "career-navigator-stage-agent",
    description: "职业规划师(单阶段重生成):按用户反馈(太难了/已经会了)重新设计单个阶段(agent-design 2.2)",
    promptPath: "navigator/navigator.md",
    inputSchema: navigatorStageAgentInputSchema,
    outputSchema: roadmapStageSchema,
  };

  buildMessages(input: NavigatorStageAgentInput, context: AgentContext): ChatMessage[] {
    void context;
    return [
      {
        role: "user",
        content: JSON.stringify(
          {
            mode: "regenerate-stage",
            direction: input.direction,
            abilityTags: input.abilityTags,
            weeklyHours: input.weeklyHours,
            currentStage: input.currentStage,
            stageName: input.stageName,
            stageContent: input.stageContent,
            feedback: input.feedback,
          },
          null,
          2
        ),
      },
    ];
  }
}

export const navigatorAgent = new NavigatorAgent();
export const navigatorStageAgent = new NavigatorStageAgent();
