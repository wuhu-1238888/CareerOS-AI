// 模拟面试出题 Agent(7.1):按 agent-design 2.6 ——
// 角色定位「如果我是这个岗位的面试官,看到这份简历,我会问什么」;
// 输入 = 简历文本 + 目标岗位 + 面试类型(行为面/技术面/案例面)+ 场次档位(5/10/15 题)+ 画像摘要(可选),
// 输出 = 个性化题目(自我介绍/经历深挖/技术案例/情景假设/反问五类,每类至少 1 题,按档位补足),每题附追问提示与简历出处。
// 输出 Schema 放 analysis-schemas(客户端安全,7.2 对话界面渲染前校验用);此处转发保持原导入路径。
import { z } from "zod";
import { BaseAgent } from "./base";
import type { AgentContext } from "./types";
import type { ChatMessage } from "@/lib/llm/adapter";
import {
  interviewQuestionsSchema,
  interviewQuestionCountSchema,
  interviewTypeSchema,
} from "@/lib/interview/analysis-schemas";
import type { InterviewQuestions, InterviewQuestionCount, InterviewType } from "@/lib/interview/analysis-schemas";

export { interviewQuestionsSchema, interviewQuestionCountSchema, interviewTypeSchema };
export type { InterviewQuestions, InterviewQuestionCount, InterviewType };

export const interviewQuestionAgentInputSchema = z.object({
  // 简历文本(服务端组装 canonical finalText;无 accepted 时即原文)
  resumeText: z.string().min(1, "简历文本不能为空").max(8000, "简历文本最多 8000 字"),
  // 目标岗位(用户填写;预填岗位匹配 jdTitle 或路线图目标方向)
  targetPosition: z.string().min(1, "目标岗位不能为空").max(100, "目标岗位最多 100 字"),
  // 面试类型(7.1 输入项)
  interviewType: interviewTypeSchema,
  // 场次档位(用户拍板:短 5 / 标准 10 / 完整 15;输出题数由管线层 echo 交叉校验)
  questionCount: interviewQuestionCountSchema,
  // 画像分析摘要(可选,题目个人化补充;无画像用户为 null)
  profileSummary: z.string().min(1).max(3000).nullable().default(null),
});
export type InterviewQuestionAgentInput = z.infer<typeof interviewQuestionAgentInputSchema>;

export class InterviewQuestionAgent extends BaseAgent<InterviewQuestionAgentInput, InterviewQuestions> {
  readonly config = {
    name: "interview-question-agent",
    description: "模拟面试出题:按岗位/简历/面试类型生成个性化面试题与追问提示(agent-design 2.6)",
    promptPath: "interview/question.md",
    inputSchema: interviewQuestionAgentInputSchema,
    outputSchema: interviewQuestionsSchema,
    // 出题需要发散与个性化(agent-design 2.6 温度 0.7);评估/报告 Agent 为 0(确定性评分)
    temperature: 0.7,
  };

  buildMessages(input: InterviewQuestionAgentInput, context: AgentContext): ChatMessage[] {
    // 结构化输入一并交给模型;上下文信封仅作执行间透传,无需注入 Prompt
    void context;
    return [
      {
        role: "user",
        content: JSON.stringify(
          {
            resumeText: input.resumeText,
            targetPosition: input.targetPosition,
            interviewType: input.interviewType,
            questionCount: input.questionCount,
            profileSummary: input.profileSummary,
          },
          null,
          2
        ),
      },
    ];
  }
}

export const interviewQuestionAgent = new InterviewQuestionAgent();
