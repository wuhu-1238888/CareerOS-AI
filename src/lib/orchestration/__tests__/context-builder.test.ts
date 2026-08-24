// @vitest-environment node
// 全局上下文派生组装测试(8.1a,真实写库):最新画像版本/推荐方向 + 当前路线图任务进度 +
// 各 Agent 最近成功产出分区(封顶);新用户 → 空分区不抛错。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { buildUserContext, CONTEXT_AGENT_OUTPUT_LIMIT } from "../context-builder";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `ctx-builder-a-${suffix}@test.local`;
const emailB = `ctx-builder-b-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b] = await Promise.all(
    [emailA, emailB].map((email) =>
      prisma.user.create({ data: { email, name: "上下文", passwordHash, authMethod: "password" } })
    )
  );
  userIdA = a.id;
  userIdB = b.id;

  // A 用户:两版画像(v2 活跃)+ 方向 + 路线图(2 任务完成 1/2)+ 4 条成功 run(两 Agent)
  const [profile1, profile2] = await Promise.all([
    prisma.careerProfile.create({
      data: { userId: userIdA, version: 1, parentVersion: null, education: [] },
    }),
    prisma.careerProfile.create({
      data: { userId: userIdA, version: 2, parentVersion: 1, education: [] },
    }),
  ]);
  await prisma.careerPath.createMany({
    data: [
      { profileId: profile2.id, directionName: "后端开发", matchScore: 85, strengths: [], weaknesses: [] },
      { profileId: profile2.id, directionName: "数据分析", matchScore: 70, strengths: [], weaknesses: [] },
      // v1 的方向不参与(只读活跃版本)
      { profileId: profile1.id, directionName: "旧方向", matchScore: 99, strengths: [], weaknesses: [] },
    ],
  });
  const roadmap = await prisma.roadmap.create({
    data: { userId: userIdA, targetDirection: "后端开发", weeklyHours: 8, currentStage: "有一定基础" },
  });
  const stage = await prisma.stage.create({
    data: { roadmapId: roadmap.id, name: "阶段一", goal: "夯实基础", order: 1, content: {} },
  });
  await prisma.task.createMany({
    data: [
      { stageId: stage.id, description: "学习 Python", type: "学习", status: "completed", order: 1, completedAt: new Date() },
      { stageId: stage.id, description: "做项目", type: "实践项目", status: "pending", order: 2 },
    ],
  });
  // 显式递增 createdAt(createMany 同语句内 now() 相同,排序不稳定;真实落库逐次插入毫秒递增)
  const base = Date.now();
  await prisma.agentRun.createMany({
    data: [
      { userId: userIdA, agentName: "career-profile-analyzer", intent: "analyze-profile", status: "succeeded", output: { summary: "v1" }, createdAt: new Date(base) },
      { userId: userIdA, agentName: "career-navigator-agent", intent: "generate-roadmap", status: "succeeded", output: { summary: "路线" }, createdAt: new Date(base + 1000) },
      { userId: userIdA, agentName: "career-profile-analyzer", intent: "analyze-profile", status: "succeeded", output: { summary: "v2" }, createdAt: new Date(base + 2000) },
      { userId: userIdA, agentName: "career-profile-analyzer", intent: "analyze-profile", status: "failed", createdAt: new Date(base + 3000) },
    ],
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("buildUserContext(8.1a,真实写库)", () => {
  it("组装最新画像版本+方向、当前路线图任务进度、各 Agent 产出分区(失败 run 不参与)", async () => {
    const ctx = await buildUserContext(prisma, userIdA, "job-matching-agent");

    expect(ctx.version).toBe("1.0");
    expect(ctx.sourceAgent).toBe("job-matching-agent");
    expect(new Date(ctx.generatedAt).toISOString()).toBe(ctx.generatedAt); // 合法 ISO 时间

    const data = ctx.data as {
      userId: string;
      profile: { version: number; directions: string[] } | null;
      roadmap: { targetDirection: string; currentStage: string | null; completedTasks: number; totalTasks: number } | null;
      agentOutputs: { agentName: string; intent: string | null; output: unknown }[];
    };
    expect(data.userId).toBe(userIdA);

    // 活跃版本 = 最高 version,方向按匹配度降序(v1 旧方向不串入)
    expect(data.profile).toEqual({ version: 2, directions: ["后端开发", "数据分析"] });

    expect(data.roadmap).toEqual({
      targetDirection: "后端开发",
      currentStage: "有一定基础",
      completedTasks: 1,
      totalTasks: 2,
    });

    // 分区:analyzer 2 条(失败不参与)、navigator 1 条;分区内时间降序(最新在前)
    const analyzer = data.agentOutputs.filter((o) => o.agentName === "career-profile-analyzer");
    const navigator = data.agentOutputs.filter((o) => o.agentName === "career-navigator-agent");
    expect(analyzer).toHaveLength(2);
    expect(analyzer.map((o) => o.output)).toEqual([{ summary: "v2" }, { summary: "v1" }]);
    expect(navigator).toHaveLength(1);
    expect(navigator[0]?.intent).toBe("generate-roadmap");
  });

  it("单个 Agent 分区封顶 CONTEXT_AGENT_OUTPUT_LIMIT 条(保留最新)", async () => {
    const base = Date.now();
    await prisma.agentRun.createMany({
      data: Array.from({ length: CONTEXT_AGENT_OUTPUT_LIMIT }, (_, i) => ({
        userId: userIdA,
        agentName: "job-matching-agent",
        intent: "analyze-match",
        status: "succeeded",
        output: { round: i },
        createdAt: new Date(base + i * 1000),
      })),
    });
    const ctx = await buildUserContext(prisma, userIdA, "resume-parse-agent");
    const data = ctx.data as { agentOutputs: { agentName: string; output: unknown }[] };
    const matching = data.agentOutputs.filter((o) => o.agentName === "job-matching-agent");
    expect(matching).toHaveLength(CONTEXT_AGENT_OUTPUT_LIMIT);
    // 最新 3 条 = round 2/1/0
    expect(matching.map((o) => (o.output as { round: number }).round)).toEqual([2, 1, 0]);
  });

  it("新用户(无画像/路线图/run):空分区信封,不抛错", async () => {
    const ctx = await buildUserContext(prisma, userIdB, "career-profile-analyzer");
    const data = ctx.data as { profile: unknown; roadmap: unknown; agentOutputs: unknown[] };
    expect(data.profile).toBeNull();
    expect(data.roadmap).toBeNull();
    expect(data.agentOutputs).toEqual([]);
  });
});
