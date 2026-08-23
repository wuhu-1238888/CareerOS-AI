// @vitest-environment node
// 模拟面试管线测试(7.1/7.2,真实写库):开场覆盖式 upsert + 题数 echo 交叉校验 + 失败不落行;
// 7.2 评估管线(答案先落库/有追问停题/失败保留答案可重试)+ 追问管线(不触发 LLM/跳过)。
// (7.3 报告管线测试在 Commit 3 扩展)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { MockAdapter } from "@/lib/llm/mock";
import { prisma } from "@/lib/db/prisma";
import { runInterviewQuestions, runEvaluateAnswer, evaluateStoredAnswer, runFollowUpAnswer } from "../pipeline";
import { interviewQuestionsSchema } from "@/lib/interview/analysis-schemas";
import type { InterviewAnswerItem } from "@/lib/interview/analysis-schemas";
import { interviewSamples } from "@/lib/agents/__tests__/interview-samples";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `interviewpipeline-a-${suffix}@test.local`;
const emailB = `interviewpipeline-b-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;

const backend5 = interviewSamples.find((s) => s.id === "backend-behavioral-5")!;
const backend10 = interviewSamples.find((s) => s.id === "backend-technical-10")!;

function mockAdapterFor(sample: (typeof interviewSamples)[number]) {
  return new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b] = await Promise.all(
    [emailA, emailB].map((email) =>
      prisma.user.create({ data: { email, name: "面试管线", passwordHash, authMethod: "password" } })
    )
  );
  userIdA = a.id;
  userIdB = b.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("runInterviewQuestions 管线(真实写库,顺序执行)", () => {
  it("成功:InterviewSession 落库(场次快照 + 题目数组)+ AgentRun succeeded 含 5 条进度", async () => {
    const outcome = await runInterviewQuestions({
      userId: userIdA,
      input: backend5.input,
      adapter: mockAdapterFor(backend5),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.interviewType).toBe("行为面");
    expect(row?.questionCount).toBe(5);
    expect(row?.targetPosition).toBe("后端开发工程师");
    expect(row?.resumeText).toBe(backend5.input.resumeText);
    expect(row?.status).toBe("in_progress");
    expect(row?.currentQuestionIndex).toBe(0);
    expect(row?.answers).toStrictEqual([]);
    expect(row?.report).toBeNull();
    // questions 为数组(不包 {questions} 信封),可经输出 Schema 防御解析回读
    const parsed = interviewQuestionsSchema.safeParse({ questions: row?.questions });
    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.questions.length : 0).toBe(5);

    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.intent).toBe("generate-interview-questions");
    const progress = run?.progress as { stage: string }[];
    expect(progress).toHaveLength(5);
    expect(progress.map((p) => p.stage)).toEqual(["start", "prompt", "llm", "parse", "done"]);
    // 输入含简历/岗位/档位(重试从 run.input 重放依赖)
    expect(run?.input).toMatchObject({ targetPosition: "后端开发工程师", questionCount: 5 });
    expect((run?.input as { resumeText: string }).resumeText).toContain("Python");
  });

  it("题数 echo 交叉校验:10 档只输出 5 道 → ok:false 不落库(既有行不变)", async () => {
    // userB 先成功开场 5 题,再用「10 档 + 5 题输出」跑一次:echo 不符,行必须保持原样
    const first = await runInterviewQuestions({
      userId: userIdB,
      input: backend5.input,
      adapter: mockAdapterFor(backend5),
    });
    expect(first.ok).toBe(true);
    const before = await prisma.interviewSession.findUnique({ where: { userId: userIdB } });

    const shortOutput = new MockAdapter(0, () =>
      JSON.stringify({ questions: backend10.mockOutput.questions.slice(0, 5) })
    );
    const outcome = await runInterviewQuestions({
      userId: userIdB,
      input: { ...backend10.input, resumeText: backend10.input.resumeText },
      adapter: shortOutput,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toContain("不一致");

    const after = await prisma.interviewSession.findUnique({ where: { userId: userIdB } });
    expect(after?.questionCount).toBe(before?.questionCount);
    expect(after?.questions).toStrictEqual(before?.questions);
    expect(after?.updatedAt).toEqual(before?.updatedAt);
  });

  it("重新开场:覆盖式新建,重置作答/进度/报告(单行模型,answers 清空)", async () => {
    // userA 已有场次:手工预置一条作答与进度,再跑 10 题技术面 → 全部重置
    await prisma.interviewSession.update({
      where: { userId: userIdA },
      data: {
        currentQuestionIndex: 3,
        answers: [
          { questionId: "q-1", answer: "旧作答", evaluation: null, followUpQuestion: null, followUpAnswer: null },
        ],
        report: { overallEvaluation: "旧报告" },
      },
    });
    const outcome = await runInterviewQuestions({
      userId: userIdA,
      input: backend10.input,
      adapter: mockAdapterFor(backend10),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.interviewType).toBe("技术面");
    expect(row?.questionCount).toBe(10);
    expect(row?.status).toBe("in_progress");
    expect(row?.currentQuestionIndex).toBe(0);
    expect(row?.answers).toStrictEqual([]);
    expect(row?.report).toBeNull();
    // 仍只有一行
    const rows = await prisma.interviewSession.findMany({ where: { userId: userIdA } });
    expect(rows).toHaveLength(1);
  });

  it("失败不落行:ok=false 友好错误 + AgentRun failed + 已有行不变", async () => {
    const junk = new MockAdapter(0, () => "这不是 JSON");
    const before = await prisma.interviewSession.findUnique({ where: { userId: userIdB } });
    const outcome = await runInterviewQuestions({
      userId: userIdB,
      input: backend5.input,
      adapter: junk,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("AI 返回了无法识别的结果,请稍后重试");
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("failed");
    const after = await prisma.interviewSession.findUnique({ where: { userId: userIdB } });
    expect(after?.questions).toStrictEqual(before?.questions);
  });
});

describe("runEvaluateAnswer / runFollowUpAnswer 管线(真实写库,顺序执行)", () => {
  const evalJson = (followUpQuestion: string | null) =>
    JSON.stringify({
      contentScore: 8,
      expressionScore: 7,
      improvementSuggestion: "建议补充一个可量化的结果数据。",
      followUpQuestion,
    });

  const answerText = "我在后端实习中负责订单服务接口开发,独立完成了接口设计、MySQL 数据表设计与前后端联调。";

  // 每个用例重开场 5 题行为面(index 0,answers []),保证用例间状态可预测
  async function freshSession(userId: string) {
    const outcome = await runInterviewQuestions({
      userId,
      input: backend5.input,
      adapter: mockAdapterFor(backend5),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
  }

  it("提交答案 + 无追问评估:答案与评估落库、index+1、AgentRun succeeded 含 5 条进度", async () => {
    await freshSession(userIdA);
    const outcome = await runEvaluateAnswer({
      userId: userIdA,
      answer: answerText,
      adapter: new MockAdapter(0, () => evalJson(null)),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.currentQuestionIndex).toBe(1);
    const answers = row?.answers as InterviewAnswerItem[];
    expect(answers).toHaveLength(1);
    expect(answers[0]?.questionId).toBe("q-1");
    expect(answers[0]?.answer).toBe(answerText);
    expect(answers[0]?.evaluation).toMatchObject({ contentScore: 8, expressionScore: 7 });
    expect(answers[0]?.followUpQuestion).toBeNull();

    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.intent).toBe("evaluate-interview-answer");
    const progress = run?.progress as { stage: string }[];
    expect(progress).toHaveLength(5);
    expect(progress.map((p) => p.stage)).toEqual(["start", "prompt", "llm", "parse", "done"]);
    // 输入含题目快照与回答(评估 retry 重放依赖 question.id 定位)
    expect((run?.input as { question: { id: string } }).question.id).toBe("q-1");
    expect((run?.input as { answer: string }).answer).toBe(answerText);
  });

  it("提交答案 + 有追问评估:index 不变、followUpQuestion 写入、followUpAnswer 为 null", async () => {
    await freshSession(userIdA);
    const followUp = "当时联调中最大的困难是什么?";
    const outcome = await runEvaluateAnswer({
      userId: userIdA,
      answer: answerText,
      adapter: new MockAdapter(0, () => evalJson(followUp)),
    });
    expect(outcome.ok).toBe(true);
    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.currentQuestionIndex).toBe(0);
    const entry = (row?.answers as InterviewAnswerItem[])[0];
    expect(entry?.followUpQuestion).toBe(followUp);
    expect(entry?.followUpAnswer).toBeNull();
  });

  it("评估失败:答案保留、evaluation=null、AgentRun failed(可重试评估)", async () => {
    await freshSession(userIdA);
    const outcome = await runEvaluateAnswer({
      userId: userIdA,
      answer: answerText,
      adapter: new MockAdapter(0, () => "坏 JSON"),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("AI 返回了无法识别的结果,请稍后重试");

    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.currentQuestionIndex).toBe(0);
    const entry = (row?.answers as InterviewAnswerItem[])[0];
    expect(entry?.answer).toBe(answerText);
    expect(entry?.evaluation).toBeNull();
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("failed");
  });

  it("evaluateStoredAnswer:失败后重试成功 → 评估写入 + index+1(不重复提交答案)", async () => {
    await freshSession(userIdA);
    await runEvaluateAnswer({
      userId: userIdA,
      answer: answerText,
      adapter: new MockAdapter(0, () => "坏 JSON"),
    });
    const outcome = await evaluateStoredAnswer({
      userId: userIdA,
      questionIndex: 0,
      adapter: new MockAdapter(0, () => evalJson(null)),
    });
    expect(outcome.ok).toBe(true);
    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.currentQuestionIndex).toBe(1);
    const entry = (row?.answers as InterviewAnswerItem[])[0];
    expect(entry?.evaluation?.contentScore).toBe(8);
    expect(entry?.answer).toBe(answerText);
  });

  it("evaluateStoredAnswer:非当前题 → ok:false「只能重试评估当前题目」", async () => {
    await freshSession(userIdA);
    const outcome = await evaluateStoredAnswer({ userId: userIdA, questionIndex: 2 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toContain("只能重试评估当前题目");
  });

  it("重复提交已评估题(有追问待答时再 submitAnswer)→ ok:false「该题已评估」", async () => {
    await freshSession(userIdA);
    const first = await runEvaluateAnswer({
      userId: userIdA,
      answer: answerText,
      adapter: new MockAdapter(0, () => evalJson("追问?")),
    });
    expect(first.ok).toBe(true);
    const second = await runEvaluateAnswer({
      userId: userIdA,
      answer: "新答案",
      adapter: new MockAdapter(0, () => evalJson(null)),
    });
    expect(second.ok).toBe(false);
    if (second.ok) throw new Error("unreachable");
    expect(second.error).toContain("该题已评估");
  });

  it("追问回答:followUpAnswer 写入 + index+1,且不产生 AgentRun(不触发 LLM)", async () => {
    await freshSession(userIdA);
    await runEvaluateAnswer({
      userId: userIdA,
      answer: answerText,
      adapter: new MockAdapter(0, () => evalJson("追问?")),
    });
    const runsBefore = await prisma.agentRun.count({ where: { userId: userIdA } });
    const followUpAnswer = "当时接口偶发超时,我们加了索引并做了缓存。";
    const outcome = await runFollowUpAnswer({ userId: userIdA, followUpAnswer });
    expect(outcome.ok).toBe(true);
    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.currentQuestionIndex).toBe(1);
    const entry = (row?.answers as InterviewAnswerItem[])[0];
    expect(entry?.followUpAnswer).toBe(followUpAnswer);
    const runsAfter = await prisma.agentRun.count({ where: { userId: userIdA } });
    expect(runsAfter).toBe(runsBefore);
  });

  it("跳过追问(null):followUpAnswer 置 null + index+1", async () => {
    await freshSession(userIdA);
    await runEvaluateAnswer({
      userId: userIdA,
      answer: answerText,
      adapter: new MockAdapter(0, () => evalJson("追问?")),
    });
    const outcome = await runFollowUpAnswer({ userId: userIdA, followUpAnswer: null });
    expect(outcome.ok).toBe(true);
    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.currentQuestionIndex).toBe(1);
    const entry = (row?.answers as InterviewAnswerItem[])[0];
    expect(entry?.followUpAnswer).toBeNull();
  });

  it("前置校验:未评估不能追问;无追问不能重复追问;已结束场次拒绝作答;无场次拒绝", async () => {
    await freshSession(userIdA);

    // 未评估 → 追问被拒
    const noEval = await runFollowUpAnswer({ userId: userIdA, followUpAnswer: null });
    expect(noEval.ok).toBe(false);
    if (noEval.ok) throw new Error("unreachable");
    expect(noEval.error).toContain("尚未评估");

    // 评估无追问 → 已推进到下一题(q-2 未作答)→ 追问被拒「尚未评估」
    await runEvaluateAnswer({
      userId: userIdA,
      answer: answerText,
      adapter: new MockAdapter(0, () => evalJson(null)),
    });
    const nextQuestion = await runFollowUpAnswer({ userId: userIdA, followUpAnswer: "x" });
    expect(nextQuestion.ok).toBe(false);
    if (nextQuestion.ok) throw new Error("unreachable");
    expect(nextQuestion.error).toContain("尚未评估");

    // 已评估但无追问的当前题(手工构造)→ 追问被拒「没有待回答的追问」
    await prisma.interviewSession.update({
      where: { userId: userIdA },
      data: { currentQuestionIndex: 0 },
    });
    const noFollowUp = await runFollowUpAnswer({ userId: userIdA, followUpAnswer: "x" });
    expect(noFollowUp.ok).toBe(false);
    if (noFollowUp.ok) throw new Error("unreachable");
    expect(noFollowUp.error).toContain("没有待回答的追问");

    // 已结束场次 → 评估被拒
    await prisma.interviewSession.update({
      where: { userId: userIdA },
      data: { status: "completed" },
    });
    const ended = await runEvaluateAnswer({
      userId: userIdA,
      answer: "x",
      adapter: new MockAdapter(0, () => evalJson(null)),
    });
    expect(ended.ok).toBe(false);
    if (ended.ok) throw new Error("unreachable");
    expect(ended.error).toContain("面试已结束");

    // 无场次用户 → 被拒
    const noSessionUser = await prisma.user.create({
      data: {
        email: `interviewpipeline-c-${suffix}@test.local`,
        name: "无场次",
        passwordHash: await bcrypt.hash("password-123", 10),
        authMethod: "password",
      },
    });
    const noSession = await runFollowUpAnswer({ userId: noSessionUser.id, followUpAnswer: null });
    expect(noSession.ok).toBe(false);
    if (noSession.ok) throw new Error("unreachable");
    expect(noSession.error).toContain("面试场次不存在");
  });

  it("所有题目已答完(index = 题数)→ 提交被拒「所有题目已答完」", async () => {
    await freshSession(userIdA);
    await prisma.interviewSession.update({
      where: { userId: userIdA },
      data: { currentQuestionIndex: 5 },
    });
    const outcome = await runEvaluateAnswer({
      userId: userIdA,
      answer: "x",
      adapter: new MockAdapter(0, () => evalJson(null)),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toContain("所有题目已答完");
  });
});
