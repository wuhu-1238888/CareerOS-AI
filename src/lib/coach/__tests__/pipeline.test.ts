// @vitest-environment node
// 技能教练管线测试(6.3,真实写库):按列 upsert(不抹 matchReport 列)+ 资源免费前置排序
// + echo 交叉校验不一致不落库 + 失败不落行。
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import bcrypt from "bcryptjs";
import { MockAdapter } from "@/lib/llm/mock";
import { prisma } from "@/lib/db/prisma";
import { runCoachPlan } from "../pipeline";
import { coachPlanSchema } from "../analysis-schemas";
import { coachSamples } from "@/lib/agents/__tests__/coach-samples";
import type { CoachPlan } from "../analysis-schemas";
import * as contextBuilder from "@/lib/orchestration/context-builder";

// 8.1a 接线断言:vi.spyOn 对 ESM 导出不可靠(递归爆栈),用 vi.mock 透传包装记录调用
vi.mock("@/lib/orchestration/context-builder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/orchestration/context-builder")>();
  return { ...actual, buildUserContext: vi.fn(actual.buildUserContext) };
});

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `coachpipeline-a-${suffix}@test.local`;
const emailB = `coachpipeline-b-${suffix}@test.local`;
const emailC = `coachpipeline-c-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;
let userIdC: string;

const backend = coachSamples.find((s) => s.id === "backend-gaps")!;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b, c] = await Promise.all(
    [emailA, emailB, emailC].map((email) =>
      prisma.user.create({ data: { email, name: "教练管线", passwordHash, authMethod: "password" } })
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

describe("runCoachPlan 管线(真实写库,顺序执行)", () => {
  it("成功:JobMatch 按列落库(coachPlan/weeklyHours)+ AgentRun succeeded 含 5 条进度", async () => {
    const outcome = await runCoachPlan({
      userId: userIdA,
      input: backend.input,
      adapter: new MockAdapter(0, () => JSON.stringify(backend.mockOutput)),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.jobMatch.findUnique({ where: { userId: userIdA } });
    expect(row?.weeklyHours).toBe(10);
    // coachPlan 可经输出 Schema 防御解析回读
    expect(coachPlanSchema.safeParse(row?.coachPlan).success).toBe(true);
    expect((row?.coachPlan as CoachPlan).priorityMatrix).toHaveLength(4);
    // 返回体与落库一致
    expect(outcome.plan).toStrictEqual(row?.coachPlan);

    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.intent).toBe("build-coach-plan");
    const progress = run?.progress as { stage: string }[];
    expect(progress).toHaveLength(5);
    expect(progress.map((p) => p.stage)).toEqual(["start", "prompt", "llm", "parse", "done"]);
    // 输入完整透传(重试从 AgentRun.input 重放依赖)
    expect(run?.input).toMatchObject({
      targetPosition: backend.input.targetPosition,
      weeklyHours: backend.input.weeklyHours,
    });
    expect((run?.input as { requirements: unknown[] }).requirements).toHaveLength(4);
  });

  it("按列 upsert:教练落库不抹掉既有 matchReport 列(与 6.1 反方向对称)", async () => {
    // userA 已有行(上个用例写入):手工预置 matchReport 模拟 6.1 管线已执行,再跑教练
    const presetMatchReport = { overallScore: 78, items: [{ requirementId: "req-1" }] };
    await prisma.jobMatch.update({
      where: { userId: userIdA },
      data: { matchReport: presetMatchReport },
    });
    const outcome = await runCoachPlan({
      userId: userIdA,
      input: backend.input,
      adapter: new MockAdapter(0, () => JSON.stringify(backend.mockOutput)),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.jobMatch.findUnique({ where: { userId: userIdA } });
    expect(row?.coachPlan).toBeTruthy();
    expect(row?.matchReport).toStrictEqual(presetMatchReport);
    // 仍只有一行
    expect(await prisma.jobMatch.count({ where: { userId: userIdA } })).toBe(1);
  });

  it("资源免费前置排序:输出中 paid 在前 → 落库后 free 全部排前", async () => {
    // 构造 paid 在最前的输出(顺序:[付费书, 免费 Redis 文档, 免费 RabbitMQ 教程])
    const paidFirst: CoachPlan = {
      ...backend.mockOutput,
      resources: [
        backend.mockOutput.resources[1]!,
        backend.mockOutput.resources[0]!,
        backend.mockOutput.resources[2]!,
      ],
    };
    expect(paidFirst.resources[0]!.cost).toBe("paid"); // 前置条件:paid 确实在最前
    const outcome = await runCoachPlan({
      userId: userIdB,
      input: backend.input,
      adapter: new MockAdapter(0, () => JSON.stringify(paidFirst)),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.jobMatch.findUnique({ where: { userId: userIdB } });
    const resources = (row?.coachPlan as CoachPlan).resources;
    expect(resources.map((r) => r.cost)).toEqual(["free", "free", "paid"]);
    // free 内部保持原相对顺序,paid 排最后
    expect(resources.map((r) => r.title)).toEqual([
      "Redis 官方文档",
      "RabbitMQ 官方教程",
      "《Redis 设计与实现》",
    ]);
  });

  it("echo 交叉校验:输出 weeklyHours ≠ 输入 → ok:false 且不落库(AgentRun 已 succeeded,重试可重放)", async () => {
    const wrongEcho: CoachPlan = { ...backend.mockOutput, weeklyHours: 11 }; // 输入是 10
    const outcome = await runCoachPlan({
      userId: userIdC,
      input: backend.input,
      adapter: new MockAdapter(0, () => JSON.stringify(wrongEcho)),
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("AI 输出与提交的每周投入时间不一致,请重试");

    // 不落库:userC 无 JobMatch 行
    expect(await prisma.jobMatch.findUnique({ where: { userId: userIdC } })).toBeNull();
    // 边缘态(计划风险 4):run 本身 succeeded,input 已存,retry 可从 AgentRun.input 重放
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.intent).toBe("build-coach-plan");
  });

  it("失败不落行:ok=false 友好错误 + AgentRun failed + 已有行 coachPlan 不变", async () => {
    const junk = new MockAdapter(0, () => "这不是 JSON");
    // userB 已有行:失败后 coachPlan 不被破坏
    const before = await prisma.jobMatch.findUnique({ where: { userId: userIdB } });
    const outcome = await runCoachPlan({ userId: userIdB, input: backend.input, adapter: junk });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("AI 返回了无法识别的结果,请稍后重试");
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("failed");
    const after = await prisma.jobMatch.findUnique({ where: { userId: userIdB } });
    // Json 列回读为新对象,用结构化比较
    expect(after?.coachPlan).toStrictEqual(before?.coachPlan);
    expect(after?.weeklyHours).toBe(before?.weeklyHours);
  });
});

describe("全局上下文注入(8.1a)", () => {
  it("build-coach-plan 注入 skill-coach-agent 的派生上下文", async () => {
    const spy = vi.mocked(contextBuilder.buildUserContext);
    spy.mockClear();
    const outcome = await runCoachPlan({
      userId: userIdC,
      input: backend.input,
      adapter: new MockAdapter(0, () => JSON.stringify(backend.mockOutput)),
    });
    expect(outcome.ok).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    // 不整体深比较(prisma 实例对象图过大);逐参数断言
    expect(spy.mock.calls[0]?.[1]).toBe(userIdC);
    expect(spy.mock.calls[0]?.[2]).toBe("skill-coach-agent");
  });
});
