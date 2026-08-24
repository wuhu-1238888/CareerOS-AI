// Matching Agent(6.1):岗位匹配顾问,按 agent-design 2.4 ——
// JD 结构化拆解(显性+隐性+权重)→ 逐项能力对比 → 差距 → 六维雷达 → 简历建议/投递建议。
// 输出 Schema 放 analysis-schemas(客户端安全,6.2 报告页渲染前校验用);此处转发保持原导入路径。
import { z } from "zod";
import { BaseAgent } from "./base";
import type { AgentContext } from "./types";
import type { ChatMessage } from "@/lib/llm/adapter";
import { matchAnalysisSchema, profileRadarSchema } from "@/lib/matching/analysis-schemas";
import type { MatchAnalysis, MatchAnalysisInput, ProfileRadar } from "@/lib/matching/analysis-schemas";

export { matchAnalysisSchema, profileRadarSchema };
export type { MatchAnalysis, MatchAnalysisInput, ProfileRadar };

export const matchingAgentInputSchema = z.object({
  // JD 原文(用户粘贴,≤8000 字)
  jdText: z.string().min(1, "JD 不能为空").max(8000, "JD 最多 8000 字"),
  // 画像分析摘要(6.2 服务端组装);无画像用户为 null → Agent 仅做 JD 拆解
  profileSummary: z.string().min(1).max(3000).nullable().default(null),
  // 已采纳简历优化文本(可选,能力证据补充)
  optimizedResumeText: z.string().min(1).max(4000).nullable().default(null),
  // 6.2 纠偏反馈:「这个要求我其实满足」定位到具体 requirementId
  feedback: z
    .array(
      z.object({
        requirementId: z.string().min(1, "要求 id 不能为空").max(20),
        note: z.string().min(1, "说明不能为空").max(200, "说明最多 200 字"),
      })
    )
    .max(10, "纠偏条目最多 10 条")
    .optional(),
});
export type MatchingAgentInput = z.infer<typeof matchingAgentInputSchema>;

export class MatchingAgent extends BaseAgent<MatchingAgentInput, MatchAnalysis> {
  readonly config = {
    name: "job-matching-agent",
    description: "岗位匹配顾问:JD 拆解、能力对比、匹配度与投递建议(agent-design 2.4)",
    promptPath: "matching/job-matching.md",
    inputSchema: matchingAgentInputSchema,
    outputSchema: matchAnalysisSchema,
  };

  buildMessages(input: MatchingAgentInput, context: AgentContext): ChatMessage[] {
    // 结构化输入一并交给模型;上下文信封仅作执行间透传,无需注入 Prompt
    void context;
    return [
      {
        role: "user",
        content: JSON.stringify(
          {
            jdText: input.jdText,
            profileSummary: input.profileSummary,
            optimizedResumeText: input.optimizedResumeText,
            feedback: input.feedback ?? null,
          },
          null,
          2
        ),
      },
    ];
  }
}

export const matchingAgent = new MatchingAgent();
