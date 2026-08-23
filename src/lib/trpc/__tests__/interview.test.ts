// @vitest-environment node
// 模拟面试数据层接口测试(7.1,真实写库):get 序列化防御、start 无简历/输入校验、
// start 成功路径(mock 出题,题数 echo 通过)、retry 越权隔离、latestRun。
// (7.2 submitAnswer/evaluate/submitFollowUp/skipFollowUp、7.3 finish 在后续 commit 扩展)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";
import { interviewSamples } from "@/lib/agents/__tests__/interview-samples";

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
