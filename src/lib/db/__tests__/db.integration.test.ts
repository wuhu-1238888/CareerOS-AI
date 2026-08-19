// @vitest-environment node
// 数据库集成测试(1.3 验证):直接连接本地 PostgreSQL。
// 前置条件:本机 PG 已启动、DATABASE_URL 指向 careeros 库。
// 所有测试数据使用独立随机邮箱,互不干扰;结束后清理。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../prisma";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `it-a-${suffix}@test.local`;
const emailB = `it-b-${suffix}@test.local`;

async function cleanup() {
  // 本文件所有测试数据邮箱均以 `${suffix}@test.local` 结尾,统一清理
  await prisma.user.deleteMany({
    where: { email: { endsWith: `${suffix}@test.local` } },
  });
}

beforeAll(async () => {
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("数据库集成测试(本地 PG)", () => {
  it("User CRUD 往返:创建 / 读回 / 更新", async () => {
    const created = await prisma.user.create({
      data: { email: emailA, name: "测试甲", passwordHash: "hash-a", avatarColor: "green" },
    });
    expect(created.email).toBe(emailA);

    const read = await prisma.user.findUnique({ where: { email: emailA } });
    expect(read?.id).toBe(created.id);
    expect(read?.authMethod).toBe("password");

    const updated = await prisma.user.update({ where: { id: created.id }, data: { name: "测试甲改" } });
    expect(updated.name).toBe("测试甲改");
  });

  it("CareerProfile 版本字段与 JSON 列往返", async () => {
    const user = await prisma.user.create({
      data: { email: emailB, name: "测试乙", passwordHash: "hash-b" },
    });
    const v1 = await prisma.careerProfile.create({
      data: {
        userId: user.id,
        version: 1,
        education: [{ school: "测试大学", major: "计算机" }],
        aiAnalysis: { radar: Array.from({ length: 6 }, (_, i) => ({ dimension: `d${i}`, score: 60 })) },
      },
    });
    const v2 = await prisma.careerProfile.create({
      data: { userId: user.id, version: 2, parentVersion: 1, skills: ["TS"] },
    });
    expect(v1.version).toBe(1);
    expect(v2.parentVersion).toBe(1);

    const all = await prisma.careerProfile.findMany({ where: { userId: user.id }, orderBy: { version: "asc" } });
    expect(all.map((p) => p.version)).toEqual([1, 2]);
    const radar = all[0].aiAnalysis as { radar: unknown[] };
    expect(radar.radar).toHaveLength(6);
  });

  it("Roadmap → Stage → Task 级联链与 Task 三态", async () => {
    const user = await prisma.user.create({
      data: { email: `it-chain-${suffix}@test.local`, name: "级联", passwordHash: "h" },
    });
    const profile = await prisma.careerProfile.create({ data: { userId: user.id } });
    const roadmap = await prisma.roadmap.create({
      data: { profileId: profile.id, targetDirection: "后端", weeklyHours: 8 },
    });
    const stage = await prisma.stage.create({
      data: { roadmapId: roadmap.id, name: "阶段一", goal: "打基础", order: 1 },
    });
    await prisma.task.createMany({
      data: [
        { stageId: stage.id, description: "t1", type: "学习", status: "pending", order: 1 },
        { stageId: stage.id, description: "t2", type: "学习", status: "in_progress", order: 2 },
        { stageId: stage.id, description: "t3", type: "实践项目", status: "completed", order: 3 },
      ],
    });
    const withTasks = await prisma.roadmap.findUnique({
      where: { id: roadmap.id },
      include: { stages: { include: { tasks: true } } },
    });
    const tasks = withTasks?.stages[0].tasks ?? [];
    expect(tasks.map((t) => t.status).sort()).toEqual(["completed", "in_progress", "pending"]);

    // 删 Roadmap → Stage/Task 级联
    await prisma.roadmap.delete({ where: { id: roadmap.id } });
    expect(await prisma.stage.count({ where: { id: stage.id } })).toBe(0);
    expect(await prisma.task.count({ where: { stageId: stage.id } })).toBe(0);

    // 清理
    await prisma.careerProfile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("删除 User:画像/简历级联删除,AgentRun 保留(SetNull)", async () => {
    const user = await prisma.user.create({
      data: { email: `it-cascade-${suffix}@test.local`, name: "级联2", passwordHash: "h" },
    });
    await prisma.careerProfile.create({ data: { userId: user.id } });
    await prisma.resume.create({ data: { userId: user.id, originalText: "简历原文" } });
    const run = await prisma.agentRun.create({
      data: { userId: user.id, agentName: "test-agent", status: "succeeded", durationMs: 10 },
    });

    await prisma.user.delete({ where: { id: user.id } });

    expect(await prisma.careerProfile.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.resume.count({ where: { userId: user.id } })).toBe(0);
    const keptRun = await prisma.agentRun.findUnique({ where: { id: run.id } });
    expect(keptRun).not.toBeNull();
    expect(keptRun?.userId).toBeNull();
    await prisma.agentRun.delete({ where: { id: run.id } });
  });

  it("数据隔离:不同用户的数据互不可见", async () => {
    const userA = await prisma.user.create({ data: { email: `it-iso-a-${suffix}@test.local`, name: "隔离甲", passwordHash: "h" } });
    const userB = await prisma.user.create({ data: { email: `it-iso-b-${suffix}@test.local`, name: "隔离乙", passwordHash: "h" } });
    await prisma.careerProfile.create({
      data: { userId: userA.id, skills: ["React"] },
    });
    await prisma.careerProfile.create({
      data: { userId: userB.id, skills: ["Python"] },
    });

    const onlyA = await prisma.careerProfile.findMany({ where: { userId: userA.id } });
    expect(onlyA).toHaveLength(1);
    expect(onlyA[0].skills).toEqual(["React"]);
  });
});
