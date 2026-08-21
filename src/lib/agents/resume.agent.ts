// 简历 Agent(4.3 起):同文件多 Agent(navigator 双 Agent 先例)。
//  - ResumeParseAgent(parse-resume):原文 → 结构化解析,只提取不评价不改写
//  - ResumeRewriteAgent(rewrite-resume,4.4):解析结果 + 能力标签 + 目标方向 → 逐条修改建议
//  - ResumeAtsAgent(score-ats,4.6):最终文本 + 目标方向 → LLM 分项与建议(温度 0)
import { z } from "zod";
import { BaseAgent } from "./base";
import type { AgentContext } from "./types";
import type { ChatMessage } from "@/lib/llm/adapter";
// 输出 Schema 位于 analysis-schemas(客户端安全);此处转发保持与 Profile/Navigator Agent 相同的导入惯例
import {
  atsLlmAnalysisSchema,
  atsLlmSubscoresSchema,
  parsedResumeSchema,
  rewriteAnalysisSchema,
} from "@/lib/resume/analysis-schemas";
import type { AtsLlmAnalysis, AtsLlmSubscores, ParsedResume, RewriteAnalysis } from "@/lib/resume/analysis-schemas";

export { atsLlmAnalysisSchema, atsLlmSubscoresSchema, parsedResumeSchema, rewriteAnalysisSchema };
export type { AtsLlmAnalysis, AtsLlmSubscores, ParsedResume, RewriteAnalysis };

export const resumeParseAgentInputSchema = z.object({
  resumeText: z.string().min(10, "简历内容至少 10 个字符").max(20000, "简历内容最多 20000 字"),
});
export type ResumeParseAgentInput = z.infer<typeof resumeParseAgentInputSchema>;

export class ResumeParseAgent extends BaseAgent<ResumeParseAgentInput, ParsedResume> {
  readonly config = {
    name: "resume-parse-agent",
    description: "简历解析师:把简历原文忠实提取为结构化字段(基本信息/教育/技能/经历/项目),只提取不评价",
    promptPath: "resume/resume-parse.md",
    inputSchema: resumeParseAgentInputSchema,
    outputSchema: parsedResumeSchema,
  };

  buildMessages(input: ResumeParseAgentInput, context: AgentContext): ChatMessage[] {
    void context;
    return [{ role: "user", content: JSON.stringify({ resumeText: input.resumeText }, null, 2) }];
  }
}

// 改写输入(4.4,本次修订):简历原文(引用片段逐字摘抄的唯一来源)+ 核对后解析结果 + 画像能力标签 + 目标方向
export const resumeRewriteAgentInputSchema = z.object({
  originalText: z.string().min(1, "简历原文不能为空").max(20000, "简历内容最多 20000 字"),
  parsedData: parsedResumeSchema,
  abilityTags: z
    .array(z.object({ name: z.string().min(1).max(50), level: z.enum(["基础", "熟练", "精通"]) }))
    .max(20)
    .default([]),
  targetDirection: z.string().min(1, "目标方向不能为空").max(30),
});
export type ResumeRewriteAgentInput = z.infer<typeof resumeRewriteAgentInputSchema>;

export class ResumeRewriteAgent extends BaseAgent<ResumeRewriteAgentInput, RewriteAnalysis> {
  readonly config = {
    name: "resume-rewrite-agent",
    description: "简历优化师:在保持事实不变的前提下重建叙事,输出逐条可解释的修改建议(原文逐字摘抄)",
    promptPath: "resume/resume-rewrite.md",
    inputSchema: resumeRewriteAgentInputSchema,
    outputSchema: rewriteAnalysisSchema,
  };

  buildMessages(input: ResumeRewriteAgentInput, context: AgentContext): ChatMessage[] {
    void context;
    return [
      {
        role: "user",
        content: JSON.stringify(
          {
            originalText: input.originalText,
            parsedData: input.parsedData,
            abilityTags: input.abilityTags,
            targetDirection: input.targetDirection,
          },
          null,
          2
        ),
      },
    ];
  }
}

// ATS 评分输入(4.6):最终采纳文本 + 目标方向
export const resumeAtsAgentInputSchema = z.object({
  finalText: z.string().min(10, "简历内容至少 10 个字符").max(20000, "简历内容最多 20000 字"),
  targetDirection: z.string().min(1, "目标方向不能为空").max(30),
});
export type ResumeAtsAgentInput = z.infer<typeof resumeAtsAgentInputSchema>;

export class ResumeAtsAgent extends BaseAgent<ResumeAtsAgentInput, AtsLlmAnalysis> {
  readonly config = {
    name: "resume-ats-agent",
    description: "ATS 评分师:评估简历内容质量与岗位相关度(1-5 分档)并给出改进建议,温度 0 保证评分稳定",
    promptPath: "resume/resume-ats.md",
    inputSchema: resumeAtsAgentInputSchema,
    outputSchema: atsLlmAnalysisSchema,
    temperature: 0,
  };

  buildMessages(input: ResumeAtsAgentInput, context: AgentContext): ChatMessage[] {
    void context;
    return [
      {
        role: "user",
        content: JSON.stringify(
          { finalText: input.finalText, targetDirection: input.targetDirection },
          null,
          2
        ),
      },
    ];
  }
}

export const resumeParseAgent = new ResumeParseAgent();
export const resumeRewriteAgent = new ResumeRewriteAgent();
export const resumeAtsAgent = new ResumeAtsAgent();
