// 模拟面试答题评估 Agent(7.2):按 agent-design 2.6 ——
// 输入 = 简历文本 + 目标岗位 + 面试类型 + 当前题目(完整对象)+ 用户回答,
// 输出 = 内容评分 1-10 / 表达评分 1-10 / 改进建议 / 追问问题(仅当值得深挖时给出,否则 null)。
// 追问回答不二次评估(管线层保证,至多一次);温度 0(评分需要确定性与可复现)。
import { z } from "zod";
import { BaseAgent } from "./base";
import type { AgentContext } from "./types";
import type { ChatMessage } from "@/lib/llm/adapter";
import {
  interviewEvaluationSchema,
  interviewQuestionSchema,
  interviewTypeSchema,
} from "@/lib/interview/analysis-schemas";
import type { InterviewEvaluation, InterviewQuestion, InterviewType } from "@/lib/interview/analysis-schemas";

export { interviewEvaluationSchema };
export type { InterviewEvaluation, InterviewQuestion, InterviewType };

export const interviewEvaluatorAgentInputSchema = z.object({
  // 简历文本(场次快照,评估上下文;服务端截断 8000 字)
  resumeText: z.string().min(1, "简历文本不能为空").max(8000, "简历文本最多 8000 字"),
  // 目标岗位(场次快照)
  targetPosition: z.string().min(1, "目标岗位不能为空").max(100, "目标岗位最多 100 字"),
  // 面试类型(场次快照)
  interviewType: interviewTypeSchema,
  // 当前题目完整对象(含题干/题型/追问提示/简历出处,供评估对齐)
  question: interviewQuestionSchema,
  // 用户回答(服务端校验 1-2000 字)
  answer: z.string().min(1, "回答不能为空").max(2000, "回答最多 2000 字"),
});
export type InterviewEvaluatorAgentInput = z.infer<typeof interviewEvaluatorAgentInputSchema>;

export class InterviewAnswerEvaluator extends BaseAgent<
  InterviewEvaluatorAgentInput,
  InterviewEvaluation
> {
  readonly config = {
    name: "interview-answer-evaluator",
    description: "模拟面试答题评估:内容/表达双维评分 + 改进建议 + 可选追问(agent-design 2.6)",
    promptPath: "interview/evaluate.md",
    inputSchema: interviewEvaluatorAgentInputSchema,
    outputSchema: interviewEvaluationSchema,
    // 评分与追问判断需要确定性与可复现(同一答案两次评估分差 ≤2 的验证依据)
    temperature: 0,
  };

  buildMessages(input: InterviewEvaluatorAgentInput, context: AgentContext): ChatMessage[] {
    void context;
    return [
      {
        role: "user",
        content: JSON.stringify(
          {
            resumeText: input.resumeText,
            targetPosition: input.targetPosition,
            interviewType: input.interviewType,
            question: input.question,
            answer: input.answer,
          },
          null,
          2
        ),
      },
    ];
  }
}

export const interviewAnswerEvaluator = new InterviewAnswerEvaluator();
