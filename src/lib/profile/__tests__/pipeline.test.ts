// @vitest-environment node
// 分析管线测试(2.4,真实写库):成功 → 新版本 + 方向重建 + AgentRun succeeded(含 5 条进度事件);
// 纠偏重算 → version+1、parentVersion 正确、旧版本不可变;非法输出 → 友好错误 + failed + 不落画像行。
// router 层仅测护栏(越权/输入边界/未登录),成功路径与管线共用同一 analyzeProfile 实现。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { MockAdapter } from "@/lib/llm/mock";
import { prisma } from "@/lib/db/prisma";
import { analyzeProfile } from "../pipeline";
import { profileSamples } from "@/lib/agents/__tests__/profile-samples";
import { createCaller } from "@/lib/trpc/router";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `pipeline-a-${suffix}@test.local`;
const emailB = `pipeline-b-${suffix}@test.local`;
const emailC = `pipeline-c-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;
let userIdC: string;
// 首个成功版本的 id/runId(供后续用例断言 parentVersion 与 run 状态)
let firstProfileId = "";
let firstRunId = "";

function caller(sessionUserId: string | null) {
  return createCaller({
    session: sessionUserId
      ? { user: { id: sessionUserId, email: "x@y.z", name: "甲" }, expires: "2030-01-01T00:00:00.000Z" }
      : null,
    prisma,
  });
}

const cs = profileSamples.find((s) => s.id === "cs-grad")!;
const ops = profileSamples.find((s) => s.id === "liberal-to-ops")!;

function mockAdapterFor(sample: (typeof profileSamples)[number]) {
  return new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b, c] = await Promise.all(
    [emailA, emailB, emailC].map((email) =>
      prisma.user.create({ data: { email, name: "管线", passwordHash, authMethod: "password" } })
    )
  );
  userIdA = a.id;
  userIdB = b.id;
  userIdC = c.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("analyzeProfile 管线(真实写库,顺序执行)", () => {
  it("成功:version=1 画像 + 方向重建(匹配度降序)+ AgentRun succeeded 含 5 条进度事件", async () => {
    const outcome = await analyzeProfile({
      userId: userIdA,
      data: cs.input,
      adapter: mockAdapterFor(cs),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    firstProfileId = outcome.profileId;
    firstRunId = outcome.runId;
    expect(outcome.version).toBe(1);

    const row = await prisma.careerProfile.findUnique({ where: { id: outcome.profileId } });
    expect(row?.version).toBe(1);
    expect(row?.parentVersion).toBeNull();
    expect(row?.aiAnalysis).toMatchObject({ summary: cs.mockOutput.summary });

    const paths = await prisma.careerPath.findMany({
      where: { profileId: outcome.profileId },
      orderBy: { matchScore: "desc" },
    });
    expect(paths.map((p) => p.matchScore)).toEqual([85, 70]);
    expect(paths[0]?.directionName).toBe("后端开发");
    expect(paths[0]?.strengths).toMatchObject({ 0: "Python 熟练" });

    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.error).toBeNull();
    const progress = run?.progress as { stage: string; message: string }[];
    expect(progress).toHaveLength(5);
    expect(progress.map((p) => p.stage)).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });

  it("纠偏重算:version=2、parentVersion=上一版本 id、旧版本不可变、方向整体重建", async () => {
    const outcome = await analyzeProfile({
      userId: userIdA,
      data: ops.input,
      feedback: { areas: ["direction"], note: "推荐方向不够准确" },
      adapter: mockAdapterFor(ops),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    expect(outcome.version).toBe(2);

    const row = await prisma.careerProfile.findUnique({ where: { id: outcome.profileId } });
    expect(row?.parentVersion).toBe(1);
    expect(row?.aiAnalysis).toMatchObject({ summary: ops.mockOutput.summary });

    // 旧版本不可变:分析与方向都保持首次结果
    const old = await prisma.careerProfile.findUnique({ where: { id: firstProfileId } });
    expect(old?.aiAnalysis).toMatchObject({ summary: cs.mockOutput.summary });
    const oldPaths = await prisma.careerPath.findMany({ where: { profileId: firstProfileId } });
    expect(oldPaths.map((p) => p.matchScore)).toEqual([85, 70]);

    // 新版本方向整体重建
    const paths = await prisma.careerPath.findMany({
      where: { profileId: outcome.profileId },
      orderBy: { matchScore: "desc" },
    });
    expect(paths.map((p) => p.directionName)).toEqual(["新媒体运营", "内容策划"]);

    // 纠偏反馈随输入落库
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.input).toMatchObject({ feedback: { areas: ["direction"] } });
  });

  it("非法输出:ok=false 友好错误 + AgentRun failed + 不创建画像行", async () => {
    const junk = new MockAdapter(0, () => "这不是 JSON");
    const outcome = await analyzeProfile({ userId: userIdB, data: cs.input, adapter: junk });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("AI 返回了无法识别的结果,请稍后重试");

    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("failed");
    expect(run?.error).toBe(outcome.error);
    expect(await prisma.careerProfile.findMany({ where: { userId: userIdB } })).toHaveLength(0);
  });
});

describe("profile.analyze / retry / getRun / latestRun 护栏(router 层)", () => {
  it("analyze:未登录 → UNAUTHORIZED;非法输入 → BAD_REQUEST", async () => {
    await expect(caller(null).profile.analyze(cs.input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller(userIdC).profile.analyze({ ...cs.input, skills: [] })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("getRun:本人可读成功 run 的进度;他人 → NOT_FOUND", async () => {
    const own = await caller(userIdA).profile.getRun({ runId: firstRunId });
    expect(own.status).toBe("succeeded");
    expect(own.progress).toHaveLength(5);
    await expect(caller(userIdC).profile.getRun({ runId: firstRunId })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "分析任务不存在",
    });
  });

  it("latestRun:返回最近一次 analyze-profile run;从未分析 → null", async () => {
    const latest = await caller(userIdA).profile.latestRun();
    expect(latest?.status).toBe("succeeded");
    expect(latest?.progress).toHaveLength(5);
    expect(await caller(userIdC).profile.latestRun()).toBeNull();
  });

  it("retry:runId 不存在 → NOT_FOUND;他人 run → NOT_FOUND;非法 input → BAD_REQUEST", async () => {
    await expect(caller(userIdA).profile.retry({ runId: "nonexistent" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller(userIdC).profile.retry({ runId: firstRunId })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "分析任务不存在",
    });
    const garbage = await prisma.agentRun.create({
      data: {
        agentName: "career-profile-analyzer",
        intent: "analyze-profile",
        userId: userIdC,
        status: "failed",
        input: { not: "a valid profile input" },
      },
    });
    await expect(caller(userIdC).profile.retry({ runId: garbage.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "无法重试该任务,请重新填写",
    });
  });
});
