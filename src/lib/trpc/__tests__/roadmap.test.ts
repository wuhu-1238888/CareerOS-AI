// @vitest-environment node
// 路线图数据层接口测试(3.1,真实写库):roadmap/stage/task 三层 CRUD、任务三态、越权隔离、未登录拒绝
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `roadmap-a-${suffix}@test.local`;
const emailB = `roadmap-b-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;
let roadmapId: string;

function caller(sessionUserId: string | null) {
  return createCaller({
    session: sessionUserId
      ? { user: { id: sessionUserId, email: "x@y.z", name: "甲" }, expires: "2030-01-01T00:00:00.000Z" }
      : null,
    prisma,
  });
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const userA = await prisma.user.create({
    data: { email: emailA, name: "路线A", passwordHash, authMethod: "password" },
  });
  const userB = await prisma.user.create({
    data: { email: emailB, name: "路线B", passwordHash, authMethod: "password" },
  });
  userIdA = userA.id;
  userIdB = userB.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("roadmap CRUD(真实写库,顺序执行)", () => {
  it("未创建时 get 返回 null", async () => {
    expect(await caller(userIdA).navigator.roadmap.get()).toBeNull();
  });

  it("create:创建空路线图并落库(属主 userId,无画像时 profileId 为空)", async () => {
    const row = await caller(userIdA).navigator.roadmap.create({
      targetDirection: "后端开发",
      weeklyHours: 10,
      currentStage: "有一定基础",
    });
    roadmapId = row.id;
    const dbRow = await prisma.roadmap.findUnique({ where: { id: row.id } });
    expect(dbRow?.userId).toBe(userIdA);
    expect(dbRow?.profileId).toBeNull();
    expect(dbRow?.weeklyHours).toBe(10);
    expect(dbRow?.currentStage).toBe("有一定基础");
  });

  it("create:输入校验(空方向/周时 0/周时 81)→ BAD_REQUEST", async () => {
    await expect(
      caller(userIdA).navigator.roadmap.create({ targetDirection: "" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(userIdA).navigator.roadmap.create({ targetDirection: "后端", weeklyHours: 0 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(userIdA).navigator.roadmap.create({ targetDirection: "后端", weeklyHours: 81 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("stage.create:追加阶段 order 自动递增(1 → 2),显式字段落库", async () => {
    const s1 = await caller(userIdA).navigator.stage.create({
      roadmapId,
      name: "夯实基础",
      goal: "掌握编程基础",
    });
    expect(s1.order).toBe(1);
    const s2 = await caller(userIdA).navigator.stage.create({
      roadmapId,
      name: "框架进阶",
      goal: "掌握 Web 框架",
      estimatedDuration: "3 周",
      content: { learningContent: ["React"] },
    });
    expect(s2.order).toBe(2);
  });

  it("task.create:追加任务 order 自动递增,默认 pending", async () => {
    const get = await caller(userIdA).navigator.roadmap.get();
    const stageId = get!.stages[0]!.id;
    const t1 = await caller(userIdA).navigator.task.create({
      stageId,
      description: "学习 TS 类型系统",
      type: "学习",
    });
    expect(t1.order).toBe(1);
    const t2 = await caller(userIdA).navigator.task.create({
      stageId,
      description: "完成 TS 小项目",
      type: "实践项目",
    });
    expect(t2.order).toBe(2);
    const after = await caller(userIdA).navigator.roadmap.get();
    expect(after!.stages[0]!.tasks.map((t) => t.status)).toEqual(["pending", "pending"]);
  });

  it("task.updateStatus:三态切换可撤销;非法状态 → BAD_REQUEST", async () => {
    const get = await caller(userIdA).navigator.roadmap.get();
    const taskId = get!.stages[0]!.tasks[0]!.id;
    expect(
      (await caller(userIdA).navigator.task.updateStatus({ taskId, status: "in_progress" })).status
    ).toBe("in_progress");
    expect(
      (await caller(userIdA).navigator.task.updateStatus({ taskId, status: "completed" })).status
    ).toBe("completed");
    // 可撤销:已完成 → 待开始
    expect(
      (await caller(userIdA).navigator.task.updateStatus({ taskId, status: "pending" })).status
    ).toBe("pending");
    await expect(
      caller(userIdA).navigator.task.updateStatus({ taskId, status: "done" as never })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("get:完整嵌套结构按 order 升序,字段完整", async () => {
    const get = await caller(userIdA).navigator.roadmap.get();
    expect(get?.targetDirection).toBe("后端开发");
    expect(get?.weeklyHours).toBe(10);
    expect(get?.currentStage).toBe("有一定基础");
    expect(get?.stages.map((s) => s.order)).toEqual([1, 2]);
    expect(get?.stages[0]?.name).toBe("夯实基础");
    expect(get?.stages[0]?.content).toEqual({});
    expect(get?.stages[1]?.estimatedDuration).toBe("3 周");
    expect(get?.stages[1]?.content).toEqual({ learningContent: ["React"] });
    expect(get?.stages[1]?.tasks).toHaveLength(0);
    expect(get?.stages[0]?.tasks.map((t) => t.type)).toEqual(["学习", "实践项目"]);
  });

  it("越权:他人追加阶段/追加任务/改状态 → NOT_FOUND(不泄露存在性)", async () => {
    const get = await caller(userIdA).navigator.roadmap.get();
    const stageId = get!.stages[0]!.id;
    const taskId = get!.stages[0]!.tasks[0]!.id;
    await expect(
      caller(userIdB).navigator.stage.create({ roadmapId, name: "偷加", goal: "x" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "路线图不存在" });
    await expect(
      caller(userIdB).navigator.task.create({ stageId, description: "偷加", type: "学习" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "阶段不存在" });
    await expect(
      caller(userIdB).navigator.task.updateStatus({ taskId, status: "completed" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "任务不存在" });
  });

  it("隔离:userB 创建自己的路线图,与 userA 互不影响", async () => {
    const rowB = await caller(userIdB).navigator.roadmap.create({ targetDirection: "数据分析" });
    const getB = await caller(userIdB).navigator.roadmap.get();
    expect(getB?.id).toBe(rowB.id);
    expect(getB?.targetDirection).toBe("数据分析");
    const getA = await caller(userIdA).navigator.roadmap.get();
    expect(getA?.targetDirection).toBe("后端开发");
  });

  it("未登录:全部入口 → UNAUTHORIZED", async () => {
    await expect(caller(null).navigator.roadmap.get()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(
      caller(null).navigator.roadmap.create({ targetDirection: "x" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).navigator.stage.create({ roadmapId: "x", name: "x", goal: "x" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).navigator.task.create({ stageId: "x", description: "x", type: "x" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).navigator.task.updateStatus({ taskId: "x", status: "pending" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
