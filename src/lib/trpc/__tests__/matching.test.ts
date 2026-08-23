// @vitest-environment node
// 岗位匹配/技能教练数据层接口测试(6.2/6.4,真实写库):
// get 序列化防御、coach 前置校验(无报告/报告损坏/输入校验)、retry 越权隔离、correct 前置校验。
// 注:run/coach/retry 的成功路径走真实 LLM 管线,由管线级测试覆盖(agent 样例集 + pipeline.test.ts),
// 本文件只测不触发 LLM 的路径。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";
import { matchingSamples } from "@/lib/agents/__tests__/matching-samples";
import { coachSamples } from "@/lib/agents/__tests__/coach-samples";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `matchingrouter-a-${suffix}@test.local`;
const emailB = `matchingrouter-b-${suffix}@test.local`;

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

const validReport = matchingSamples[0]!.mockOutput;
const validPlan = coachSamples[0]!.mockOutput;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b] = await Promise.all(
    [emailA, emailB].map((email) =>
      prisma.user.create({ data: { email, name: "匹配接口", passwordHash, authMethod: "password" } })
    )
  );
  userIdA = a.id;
  userIdB = b.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("matching 接口(真实写库,顺序执行)", () => {
  it("未登录访问 → UNAUTHORIZED", async () => {
    await expect(caller(null).matching.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).matching.coach({ targetPosition: "后端", weeklyHours: 10 })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("get:从未匹配 → null", async () => {
    expect(await caller(userIdA).matching.get()).toBeNull();
  });

  it("get:合法报告与计划序列化返回(防御解析通过)", async () => {
    await prisma.jobMatch.create({
      data: {
        userId: userIdA,
        jdText: "测试 JD",
        jdTitle: "后端开发工程师",
        matchReport: validReport,
        coachPlan: validPlan,
        weeklyHours: 10,
      },
    });
    const row = await caller(userIdA).matching.get();
    expect(row?.jdTitle).toBe("后端开发工程师");
    expect(row?.weeklyHours).toBe(10);
    // Json 列回读为新对象,用结构化比较
    expect(row?.matchReport).toStrictEqual(validReport);
    expect(row?.coachPlan).toStrictEqual(validPlan);
  });

  it("get:matchReport/coachPlan 损坏 → 各自回退 null(防御解析,6.4 起 coachPlan 完整校验)", async () => {
    await prisma.jobMatch.update({
      where: { userId: userIdA },
      data: { matchReport: { broken: true }, coachPlan: { broken: true } },
    });
    const row = await caller(userIdA).matching.get();
    expect(row?.matchReport).toBeNull();
    expect(row?.coachPlan).toBeNull();
    // 恢复合法数据供后续用例
    await prisma.jobMatch.update({
      where: { userId: userIdA },
      data: { matchReport: validReport, coachPlan: validPlan },
    });
  });

  it("coach:输入校验(空岗位/周时 0/周时 81)→ BAD_REQUEST", async () => {
    await expect(caller(userIdA).matching.coach({ targetPosition: "", weeklyHours: 10 })).rejects.toMatchObject(
      { code: "BAD_REQUEST" }
    );
    await expect(
      caller(userIdA).matching.coach({ targetPosition: "后端", weeklyHours: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(userIdA).matching.coach({ targetPosition: "后端", weeklyHours: 81 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("coach:无匹配报告 → BAD_REQUEST「请先完成岗位匹配」", async () => {
    await expect(
      caller(userIdB).matching.coach({ targetPosition: "后端", weeklyHours: 10 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "请先完成岗位匹配" });
  });

  it("coach:匹配报告损坏 → BAD_REQUEST「匹配报告已失效,请重新匹配」", async () => {
    await prisma.jobMatch.create({
      data: { userId: userIdB, jdText: "测试 JD", matchReport: { broken: true } },
    });
    await expect(
      caller(userIdB).matching.coach({ targetPosition: "后端", weeklyHours: 10 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "匹配报告已失效,请重新匹配" });
  });

  it("correct:无匹配记录 → NOT_FOUND「请先完成岗位匹配」", async () => {
    // userB 有行但无 jdText 之外的有效报告;先删行验证无行路径
    await prisma.jobMatch.delete({ where: { userId: userIdB } });
    await expect(
      caller(userIdB).matching.correct({ requirementId: "req-1", note: "我满足这项" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "请先完成岗位匹配" });
  });

  it("correct:requirementId 不在当前报告 → BAD_REQUEST「该岗位要求已失效,请重新匹配」", async () => {
    await expect(
      caller(userIdA).matching.correct({ requirementId: "req-999", note: "我满足这项" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "该岗位要求已失效,请重新匹配" });
  });

  it("retry:他人 run → NOT_FOUND(越权隔离)", async () => {
    const foreignRun = await prisma.agentRun.create({
      data: {
        userId: userIdB,
        agentName: "job-matching-agent",
        intent: "analyze-match",
        status: "failed",
        input: { jdText: "x" },
      },
    });
    await expect(caller(userIdA).matching.retry({ runId: foreignRun.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller(null).matching.retry({ runId: foreignRun.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
