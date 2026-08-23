// 模拟面试综合报告 Agent(7.3):按 agent-design 2.6 ——
// 输入 = 目标岗位 + 面试类型 + 已评估作答摘要(每题含题型/题干/回答截 800 字/内容分/表达分),
// 输出 = 总体评价 / 突出优势 / 主要短板 / 1-2 个重点改进方向(不罗列所有问题)。
// 均分由前端对已评估题确定性计算,报告 Agent 只产出定性内容;温度 0(诊断需要确定性)。
import { z } from "zod";
import { BaseAgent } from "./base";
import type { AgentContext } from "./types";
import type { ChatMessage } from "@/lib/llm/adapter";
import {
  interviewReportSchema,
  interviewQuestionTypeSchema,
  interviewTypeSchema,
} from "@/lib/interview/analysis-schemas";
import type { InterviewReport, InterviewType } from "@/lib/interview/analysis-schemas";

export { interviewReportSchema };
export type { InterviewReport, InterviewType };

export const interviewReportAgentInputSchema = z.object({
  // 目标岗位(场次快照)
  targetPosition: z.string().min(1, "目标岗位不能为空").max(100, "目标岗位最多 100 字"),
  // 面试类型(场次快照)
  interviewType: interviewTypeSchema,
  // 逐题作答摘要:仅含已评估题(未答/未评估题不计入,允许提前结束);answer 由管线截断 800 字
  summary: z
    .array(
      z.object({
        type: interviewQuestionTypeSchema,
        question: z.string().min(1, "题干不能为空").max(300, "题干最多 300 字"),
        answer: z.string().min(1, "回答不能为空").max(800, "回答最多 800 字"),
        contentScore: z.number().int().min(1, "内容评分最低 1 分").max(10, "内容评分最高 10 分"),
        expressionScore: z.number().int().min(1, "表达评分最低 1 分").max(10, "表达评分最高 10 分"),
      })
    )
    .min(1, "至少 1 条作答摘要")
    .max(15, "作答摘要最多 15 条"),
});
export type InterviewReportAgentInput = z.infer<typeof interviewReportAgentInputSchema>;

export class InterviewReportAgent extends BaseAgent<InterviewReportAgentInput, InterviewReport> {
  readonly config = {
    name: "interview-report-agent",
    description: "模拟面试综合报告:总体评价/突出优势/主要短板/1-2 个重点改进方向(agent-design 2.6)",
    promptPath: "interview/report.md",
    inputSchema: interviewReportAgentInputSchema,
    outputSchema: interviewReportSchema,
    // 综合诊断需要确定性与可复现(同一作答记录两次生成的结论应稳定)
    temperature: 0,
  };

  buildMessages(input: InterviewReportAgentInput, context: AgentContext): ChatMessage[] {
    void context;
    return [
      {
        role: "user",
        content: JSON.stringify(
          {
            targetPosition: input.targetPosition,
            interviewType: input.interviewType,
            summary: input.summary,
          },
          null,
          2
        ),
      },
    ];
  }
}

export const interviewReportAgent = new InterviewReportAgent();
