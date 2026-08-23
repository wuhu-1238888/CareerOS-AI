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
  InterviewEvaluation,
  InterviewType,
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

// ── 答题评估与追问管线(7.2)──────────────────────────────────────────

export type RunEvaluateAnswerOutcome =
  | { ok: true; runId: string }
  | { ok: false; error: string; runId: string };

// 读取场次并防御解析(questions/answers 任一损坏 → null,镜像 get 端点的容错口径)
async function loadInterviewSession(userId: string) {
  const row = await prisma.interviewSession.findUnique({ where: { userId } });
  if (!row) return null;
  const questions = parseStoredQuestions(row.questions);
  const answers = parseStoredAnswers(row.answers);
  if (!questions || !answers) return null;
  return { row, questions, answers };
}

// 评估管线(7.2):提交答案 + 评估当前题。答案先落库(评估失败时保留、evaluation=null,
// 前端显示「重试评估」按钮),再跑评估 Agent;评估成功写回 evaluation + followUpQuestion,
// 无追问 → currentQuestionIndex+1。追问回答不二次评估(由追问管线处理,至多一次)。
export async function runEvaluateAnswer(params: {
  userId: string;
  answer: string;
  /** 测试注入用;缺省走全局 llm */
  adapter?: LLMAdapter;
}): Promise<RunEvaluateAnswerOutcome> {
  const { userId, answer, adapter } = params;

  const loaded = await loadInterviewSession(userId);
  if (!loaded) return { ok: false, error: "面试场次不存在,请重新开始面试", runId: "" };
  const { row, questions, answers } = loaded;
  if (row.status !== "in_progress") return { ok: false, error: "面试已结束,无法继续作答", runId: "" };
  const index = row.currentQuestionIndex;
  const question = questions[index];
  if (!question) return { ok: false, error: "所有题目已答完,请查看综合报告", runId: "" };

  // 该题已有成功评估(说明在等追问回答,或前端状态滞后)→ 拒绝重复提交
  const existing = answers.find((a) => a.questionId === question.id);
  if (existing?.evaluation) {
    return { ok: false, error: "该题已评估,请回答追问或进入下一题", runId: "" };
  }

  // 答案先落库(同题重提交 = 覆盖,不产生重复条目;评估失败时答案保留,evaluation 为 null)
  const submittedAnswers: InterviewAnswerItem[] = [
    ...answers.filter((a) => a.questionId !== question.id),
    { questionId: question.id, answer, evaluation: null, followUpQuestion: null, followUpAnswer: null },
  ];
  await prisma.interviewSession.update({
    where: { userId },
    data: { answers: submittedAnswers as unknown as Prisma.InputJsonValue },
  });

  // 答案落库后对当前题跑评估(共用核心;评估失败透传,答案保留)
  return runEvaluationForIndex(userId, index, adapter);
}

// 评估重试(7.2):对当前题的已存答案重跑评估,不重复提交答案。
// evaluate 端点与 retry(评估 intent 重放)共用;仅允许当前题(推进后旧题必有评估)。
export async function evaluateStoredAnswer(params: {
  userId: string;
  questionIndex: number;
  /** 测试注入用;缺省走全局 llm */
  adapter?: LLMAdapter;
}): Promise<RunEvaluateAnswerOutcome> {
  const { userId, questionIndex, adapter } = params;
  const loaded = await loadInterviewSession(userId);
  if (!loaded) return { ok: false, error: "面试场次不存在,请重新开始面试", runId: "" };
  if (questionIndex !== loaded.row.currentQuestionIndex) {
    return { ok: false, error: "只能重试评估当前题目", runId: "" };
  }
  return runEvaluationForIndex(userId, questionIndex, adapter);
}

// 评估核心(7.2):对第 questionIndex 题的已存答案跑评估 Agent(输入 = 场次快照 + 题目 + 答案),
// 成功写回 evaluation + followUpQuestion(无追问 → currentQuestionIndex+1)。
async function runEvaluationForIndex(
  userId: string,
  questionIndex: number,
  adapter?: LLMAdapter
): Promise<RunEvaluateAnswerOutcome> {
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;
  const loaded = await loadInterviewSession(userId);
  if (!loaded) return { ok: false, error: "面试场次不存在,请重新开始面试", runId: "" };
  const { row, questions, answers } = loaded;
  const question = questions[questionIndex];
  if (!question) return { ok: false, error: "题目不存在,请重新开始面试", runId: "" };
  const entry = answers.find((a) => a.questionId === question.id);
  if (!entry) return { ok: false, error: "该题还没有作答记录", runId: "" };
  if (entry.evaluation) return { ok: false, error: "该题已评估,请回答追问或进入下一题", runId: "" };

  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<InterviewEvaluation>({
    intent: "evaluate-interview-answer",
    input: {
      resumeText: row.resumeText.slice(0, 8000),
      targetPosition: row.targetPosition,
      interviewType: row.interviewType as InterviewType,
      question,
      answer: entry.answer.slice(0, 2000),
    },
    context: {},
    userId,
    onRunProgress: (runId, progress: AgentProgress) => {
      progressChain.current = progressChain.current.then(() => appendProgress(runId, progress));
    },
  });
  // 返回前等待进度全部落库(调用方随后查询能看到完整 5 条事件)
  await progressChain.current;

  // 评估失败:答案已落库、evaluation 为 null,前端「重试评估」重跑 evaluate 端点
  if (!outcome.ok) {
    return outcome;
  }

  const evaluation = outcome.result.data;
  await prisma.interviewSession.update({
    where: { userId },
    data: {
      answers: answers.map((a) =>
        a.questionId === question.id
          ? {
              ...a,
              evaluation: {
                contentScore: evaluation.contentScore,
                expressionScore: evaluation.expressionScore,
                improvementSuggestion: evaluation.improvementSuggestion,
              },
              followUpQuestion: evaluation.followUpQuestion,
            }
          : a
      ) as unknown as Prisma.InputJsonValue,
      // 无追问 → 推进到下一题;有追问 → 停在当前题等追问回答/跳过
      ...(evaluation.followUpQuestion === null ? { currentQuestionIndex: questionIndex + 1 } : {}),
    },
  });

  return { ok: true, runId: outcome.runId };
}

export type RunFollowUpAnswerOutcome = { ok: true } | { ok: false; error: string };

// 追问管线(7.2):不触发 LLM。写入当前题追问回答(null = 跳过)→ currentQuestionIndex+1。
// 前置条件:当前题已评估、有追问、追问未回答(至多一次)。
export async function runFollowUpAnswer(params: {
  userId: string;
  followUpAnswer: string | null;
}): Promise<RunFollowUpAnswerOutcome> {
  const { userId, followUpAnswer } = params;
  const loaded = await loadInterviewSession(userId);
  if (!loaded) return { ok: false, error: "面试场次不存在,请重新开始面试" };
  const { row, questions, answers } = loaded;
  if (row.status !== "in_progress") return { ok: false, error: "面试已结束,无法继续作答" };
  const question = questions[row.currentQuestionIndex];
  if (!question) return { ok: false, error: "所有题目已答完,请查看综合报告" };
  const entry = answers.find((a) => a.questionId === question.id);
  if (!entry || !entry.evaluation) return { ok: false, error: "当前题目尚未评估,无法回答追问" };
  if (!entry.followUpQuestion) return { ok: false, error: "当前题目没有待回答的追问" };
  if (entry.followUpAnswer !== null) return { ok: false, error: "追问已回答,请继续下一题" };

  await prisma.interviewSession.update({
    where: { userId },
    data: {
      answers: answers.map((a) =>
        a.questionId === question.id ? { ...a, followUpAnswer } : a
      ) as unknown as Prisma.InputJsonValue,
      currentQuestionIndex: row.currentQuestionIndex + 1,
    },
  });
  return { ok: true };
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
