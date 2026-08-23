// 模拟面试管线(7.1 起):出题/评估/追问/报告四条管线,InterviewSession 每用户一行按列 upsert
// (prisma/schema.prisma 偏差 6;镜像 JobMatch 先例)。对话消息为派生数据——questions/answers/report
// 均存单行 JSON 列,不建消息表。
// 落库前双重校验(镜像 coach 管线):出题管线 echo 交叉校验(输出题数 ≠ 档位 → ok:false 不落库);
// 评估失败时答案先落库、evaluation 置 null(前端「重试评估」)。
import { Prisma } from "@prisma/client";
import { Orchestrator, orchestrator } from "@/lib/orchestration/orchestrator";
import { prisma } from "@/lib/db/prisma";
import type { LLMAdapter } from "@/lib/llm/adapter";
import type { AgentProgress } from "@/lib/agents/types";
import {
  interviewAnswersSchema,
  interviewQuestionsSchema,
} from "@/lib/interview/analysis-schemas";
import type {
  InterviewQuestions,
  InterviewAnswerItem,
} from "@/lib/interview/analysis-schemas";
import type { InterviewQuestionAgentInput } from "@/lib/agents/interview-question.agent";
import "@/lib/agents"; // 副作用:登记模拟面试出题 Agent(intent: generate-interview-questions)

export type RunInterviewQuestionsOutcome =
  | { ok: true; runId: string; questions: InterviewQuestions }
  | { ok: false; error: string; runId: string };

// 出题管线(7.1):简历 + 岗位 + 面试类型 + 档位 → Orchestrator(出题 Agent)→
// 题数 echo 校验通过后按列 upsert(开场 = 覆盖式新建:重置作答/进度/报告,镜像 JobMatch 按列写)
export async function runInterviewQuestions(params: {
  userId: string;
  input: InterviewQuestionAgentInput;
  /** 测试注入用;缺省走全局 llm(生产经 LLM_PROVIDER 切换) */
  adapter?: LLMAdapter;
}): Promise<RunInterviewQuestionsOutcome> {
  const { userId, input, adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  // 进度写库串行化:生命周期事件同步连发,读-改-写不排队会互相覆盖(丢事件)
  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<InterviewQuestions>({
    intent: "generate-interview-questions",
    input,
    context: {},
    userId,
    onRunProgress: (runId, progress: AgentProgress) => {
      progressChain.current = progressChain.current.then(() => appendProgress(runId, progress));
    },
  });
  // 返回前等待进度全部落库(调用方随后查询能看到完整 5 条事件)
  await progressChain.current;

  if (!outcome.ok) {
    return outcome;
  }

  // Orchestrator 已过 outputSchema 校验;此处做落库前业务校验
  const raw = outcome.result.data;

  // echo 交叉校验:输出题数必须恰好等于所选档位(防模型私自增减题目;不一致不落库,可重试)
  if (raw.questions.length !== input.questionCount) {
    return {
      ok: false,
      error: `AI 输出题目数量(${raw.questions.length} 道)与所选档位(${input.questionCount} 道)不一致,请重试`,
      runId: outcome.runId,
    };
  }

  // 题目落库为数组(不包 {questions} 信封;answers[].questionId 直接指向条目)
  await prisma.interviewSession.upsert({
    where: { userId },
    create: {
      userId,
      interviewType: input.interviewType,
      questionCount: input.questionCount,
      targetPosition: input.targetPosition,
      resumeText: input.resumeText,
      status: "in_progress",
      questions: raw.questions,
      currentQuestionIndex: 0,
      answers: [],
    },
    update: {
      interviewType: input.interviewType,
      questionCount: input.questionCount,
      targetPosition: input.targetPosition,
      resumeText: input.resumeText,
      status: "in_progress",
      questions: raw.questions,
      currentQuestionIndex: 0,
      answers: [],
      report: Prisma.DbNull,
    },
  });

  return { ok: true, runId: outcome.runId, questions: raw };
}

// 解析落库的题目数组(读取方防御解析,损坏 → null;镜像 serializeJobMatch 先例)
export function parseStoredQuestions(value: unknown): InterviewQuestions["questions"] | null {
  const parsed = interviewQuestionsSchema.safeParse({ questions: value });
  return parsed.success ? parsed.data.questions : null;
}

// 解析落库的作答记录数组(读取方防御解析,损坏 → null)
export function parseStoredAnswers(value: unknown): InterviewAnswerItem[] | null {
  const parsed = interviewAnswersSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// 进度追加落库:同一 run 的事件顺序到达,读-改-写安全(唯一写入方为当前管线调用)
async function appendProgress(runId: string, progress: AgentProgress) {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    select: { progress: true },
  });
  const current = Array.isArray(run?.progress)
    ? (run.progress as unknown as AgentProgress[])
    : [];
  await prisma.agentRun.update({
    where: { id: runId },
    data: { progress: [...current, progress] as unknown as Prisma.InputJsonValue },
  });
}
