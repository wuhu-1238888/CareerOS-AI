// @vitest-environment node
// 模拟面试数据层接口测试(7.1/7.2,真实写库):get 序列化防御、start 无简历/输入校验、
// start 成功路径(mock 出题,题数 echo 通过)、retry 越权隔离、latestRun;
// 7.2 答题四端点(submitAnswer/evaluate/submitFollowUp/skipFollowUp,全局 mock 评估固定 8/7 分,
// 偶数题号给追问)+ retry 评估重放;7.3 finish(无已评估题 BAD_REQUEST/成功/重复结束拒绝)
// + retry 报告重放(按当前场次重组摘要)。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";
import { interviewSamples } from "@/lib/agents/__tests__/interview-samples";
import type { InterviewAnswerItem, InterviewQuestion } from "@/lib/interview/analysis-schemas";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `interviewrouter-a-${suffix}@test.local`;
const emailB = `interviewrouter-b-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;

function caller(sessionUserId: string | null) {
  return createCaller({
    session: sessionUserId
      ? { user: { id: sessionUserId, email: "x@y.z", name: "甲" }, expires: "2030-01-01T00:00:00.000Z" }
      : null,
    prisma,
  });
}

const backend5 = interviewSamples.find((s) => s.id === "backend-behavioral-5")!;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b] = await Promise.all(
    [emailA, emailB].map((email) =>
      prisma.user.create({ data: { email, name: "面试接口", passwordHash, authMethod: "password" } })
    )
  );
  userIdA = a.id;
  userIdB = b.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("interview 接口(真实写库,顺序执行)", () => {
  it("未登录访问 → UNAUTHORIZED", async () => {
    await expect(caller(null).interview.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).interview.start({ interviewType: "行为面", questionCount: 5, targetPosition: "后端" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("get:从未开始 → null", async () => {
    expect(await caller(userIdA).interview.get()).toBeNull();
  });

  it("get:合法场次序列化返回(防御解析通过)", async () => {
    await prisma.interviewSession.create({
      data: {
        userId: userIdA,
        interviewType: "行为面",
        questionCount: 5,
        targetPosition: "后端开发工程师",
        resumeText: backend5.input.resumeText,
        status: "in_progress",
        questions: backend5.mockOutput.questions,
        currentQuestionIndex: 0,
        answers: [],
      },
    });
    const row = await caller(userIdA).interview.get();
    expect(row?.interviewType).toBe("行为面");
    expect(row?.questionCount).toBe(5);
    expect(row?.status).toBe("in_progress");
    expect(row?.currentQuestionIndex).toBe(0);
    // Json 列回读为新对象,用结构化比较
    expect(row?.questions).toStrictEqual(backend5.mockOutput.questions);
    expect(row?.answers).toStrictEqual([]);
    expect(row?.report).toBeNull();
  });

  it("get:questions/answers/report 损坏 → 各自回退 null(防御解析)", async () => {
    await prisma.interviewSession.update({
      where: { userId: userIdA },
      data: { questions: { broken: true }, answers: "坏数据", report: { broken: true } },
    });
    const row = await caller(userIdA).interview.get();
    expect(row?.questions).toBeNull();
    expect(row?.answers).toBeNull();
    expect(row?.report).toBeNull();
    // 恢复合法数据供后续用例
    await prisma.interviewSession.update({
      where: { userId: userIdA },
      data: {
        questions: backend5.mockOutput.questions,
        answers: [],
        report: Prisma.DbNull,
      },
    });
  });

  it("start:输入校验(空岗位/非法面试类型/非法档位)→ BAD_REQUEST", async () => {
    await expect(
      caller(userIdA).interview.start({ interviewType: "行为面", questionCount: 5, targetPosition: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(userIdB).interview.start({
        interviewType: "群面" as never,
        questionCount: 5,
        targetPosition: "后端",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(userIdB).interview.start({
        interviewType: "行为面",
        questionCount: 7 as never,
        targetPosition: "后端",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("start:无简历 → BAD_REQUEST「请先在简历中心上传简历」", async () => {
    await expect(
      caller(userIdB).interview.start({ interviewType: "行为面", questionCount: 5, targetPosition: "后端" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "请先在简历中心上传简历" });
  });

  it("start:成功路径(mock 出题)→ 返回 runId + get 可见新场次,覆盖旧场次", async () => {
    // userA 已有场次(见上),为 A 建简历后 start → 覆盖式新建
    const resume = await prisma.resume.create({
      data: { userId: userIdA, originalText: backend5.input.resumeText, fileName: "简历.txt" },
    });
    await prisma.resumeVersion.create({ data: { resumeId: resume.id, targetDirection: "后端" } });

    const result = await caller(userIdA).interview.start({
      interviewType: "技术面",
      questionCount: 10,
      targetPosition: "后端开发工程师",
    });
    expect(result.runId).toBeTruthy();

    const row = await caller(userIdA).interview.get();
    expect(row?.interviewType).toBe("技术面");
    expect(row?.questionCount).toBe(10);
    expect(row?.questions).toHaveLength(10);
    expect(row?.status).toBe("in_progress");
    expect(row?.answers).toStrictEqual([]);
    expect(row?.report).toBeNull();
  });

  it("retry:他人 run → NOT_FOUND;未登录 → UNAUTHORIZED(越权隔离)", async () => {
    const foreignRun = await prisma.agentRun.create({
      data: {
        userId: userIdB,
        agentName: "interview-question-agent",
        intent: "generate-interview-questions",
        status: "failed",
        input: { resumeText: "x" },
      },
    });
    await expect(caller(userIdA).interview.retry({ runId: foreignRun.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller(null).interview.retry({ runId: foreignRun.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("retry:输入损坏的 run → BAD_REQUEST「无法重试该任务,请重新开始面试」", async () => {
    const brokenRun = await prisma.agentRun.create({
      data: {
        userId: userIdA,
        agentName: "interview-question-agent",
        intent: "generate-interview-questions",
        status: "failed",
        input: { broken: true },
      },
    });
    await expect(caller(userIdA).interview.retry({ runId: brokenRun.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "无法重试该任务,请重新开始面试",
    });
  });

  it("latestRun:按用户隔离,各返回自己的最近一次 run(与 DB 直接查询一致)", async () => {
    // userA 有 start 产生的 succeeded run + retry 用例造的 brokenRun(failed,时间更晚);
    // userB 只有 retry 用例造的 failed run;双方互不可见
    const runsA = await prisma.agentRun.findMany({
      where: { userId: userIdA, intent: "generate-interview-questions" },
      orderBy: { createdAt: "desc" },
    });
    const runsB = await prisma.agentRun.findMany({
      where: { userId: userIdB, intent: "generate-interview-questions" },
      orderBy: { createdAt: "desc" },
    });
    expect(runsA.length).toBeGreaterThanOrEqual(2); // start succeeded + brokenRun failed
    expect(runsA[0]?.status).toBe("failed");
    expect(runsB).toHaveLength(1);

    const runA = await caller(userIdA).interview.latestRun({ intent: "generate-interview-questions" });
    expect(runA?.id).toBe(runsA[0]?.id);
    const runB = await caller(userIdB).interview.latestRun({ intent: "generate-interview-questions" });
    expect(runB?.id).toBe(runsB[0]?.id);
    expect(runB?.id).not.toBe(runA?.id);
  });
});

describe("interview 答题四端点(真实写库,顺序执行;全局 mock 评估固定 8/7 分)", () => {
  // 前置:userA 已有上方 start 用例产生的 10 题技术面场次(index 0,answers []);
  // 全局 mock 评估:偶数题号给追问、奇数题号无追问(推进到下一题)
  const answerA = "我在后端实习中负责订单服务接口开发,独立完成了接口设计与 MySQL 数据表设计,并与前端、测试协作联调,日均请求约 1000 次。";

  it("submitAnswer:q-1(奇数,无追问)评估成功 → 返回序列化场次(index+1,评估 8/7)", async () => {
    const result = await caller(userIdA).interview.submitAnswer({ answer: answerA });
    expect(result?.currentQuestionIndex).toBe(1);
    expect(result?.answers).toHaveLength(1);
    expect(result?.answers?.[0]?.questionId).toBe("q-1");
    expect(result?.answers?.[0]?.evaluation).toMatchObject({ contentScore: 8, expressionScore: 7 });
    expect(result?.answers?.[0]?.followUpQuestion).toBeNull();
    // 与 DB 一致
    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.currentQuestionIndex).toBe(1);
  });

  it("submitAnswer:未开始场次(userB)→ BAD_GATEWAY「面试场次不存在」", async () => {
    await expect(caller(userIdB).interview.submitAnswer({ answer: "你好" })).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: "面试场次不存在,请重新开始面试",
    });
  });

  it("submitAnswer:空白回答 → BAD_REQUEST(输入校验,trim 后为空)", async () => {
    await expect(caller(userIdA).interview.submitAnswer({ answer: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller(userIdA).interview.submitAnswer({ answer: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("submitFollowUp:当前题(q-2)尚未评估 → BAD_GATEWAY「尚未评估」", async () => {
    await expect(
      caller(userIdA).interview.submitFollowUp({ followUpAnswer: "补充回答" })
    ).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: "当前题目尚未评估,无法回答追问",
    });
  });

  it("submitAnswer(q-2 偶数,有追问)→ submitFollowUp 回答后 index+1,追问回答落库", async () => {
    await caller(userIdA).interview.submitAnswer({
      answer: "我在校园二手交易平台后端独立完成商品发布与订单模块,使用 MySQL 存储,日均请求约 1000 次。",
    });
    const followUpAnswer = "当时最大的困难是并发下单导致库存超卖,我通过事务与乐观锁解决。";
    const result = await caller(userIdA).interview.submitFollowUp({ followUpAnswer });
    expect(result?.currentQuestionIndex).toBe(2);
    expect(result?.answers?.[1]?.followUpAnswer).toBe(followUpAnswer);
    expect(result?.answers?.[1]?.evaluation).toMatchObject({ contentScore: 8, expressionScore: 7 });
  });

  it("skipFollowUp:当前题(q-3)未评估 → BAD_GATEWAY(前置校验)", async () => {
    await expect(caller(userIdA).interview.skipFollowUp()).rejects.toMatchObject({
      code: "BAD_GATEWAY",
    });
  });

  it("evaluate:评估失败态(手工预置 null)重试成功 → 评估写入 + index+1(不重复提交答案)", async () => {
    // 手工预置 q-3 已提交答案但评估失败的场次状态
    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    const current = (row?.answers ?? []) as InterviewAnswerItem[];
    const storedAnswer = "SQL 熟练,在实习中为订单模块设计过数据表并配合查询优化。";
    await prisma.interviewSession.update({
      where: { userId: userIdA },
      data: {
        answers: [
          ...current,
          { questionId: "q-3", answer: storedAnswer, evaluation: null, followUpQuestion: null, followUpAnswer: null },
        ] as unknown as Prisma.InputJsonValue,
      },
    });
    const result = await caller(userIdA).interview.evaluate({ questionIndex: 2 });
    expect(result?.currentQuestionIndex).toBe(3);
    expect(result?.answers?.[2]?.evaluation).toMatchObject({ contentScore: 8, expressionScore: 7 });
    expect(result?.answers?.[2]?.answer).toBe(storedAnswer);
  });

  it("evaluate:非当前题 → BAD_GATEWAY「只能重试评估当前题目」", async () => {
    await expect(caller(userIdA).interview.evaluate({ questionIndex: 0 })).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: "只能重试评估当前题目",
    });
  });

  it("latestRun:评估 intent 返回最近评估 run;报告 intent 尚无数据 → null", async () => {
    const run = await caller(userIdA).interview.latestRun({ intent: "evaluate-interview-answer" });
    expect(run?.status).toBe("succeeded");
    const dbRun = await prisma.agentRun.findFirst({
      where: { userId: userIdA, intent: "evaluate-interview-answer" },
      orderBy: { createdAt: "desc" },
    });
    expect(run?.id).toBe(dbRun?.id);
    expect(await caller(userIdA).interview.latestRun({ intent: "generate-interview-report" })).toBeNull();
  });

  it("retry:评估 intent 重放 → 重读 session 该题当前答案重评(q-4 偶数 → 有追问,index 不变)", async () => {
    // 预置 q-4 评估失败态 + 一条 failed 评估 run(input.question.id = q-4)
    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    const current = (row?.answers ?? []) as InterviewAnswerItem[];
    const storedAnswer = "假设订单服务需要支持秒杀,我会先梳理库存扣减与流量削峰方案,再评估缓存与队列改造成本。";
    await prisma.interviewSession.update({
      where: { userId: userIdA },
      data: {
        currentQuestionIndex: 3,
        answers: [
          ...current,
          { questionId: "q-4", answer: storedAnswer, evaluation: null, followUpQuestion: null, followUpAnswer: null },
        ] as unknown as Prisma.InputJsonValue,
      },
    });
    const q4 = (row?.questions as InterviewQuestion[])[3];
    const brokenRun = await prisma.agentRun.create({
      data: {
        userId: userIdA,
        agentName: "interview-answer-evaluator",
        intent: "evaluate-interview-answer",
        status: "failed",
        input: {
          resumeText: row!.resumeText.slice(0, 8000),
          targetPosition: row!.targetPosition,
          interviewType: row!.interviewType,
          question: q4,
          answer: "旧答案(重放时不应被使用)",
        },
      },
    });

    const result = await caller(userIdA).interview.retry({ runId: brokenRun.id });
    expect(result.runId).toBeTruthy();
    expect(result.runId).not.toBe(brokenRun.id);

    const after = await caller(userIdA).interview.get();
    expect(after?.currentQuestionIndex).toBe(3); // q-4 偶数 → 有追问,停题
    expect(after?.answers?.[3]?.evaluation).toMatchObject({ contentScore: 8, expressionScore: 7 });
    expect(after?.answers?.[3]?.followUpQuestion).toBeTruthy();
    expect(after?.answers?.[3]?.answer).toBe(storedAnswer);
  });

  it("retry:评估 intent 输入损坏 → BAD_REQUEST「无法重试该任务」", async () => {
    const brokenRun = await prisma.agentRun.create({
      data: {
        userId: userIdA,
        agentName: "interview-answer-evaluator",
        intent: "evaluate-interview-answer",
        status: "failed",
        input: { broken: true },
      },
    });
    await expect(caller(userIdA).interview.retry({ runId: brokenRun.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "无法重试该任务,请重新开始面试",
    });
  });

  it("未登录 → 答题四端点全部 UNAUTHORIZED", async () => {
    await expect(caller(null).interview.submitAnswer({ answer: "x" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(null).interview.evaluate({ questionIndex: 0 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(null).interview.submitFollowUp({ followUpAnswer: "x" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(null).interview.skipFollowUp()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});

describe("interview finish 与报告 retry(真实写库,顺序执行;全局 mock 报告四要素)", () => {
  it("finish:无已评估题(userB 无场次)→ BAD_REQUEST「至少完成一道题才能生成综合报告」", async () => {
    await expect(caller(userIdB).interview.finish()).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "至少完成一道题才能生成综合报告",
    });
  });

  it("finish:userA 成功(已有 4 题已评估,提前结束)→ 场次 completed + 报告四要素落库", async () => {
    const result = await caller(userIdA).interview.finish();
    expect(result?.status).toBe("completed");
    expect(result?.report).toMatchObject({
      overallEvaluation: expect.stringContaining("Mock 演示数据"),
      strengths: expect.any(Array),
      weaknesses: expect.any(Array),
      keyImprovements: expect.any(Array),
    });
    // 与 DB 一致
    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.status).toBe("completed");
    expect(row?.report).toMatchObject({ overallEvaluation: expect.stringContaining("Mock 演示数据") });
    const run = await prisma.agentRun.findFirst({
      where: { userId: userIdA, intent: "generate-interview-report" },
      orderBy: { createdAt: "desc" },
    });
    expect(run?.status).toBe("succeeded");
  });

  it("finish:已结束场次再次结束 → BAD_GATEWAY「面试已结束」", async () => {
    await expect(caller(userIdA).interview.finish()).rejects.toMatchObject({
      code: "BAD_GATEWAY",
      message: "面试已结束,无法重复生成报告",
    });
  });

  it("finish:未登录 → UNAUTHORIZED", async () => {
    await expect(caller(null).interview.finish()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("retry:报告 intent 重放成功(userB 合法场次)→ 按当前场次重组摘要重跑 + 新 runId", async () => {
    // 为 userB 建 in_progress 场次(1 题已评估)
    await prisma.interviewSession.create({
      data: {
        userId: userIdB,
        interviewType: "行为面",
        questionCount: 5,
        targetPosition: "后端开发工程师",
        resumeText: backend5.input.resumeText,
        status: "in_progress",
        questions: backend5.mockOutput.questions,
        currentQuestionIndex: 1,
        answers: [
          {
            questionId: "q-1",
            answer: "我在后端实习中负责订单服务接口开发,独立完成接口设计与数据表设计。",
            evaluation: { contentScore: 8, expressionScore: 7, improvementSuggestion: "建议补充量化数据。" },
            followUpQuestion: null,
            followUpAnswer: null,
          },
        ],
      },
    });
    const brokenRun = await prisma.agentRun.create({
      data: {
        userId: userIdB,
        agentName: "interview-report-agent",
        intent: "generate-interview-report",
        status: "failed",
        input: {
          targetPosition: "后端开发工程师",
          interviewType: "行为面",
          summary: [
            {
              type: "自我介绍",
              question: "请做一个自我介绍。",
              answer: "旧摘要(重放时不应被使用)",
              contentScore: 8,
              expressionScore: 7,
            },
          ],
        },
      },
    });
    const result = await caller(userIdB).interview.retry({ runId: brokenRun.id });
    expect(result.runId).toBeTruthy();
    expect(result.runId).not.toBe(brokenRun.id);

    const after = await caller(userIdB).interview.get();
    expect(after?.status).toBe("completed");
    expect(after?.report).toMatchObject({ overallEvaluation: expect.stringContaining("Mock 演示数据") });
  });

  it("retry:报告 intent 输入损坏 → BAD_REQUEST「无法重试该任务」", async () => {
    // userB 场次已 completed,重放会先被输入校验拦截(BAD_REQUEST 优先于管线错误)
    const brokenInput = await prisma.agentRun.create({
      data: {
        userId: userIdB,
        agentName: "interview-report-agent",
        intent: "generate-interview-report",
        status: "failed",
        input: { broken: true },
      },
    });
    await expect(caller(userIdB).interview.retry({ runId: brokenInput.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "无法重试该任务,请重新开始面试",
    });
  });

  it("retry:他人报告 run → NOT_FOUND(越权隔离)", async () => {
    const runB = await prisma.agentRun.findFirst({
      where: { userId: userIdB, intent: "generate-interview-report" },
      orderBy: { createdAt: "desc" },
    });
    expect(runB).toBeTruthy();
    await expect(caller(userIdA).interview.retry({ runId: runB!.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("latestRun:报告 intent 返回最近一次报告 run(与 DB 直接查询一致)", async () => {
    const run = await caller(userIdB).interview.latestRun({ intent: "generate-interview-report" });
    const dbRun = await prisma.agentRun.findFirst({
      where: { userId: userIdB, intent: "generate-interview-report" },
      orderBy: { createdAt: "desc" },
    });
    expect(run?.id).toBe(dbRun?.id);
    // 最近一次 = 上个用例造的输入损坏 failed run
    expect(run?.status).toBe(dbRun?.status);
  });
});
