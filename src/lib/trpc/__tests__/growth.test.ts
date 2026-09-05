// @vitest-environment node
// growth 命名空间接口测试(8.2 + 概览化,真实写库):未登录隔离、空数据回退(不报错)、
// block 概览聚合正确、匿名聚合脱敏与样本阈值。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";
import { REPORT_WEEKS } from "@/lib/growth/data";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const mainEmail = `growthrouter-main-${suffix}@test.local`;
const direction = `聚合X-${suffix}`;

let userId: string;
let freshUserId: string;

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
  const main = await prisma.user.create({ data: { email: mainEmail, name: "成长接口" } });
  userId = main.id;
  const fresh = await prisma.user.create({ data: { email: `growthrouter-fresh-${suffix}@test.local`, name: "空用户" } });
  freshUserId = fresh.id;

  // 主用户:画像 v1(无分析)+ 匹配记录 + 本周完成 1 任务
  await prisma.careerProfile.create({ data: { userId, version: 1 } });
  await prisma.jobMatch.create({ data: { userId, matchReport: { overallScore: 72 } } });
  const roadmap = await prisma.roadmap.create({ data: { userId, targetDirection: "后端开发" } });
  const stage = await prisma.stage.create({
    data: { roadmapId: roadmap.id, name: "阶段一", goal: "g", order: 1 },
  });
  await prisma.task.create({
    data: { stageId: stage.id, description: "今天完成", type: "学习", status: "completed", completedAt: new Date(), order: 1 },
  });

  // 聚合组:恰好 5 人同方向(方向名唯一,与并行测试文件天然隔离),全部达成 1/1
  await Promise.all(
    Array.from({ length: 5 }, (_, i) => prisma.user.create({ data: { email: `growthrouter-a${i}-${suffix}@test.local`, name: "聚合成员" } }))
  ).then((users) =>
    Promise.all(
      users.map(async (u) => {
        const profile = await prisma.careerProfile.create({ data: { userId: u.id, version: 1 } });
        await prisma.careerPath.create({
          data: { profileId: profile.id, directionName: direction, matchScore: 90, strengths: [], weaknesses: [] },
        });
        const r = await prisma.roadmap.create({ data: { userId: u.id, targetDirection: "后端开发" } });
        const s = await prisma.stage.create({ data: { roadmapId: r.id, name: "一", goal: "g", order: 1 } });
        await prisma.task.create({
          data: { stageId: s.id, description: "t", type: "学习", status: "completed", order: 1 },
        });
      })
    )
  );
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("growth 接口(真实写库,顺序执行)", () => {
  it("未登录访问 → UNAUTHORIZED", async () => {
    await expect(caller(null).growth.block()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).growth.report()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).growth.aggregate()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("block:空用户全部空值,不报错", async () => {
    const block = await caller(freshUserId).growth.block();
    expect(block.profileVersionCount).toBe(0);
    expect(block.profileVersion).toBeNull();
    expect(block.latestMatchScore).toBeNull();
    expect(block.matchUpdatedAt).toBeNull();
    expect(block.taskStats).toEqual({ completed: 0, total: 0 });
  });

  it("report:空用户空序列,不报错", async () => {
    const report = await caller(freshUserId).growth.report();
    expect(report.profileVersions).toEqual([]);
    expect(report.taskTrend).toHaveLength(REPORT_WEEKS);
    expect(report.taskTrend.every((bucket) => bucket.count === 0)).toBe(true);
    expect(report.matchScores).toEqual([]);
  });

  it("block:有数据用户(版本数/匹配度/任务完成计数)", async () => {
    const block = await caller(userId).growth.block();
    expect(block.profileVersionCount).toBe(1);
    expect(block.profileVersion).toBe(1);
    expect(block.latestMatchScore).toBe(72);
    expect(block.matchUpdatedAt).toEqual(expect.any(String));
    expect(block.taskStats).toEqual({ completed: 1, total: 1 });
  });

  it("report:画像版本含未分析行(radar 回退 null),趋势含本周任务", async () => {
    const report = await caller(userId).growth.report();
    expect(report.profileVersions).toHaveLength(1);
    expect(report.profileVersions[0]!.version).toBe(1);
    expect(report.profileVersions[0]!.radar).toBeNull();
    expect(report.taskTrend[REPORT_WEEKS - 1]!.count).toBe(1);
  });

  it("aggregate:样本达标方向返回(组大小 5、平均达成 1),输出无用户标识", async () => {
    const aggregate = await caller(userId).growth.aggregate();
    const entry = aggregate.find((e) => e.direction === direction);
    expect(entry).toEqual({ direction, userCount: 5, avgStageCompletion: 1 });
    for (const e of aggregate) {
      expect(Object.keys(e).sort()).toEqual(["avgStageCompletion", "direction", "userCount"]);
    }
    expect(JSON.stringify(aggregate)).not.toContain("@test.local");
  });
});
