// @vitest-environment node
// 岗位匹配管线测试(6.1,真实写库):按列 upsert(不抹 coachPlan 列)+ 无画像归一化
// + 失败不落行 + 二次匹配覆盖 matchReport。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { MockAdapter } from "@/lib/llm/mock";
import { prisma } from "@/lib/db/prisma";
import { runMatch } from "../pipeline";
import { matchAnalysisSchema } from "../analysis-schemas";
import { matchingSamples } from "@/lib/agents/__tests__/matching-samples";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `matchpipeline-a-${suffix}@test.local`;
const emailB = `matchpipeline-b-${suffix}@test.local`;
const emailC = `matchpipeline-c-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;
let userIdC: string;

const backend = matchingSamples.find((s) => s.id === "backend-with-profile")!;
const noProfile = matchingSamples.find((s) => s.id === "no-profile")!;

function mockAdapterFor(sample: (typeof matchingSamples)[number]) {
  return new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b, c] = await Promise.all(
    [emailA, emailB, emailC].map((email) =>
      prisma.user.create({ data: { email, name: "匹配管线", passwordHash, authMethod: "password" } })
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

describe("runMatch 管线(真实写库,顺序执行)", () => {
  it("成功:JobMatch 按列落库(jdText/jdTitle/matchReport)+ AgentRun succeeded 含 5 条进度", async () => {
    const outcome = await runMatch({
      userId: userIdA,
      jdText: backend.input.jdText,
      profileSummary: backend.input.profileSummary,
      optimizedResumeText: null,
      adapter: mockAdapterFor(backend),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.jobMatch.findUnique({ where: { userId: userIdA } });
    expect(row?.jdText).toBe(backend.input.jdText);
    expect(row?.jdTitle).toBe("后端开发工程师");
    // matchReport 可经输出 Schema 防御解析回读
    expect(matchAnalysisSchema.safeParse(row?.matchReport).success).toBe(true);
    expect((row?.matchReport as { overallScore: number }).overallScore).toBe(78);

    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.intent).toBe("analyze-match");
    const progress = run?.progress as { stage: string }[];
    expect(progress).toHaveLength(5);
    expect(progress.map((p) => p.stage)).toEqual(["start", "prompt", "llm", "parse", "done"]);
    // 输入含 JD 与画像摘要(纠偏重匹配依赖 JD 落库,测试断言见 6.2 router 层)
    expect(run?.input).toMatchObject({ jdText: backend.input.jdText });
    expect((run?.input as { profileSummary: string }).profileSummary).toContain("Python");
  });

  it("按列 upsert:匹配落库不抹掉既有 coachPlan 列(6.3 反方向同理)", async () => {
    // userB 先手工写入一行含 coachPlan(模拟 6.3 管线已执行),再跑匹配
    const presetCoachPlan = { weeklyHours: 5, weeks: [{ week: 1, theme: "x" }] };
    await prisma.jobMatch.create({
      data: { userId: userIdB, jdText: "旧 JD", coachPlan: presetCoachPlan },
    });
    const outcome = await runMatch({
      userId: userIdB,
      jdText: backend.input.jdText,
      profileSummary: backend.input.profileSummary,
      adapter: mockAdapterFor(backend),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.jobMatch.findUnique({ where: { userId: userIdB } });
    expect(row?.jdText).toBe(backend.input.jdText);
    expect(row?.coachPlan).toMatchObject(presetCoachPlan);
  });

  it("二次匹配:matchReport 覆盖为新结果,仍只有一行", async () => {
    const outcome = await runMatch({
      userId: userIdA,
      jdText: backend.input.jdText,
      profileSummary: backend.input.profileSummary,
      adapter: mockAdapterFor(backend),
    });
    expect(outcome.ok).toBe(true);
    const rows = await prisma.jobMatch.findMany({ where: { userId: userIdA } });
    expect(rows).toHaveLength(1);
    expect((rows[0]?.matchReport as { overallScore: number }).overallScore).toBe(78);
  });

  it("无画像归一化:items=[]、overallScore=null、recommendation=null、resumeSuggestions=[]", async () => {
    const outcome = await runMatch({
      userId: userIdC,
      jdText: noProfile.input.jdText,
      profileSummary: null,
      adapter: mockAdapterFor(noProfile),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    // 返回体已归一化
    expect(outcome.analysis.items).toHaveLength(0);
    expect(outcome.analysis.overallScore).toBeNull();
    expect(outcome.analysis.recommendation).toBeNull();
    // 落库同形态 + 拆解仍在
    const row = await prisma.jobMatch.findUnique({ where: { userId: userIdC } });
    const report = row?.matchReport as {
      items: unknown[];
      overallScore: number | null;
      recommendation: unknown;
      requirements: unknown[];
    };
    expect(report.items).toHaveLength(0);
    expect(report.overallScore).toBeNull();
    expect(report.recommendation).toBeNull();
    expect(report.requirements.length).toBeGreaterThan(0);
    expect(row?.jdTitle).toBe("新媒体运营实习生");
  });

  it("失败不落行:ok=false 友好错误 + AgentRun failed + 无 JobMatch 行(更新前已有行不变)", async () => {
    const junk = new MockAdapter(0, () => "这不是 JSON");
    // userB 已有行:失败后 matchReport 不被破坏
    const before = await prisma.jobMatch.findUnique({ where: { userId: userIdB } });
    const outcome = await runMatch({
      userId: userIdB,
      jdText: backend.input.jdText,
      profileSummary: backend.input.profileSummary,
      adapter: junk,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("AI 返回了无法识别的结果,请稍后重试");
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("failed");
    const after = await prisma.jobMatch.findUnique({ where: { userId: userIdB } });
    expect(after?.jdText).toBe(before?.jdText);
    // Json 列回读为新对象,用结构化比较
    expect(after?.matchReport).toStrictEqual(before?.matchReport);
  });
});
