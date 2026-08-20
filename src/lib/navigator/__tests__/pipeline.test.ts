// @vitest-environment node
// 成长路线生成管线测试(3.4,真实写库):替换式落库(嵌套阶段 + 任务派生 + summary + 画像关联)
// + 无画像生成 + 二次生成替换 + 失败不落行 + 防御解析 + router 层护栏(越权/输入/retry/latestRun intent 隔离)。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { MockAdapter } from "@/lib/llm/mock";
import { prisma } from "@/lib/db/prisma";
import { generateRoadmap, parseStageContent, parseRoadmapSummary } from "../pipeline";
import { navigatorSamples } from "@/lib/agents/__tests__/navigator-samples";
import { createCaller } from "@/lib/trpc/router";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `navpipeline-a-${suffix}@test.local`;
const emailB = `navpipeline-b-${suffix}@test.local`;
const emailC = `navpipeline-c-${suffix}@test.local`;
const emailD = `navpipeline-d-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;
let userIdC: string;
let userIdD: string;
let profileIdA: string;
let firstRunId = "";

function caller(sessionUserId: string | null) {
  return createCaller({
    session: sessionUserId
      ? { user: { id: sessionUserId, email: "x@y.z", name: "甲" }, expires: "2030-01-01T00:00:00.000Z" }
      : null,
    prisma,
  });
}

const backend = navigatorSamples.find((s) => s.id === "backend-slow")!;
const data = navigatorSamples.find((s) => s.id === "data-fast")!;

function mockAdapterFor(sample: (typeof navigatorSamples)[number]) {
  return new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b, c, d] = await Promise.all(
    [emailA, emailB, emailC, emailD].map((email) =>
      prisma.user.create({ data: { email, name: "路线管线", passwordHash, authMethod: "password" } })
    )
  );
  userIdA = a.id;
  userIdB = b.id;
  userIdC = c.id;
  userIdD = d.id;
  // userA 有画像(含能力标签),userB/C 无画像
  const profile = await prisma.careerProfile.create({
    data: {
      userId: userIdA,
      version: 1,
      aiAnalysis: { abilityTags: [{ name: "Python", level: "熟练" }] },
    },
  });
  profileIdA = profile.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("generateRoadmap 管线(真实写库,顺序执行)", () => {
  it("成功:替换式落库(阶段嵌套 + 任务派生 + summary + 关联画像)+ AgentRun succeeded 含 5 条进度", async () => {
    const outcome = await generateRoadmap({
      userId: userIdA,
      input: backend.input,
      abilityTags: [{ name: "Python", level: "熟练" }],
      adapter: mockAdapterFor(backend),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    firstRunId = outcome.runId;

    const roadmap = await prisma.roadmap.findUnique({
      where: { id: outcome.roadmapId },
      include: { stages: { include: { tasks: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } },
    });
    expect(roadmap?.userId).toBe(userIdA);
    expect(roadmap?.profileId).toBe(profileIdA);
    expect(roadmap?.targetDirection).toBe("后端开发");
    expect(roadmap?.weeklyHours).toBe(5);
    expect(roadmap?.currentStage).toBe("有一定基础");
    expect(roadmap?.summary).toMatchObject({ totalDuration: "6 个月", stageCount: 4 });

    // 阶段:order 连续、名称/目标/时长进列、内容进 content Json
    expect(roadmap?.stages.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    const firstStage = roadmap!.stages[0]!;
    expect(firstStage.name).toBe("夯实后端语言基础");
    expect(firstStage.estimatedDuration).toBe("2 个月");
    expect(parseStageContent(firstStage.content)).toMatchObject({
      learningContent: ["Python 进阶语法与标准库", "HTTP 协议与 REST 设计", "数据库原理与 SQL 进阶"],
      practiceProjects: [
        { title: "图书管理 API", deliverable: "可运行的 REST API 服务与接口文档" },
      ],
      resources: ["Python 官方文档", "《计算机网络:自顶向下方法》公开课"],
      checkpoints: ["能解释 HTTP 请求完整生命周期", "能独立设计并实现一个 3 资源 REST API"],
    });

    // 任务派生:学习内容(type 学习)在前,实践项目(type 实践项目,description=标题)在后,默认 pending
    expect(firstStage.tasks.map((t) => t.type)).toEqual(["学习", "学习", "学习", "实践项目"]);
    expect(firstStage.tasks.map((t) => t.order)).toEqual([1, 2, 3, 4]);
    expect(firstStage.tasks.map((t) => t.status)).toEqual(["pending", "pending", "pending", "pending"]);
    expect(firstStage.tasks[3]?.description).toBe("图书管理 API");

    // AgentRun:succeeded + 5 条进度事件 + 输入含方向与能力标签
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.intent).toBe("generate-roadmap");
    const progress = run?.progress as { stage: string }[];
    expect(progress).toHaveLength(5);
    expect(progress.map((p) => p.stage)).toEqual(["start", "prompt", "llm", "parse", "done"]);
    expect(run?.input).toMatchObject({ direction: "后端开发", weeklyHours: 5 });
  });

  it("无画像生成:profileId 为空,输入 abilityTags 为空数组", async () => {
    const outcome = await generateRoadmap({
      userId: userIdB,
      input: data.input,
      adapter: mockAdapterFor(data),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    const roadmap = await prisma.roadmap.findUnique({ where: { id: outcome.roadmapId } });
    expect(roadmap?.profileId).toBeNull();
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.input).toMatchObject({ abilityTags: [] });
  });

  it("二次生成:整体替换(旧路线图删除,仅保留新路线图)", async () => {
    const outcome = await generateRoadmap({
      userId: userIdA,
      input: data.input,
      abilityTags: [{ name: "Python", level: "熟练" }],
      adapter: mockAdapterFor(data),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    const all = await prisma.roadmap.findMany({ where: { userId: userIdA } });
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(outcome.roadmapId);
    const stages = await prisma.stage.findMany({ where: { roadmapId: outcome.roadmapId } });
    expect(stages).toHaveLength(3);
    expect(parseRoadmapSummary(all[0]?.summary)).toMatchObject({ totalDuration: "2 个月" });
  });

  it("失败不落行:ok=false 友好错误 + AgentRun failed + 不创建路线图", async () => {
    const junk = new MockAdapter(0, () => "这不是 JSON");
    const outcome = await generateRoadmap({ userId: userIdC, input: backend.input, adapter: junk });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("AI 返回了无法识别的结果,请稍后重试");
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("failed");
    expect(await prisma.roadmap.findMany({ where: { userId: userIdC } })).toHaveLength(0);
  });

  it("防御解析:content/summary 损坏或缺失 → null", () => {
    expect(parseStageContent(null)).toBeNull();
    expect(parseStageContent({ learningContent: "不是数组" })).toBeNull();
    expect(parseStageContent({ learningContent: [], practiceProjects: [] })).not.toBeNull();
    expect(parseRoadmapSummary(null)).toBeNull();
    expect(parseRoadmapSummary({ totalDuration: "3 个月", stageCount: 2, finalGoal: "x" })).toBeNull();
    expect(parseRoadmapSummary({ totalDuration: "3 个月", stageCount: 3, finalGoal: "x" })).toMatchObject({
      stageCount: 3,
    });
  });
});

describe("navigator.roadmap.generate / retry / latestRun 护栏(router 层)", () => {
  it("generate:未登录 → UNAUTHORIZED;非法输入(周时 0/非法阶段自评)→ BAD_REQUEST", async () => {
    await expect(caller(null).navigator.roadmap.generate(backend.input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller(userIdC).navigator.roadmap.generate({ ...backend.input, weeklyHours: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(userIdC).navigator.roadmap.generate({ ...backend.input, currentStage: "老手" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("latestRun:返回最近一次 generate-roadmap run;与画像 intent 不串台", async () => {
    const latest = await caller(userIdA).navigator.roadmap.latestRun();
    expect(latest?.status).toBe("succeeded");
    expect(latest?.progress).toHaveLength(5);
    // userA 只有 generate-roadmap 的 run,画像 latestRun 应为 null(intent 隔离)
    expect(await caller(userIdA).profile.latestRun()).toBeNull();
    // userC 最近一次是失败 run(失败也落库,供恢复)
    expect((await caller(userIdC).navigator.roadmap.latestRun())?.status).toBe("failed");
    // 从未生成 → null
    expect(await caller(userIdD).navigator.roadmap.latestRun()).toBeNull();
  });

  it("retry:runId 不存在/他人 run → NOT_FOUND;非法 input → BAD_REQUEST", async () => {
    await expect(
      caller(userIdA).navigator.roadmap.retry({ runId: "nonexistent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "生成任务不存在" });
    await expect(
      caller(userIdC).navigator.roadmap.retry({ runId: firstRunId })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "生成任务不存在" });
    const garbage = await prisma.agentRun.create({
      data: {
        agentName: "career-navigator-agent",
        intent: "generate-roadmap",
        userId: userIdC,
        status: "failed",
        input: { not: "a valid generate input" },
      },
    });
    await expect(
      caller(userIdC).navigator.roadmap.retry({ runId: garbage.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "无法重试该任务,请重新填写" });
    // 清理:AgentRun 在删 User 时 SetNull 保留,测试结束后手动删除避免孤儿行
    await prisma.agentRun.delete({ where: { id: garbage.id } });
  });
});
