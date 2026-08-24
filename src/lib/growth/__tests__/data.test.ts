// @vitest-environment node
// 成长数据层测试(8.2,真实写库):周桶分窗(8 周 sparkline / 12 周趋势,固定 now 确定性断言)、
// 画像版本演进(相邻版本 diff,损坏版本回退 null)、匹配度曲线(仅 succeeded + 数值分数,时间升序)、
// 匿名聚合(按方向分组平均、样本阈值 5、最新版本去重、无用户标识)。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  BLOCK_WEEKS,
  MIN_AGGREGATE_USERS,
  REPORT_WEEKS,
  computeGrowthAggregate,
  computeGrowthBlock,
  computeGrowthReport,
} from "../data";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const mainEmail = `growthdata-main-${suffix}@test.local`;

// 固定 now:2026-08-20(周四)上海 → 本周周界 = 2026-08-17 00:00 CST = 2026-08-16T16:00:00Z
const NOW = new Date("2026-08-20T10:00:00.000Z");
const THIS_WEEK_START = "2026-08-16T16:00:00.000Z";
// 任务完成时间轴(UTC):本周 / 上周 / 三周前 / 8 周窗口外但 12 周窗口内 / 两窗口之外
const AT_THIS_WEEK = new Date("2026-08-19T04:00:00.000Z");
const AT_PREV_WEEK = new Date("2026-08-12T04:00:00.000Z");
const AT_THREE_BACK = new Date("2026-07-25T04:00:00.000Z");
const AT_IN_12_OUT_8 = new Date("2026-06-10T04:00:00.000Z");
const AT_OUT_BOTH = new Date("2026-05-20T04:00:00.000Z");

let userId: string;

async function createTestUser(email: string) {
  return prisma.user.create({ data: { email, name: "成长数据" } });
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const user = await createTestUser(mainEmail);
  userId = user.id;

  // 画像三版本:v1/v2 含完整 aiAnalysis(radar + abilityTags),v3 损坏(缺 radar/abilityTags)
  await prisma.careerProfile.createMany({
    data: [
      {
        userId,
        version: 1,
        parentVersion: null,
        createdAt: new Date("2026-08-01T08:00:00.000Z"),
        aiAnalysis: {
          radar: { 产品: 50, 技术: 40, 数据: 45, 沟通: 55, 项目: 35, 行业: 30 },
          abilityTags: [
            { name: "Python", level: "基础" },
            { name: "SQL", level: "基础" },
            { name: "Git", level: "基础" },
          ],
        },
      },
      {
        userId,
        version: 2,
        parentVersion: 1,
        createdAt: new Date("2026-08-10T08:00:00.000Z"),
        aiAnalysis: {
          radar: { 产品: 52, 技术: 48, 数据: 45, 沟通: 55, 项目: 40, 行业: 30 },
          abilityTags: [
            { name: "Python", level: "熟练" },
            { name: "SQL", level: "基础" },
            { name: "Docker", level: "基础" },
          ],
        },
      },
      {
        userId,
        version: 3,
        parentVersion: 2,
        createdAt: new Date("2026-08-15T08:00:00.000Z"),
        aiAnalysis: { summary: "损坏的分析结果(缺 radar/abilityTags)" },
      },
    ],
  });

  // 任务时间轴(路线图 2 阶段):覆盖各周桶 + pending/出窗任务
  const roadmap = await prisma.roadmap.create({ data: { userId, targetDirection: "后端开发" } });
  const stage = await prisma.stage.create({
    data: { roadmapId: roadmap.id, name: "阶段一", goal: "打基础", order: 1 },
  });
  await prisma.task.createMany({
    data: [
      { stageId: stage.id, description: "本周完成", type: "学习", status: "completed", completedAt: AT_THIS_WEEK, order: 1 },
      { stageId: stage.id, description: "上周完成", type: "学习", status: "completed", completedAt: AT_PREV_WEEK, order: 2 },
      { stageId: stage.id, description: "三周前完成", type: "学习", status: "completed", completedAt: AT_THREE_BACK, order: 3 },
      { stageId: stage.id, description: "12 周内 8 周外", type: "学习", status: "completed", completedAt: AT_IN_12_OUT_8, order: 4 },
      { stageId: stage.id, description: "两窗口外", type: "学习", status: "completed", completedAt: AT_OUT_BOTH, order: 5 },
      { stageId: stage.id, description: "进行中", type: "学习", status: "in_progress", completedAt: null, order: 6 },
    ],
  });

  // 匹配记录 + 成功/降级/失败 run(曲线只取 succeeded 且 overallScore 为数值的,最近 20 条时间升序)
  await prisma.jobMatch.create({
    data: { userId, matchReport: { overallScore: 72 } },
  });
  await prisma.agentRun.createMany({
    data: [
      {
        userId,
        agentName: "matching",
        intent: "analyze-match",
        status: "succeeded",
        output: { overallScore: 60 },
        createdAt: new Date("2026-08-01T09:00:00.000Z"),
      },
      {
        userId,
        agentName: "matching",
        intent: "analyze-match",
        status: "succeeded",
        output: { overallScore: 65 },
        createdAt: new Date("2026-08-02T09:00:00.000Z"),
      },
      {
        userId,
        agentName: "matching",
        intent: "analyze-match",
        status: "succeeded",
        output: { overallScore: null }, // 无画像降级 run:曲线不计入
        createdAt: new Date("2026-08-03T09:00:00.000Z"),
      },
      {
        userId,
        agentName: "matching",
        intent: "analyze-match",
        status: "failed",
        output: { overallScore: 90 },
        createdAt: new Date("2026-08-04T09:00:00.000Z"),
      },
    ],
  });

  // —— 聚合队列:6 人 A 组(后端A)+ 4 人 B 组(产品B,样本不足)+ 边界用户 ——
  const directionA = `后端A-${suffix}`;
  const directionB = `产品B-${suffix}`;
  const directionX = `数据X-${suffix}`;
  // A 组 6 人:前 3 人达成 1/2,后 3 人达成 2/2 → 平均 0.75
  const groupA = await Promise.all(
    Array.from({ length: 6 }, (_, i) => createTestUser(`growthdata-a${i}-${suffix}@test.local`))
  );
  await Promise.all(
    groupA.map(async (u, i) => {
      const profile = await prisma.careerProfile.create({ data: { userId: u.id, version: 1 } });
      await prisma.careerPath.create({
        data: { profileId: profile.id, directionName: directionA, matchScore: 90, strengths: [], weaknesses: [] },
      });
      const roadmap = await prisma.roadmap.create({ data: { userId: u.id, targetDirection: "后端开发" } });
      const s1 = await prisma.stage.create({ data: { roadmapId: roadmap.id, name: "一", goal: "g", order: 1 } });
      const s2 = await prisma.stage.create({ data: { roadmapId: roadmap.id, name: "二", goal: "g", order: 2 } });
      await prisma.task.createMany({
        data: [
          { stageId: s1.id, description: "t", type: "学习", status: "completed", order: 1 },
          // 前 3 人阶段二未完成(达成 1/2),后 3 人阶段二全完成(达成 2/2)
          { stageId: s2.id, description: "t", type: "学习", status: i < 3 ? "pending" : "completed", order: 1 },
          ...(i < 3 ? [] : [{ stageId: s2.id, description: "t2", type: "学习", status: "completed", order: 2 }]),
        ],
      });
    })
  );
  // B 组 4 人(样本不足 5 → 整组不返回);其中一人带空阶段(计入分母但永不完成)
  const groupB = await Promise.all(
    Array.from({ length: 4 }, (_, i) => createTestUser(`growthdata-b${i}-${suffix}@test.local`))
  );
  await Promise.all(
    groupB.map(async (u, i) => {
      const profile = await prisma.careerProfile.create({ data: { userId: u.id, version: 1 } });
      await prisma.careerPath.create({
        data: { profileId: profile.id, directionName: directionB, matchScore: 80, strengths: [], weaknesses: [] },
      });
      const roadmap = await prisma.roadmap.create({ data: { userId: u.id, targetDirection: "产品经理" } });
      const s1 = await prisma.stage.create({ data: { roadmapId: roadmap.id, name: "一", goal: "g", order: 1 } });
      await prisma.task.create({
        data: { stageId: s1.id, description: "t", type: "学习", status: "completed", order: 1 },
      });
      if (i === 0) {
        await prisma.stage.create({ data: { roadmapId: roadmap.id, name: "空阶段", goal: "g", order: 2 } });
      }
    })
  );
  // 去重边界:v1 声明 A 方向、v2 改为 X 方向 → 按最新版本计入 X(单人不返回);A 组仍为 6
  const dedupe = await createTestUser(`growthdata-dedupe-${suffix}@test.local`);
  const dv1 = await prisma.careerProfile.create({ data: { userId: dedupe.id, version: 1 } });
  await prisma.careerPath.create({
    data: { profileId: dv1.id, directionName: directionA, matchScore: 90, strengths: [], weaknesses: [] },
  });
  const dv2 = await prisma.careerProfile.create({
    data: { userId: dedupe.id, version: 2, parentVersion: 1 },
  });
  await prisma.careerPath.create({
    data: { profileId: dv2.id, directionName: directionX, matchScore: 90, strengths: [], weaknesses: [] },
  });
  const dRoadmap = await prisma.roadmap.create({ data: { userId: dedupe.id, targetDirection: "数据分析" } });
  const ds1 = await prisma.stage.create({ data: { roadmapId: dRoadmap.id, name: "一", goal: "g", order: 1 } });
  await prisma.task.create({ data: { stageId: ds1.id, description: "t", type: "学习", status: "completed", order: 1 } });
  // 无路线图用户:有方向但无达成数据 → 不计入 A 组(否则 A 组为 7)
  const noRoadmap = await createTestUser(`growthdata-noroadmap-${suffix}@test.local`);
  const nProfile = await prisma.careerProfile.create({ data: { userId: noRoadmap.id, version: 1 } });
  await prisma.careerPath.create({
    data: { profileId: nProfile.id, directionName: directionA, matchScore: 90, strengths: [], weaknesses: [] },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("computeGrowthBlock 工作台区块(固定 now)", () => {
  it("画像版本数/最新版本/最新匹配度/匹配时间", async () => {
    const block = await computeGrowthBlock(prisma, userId, NOW);
    expect(block.profileVersionCount).toBe(3);
    expect(block.profileVersion).toBe(3);
    expect(block.latestMatchScore).toBe(72);
    expect(block.matchUpdatedAt).toEqual(expect.any(String));
  });

  it("近 8 周 sparkline:周桶升序、窗口内外边界正确", async () => {
    const block = await computeGrowthBlock(prisma, userId, NOW);
    expect(block.sparkline).toHaveLength(BLOCK_WEEKS);
    expect(block.sparkline[7]).toEqual({ weekStart: THIS_WEEK_START, count: 1 }); // 本周
    expect(block.sparkline[6]).toEqual({ weekStart: "2026-08-09T16:00:00.000Z", count: 1 }); // 上周
    expect(block.sparkline[3]).toEqual({ weekStart: "2026-07-19T16:00:00.000Z", count: 1 }); // 三周前
    // 8 周窗口外(06-10)与两窗口外(05-20)均不计入
    const total = block.sparkline.reduce((sum, bucket) => sum + bucket.count, 0);
    expect(total).toBe(3);
    expect(block.sparkline[0]!.weekStart).toBe("2026-06-28T16:00:00.000Z");
  });

  it("无数据用户:全部空值,不抛错", async () => {
    const fresh = await createTestUser(`growthdata-fresh-${suffix}@test.local`);
    const block = await computeGrowthBlock(prisma, fresh.id, NOW);
    expect(block.profileVersionCount).toBe(0);
    expect(block.profileVersion).toBeNull();
    expect(block.latestMatchScore).toBeNull();
    expect(block.matchUpdatedAt).toBeNull();
    expect(block.sparkline).toHaveLength(BLOCK_WEEKS);
    expect(block.sparkline.every((bucket) => bucket.count === 0)).toBe(true);
  });
});

describe("computeGrowthReport 完整报告(固定 now)", () => {
  it("画像版本演进:版本升序,相邻版本 diff 正确,损坏版本回退 null", async () => {
    const report = await computeGrowthReport(prisma, userId, NOW);
    expect(report.profileVersions.map((v) => v.version)).toEqual([1, 2, 3]);

    const [v1, v2, v3] = report.profileVersions;
    expect(v1!.diff).toBeNull(); // 首版无上一版本
    expect(v2!.radar).not.toBeNull();
    expect(v2!.diff).not.toBeNull();
    expect(v2!.diff!.radar).toEqual([
      { dimension: "产品", current: 52, previous: 50, delta: 2 },
      { dimension: "技术", current: 48, previous: 40, delta: 8 },
      { dimension: "数据", current: 45, previous: 45, delta: 0 },
      { dimension: "沟通", current: 55, previous: 55, delta: 0 },
      { dimension: "项目", current: 40, previous: 35, delta: 5 },
      { dimension: "行业", current: 30, previous: 30, delta: 0 },
    ]);
    expect(v2!.diff!.abilityTags).toEqual([
      { name: "Python", kind: "提升", from: "基础", to: "熟练" },
      { name: "Docker", kind: "新增", from: null, to: "基础" },
    ]);
    expect(v3!.radar).toBeNull();
    expect(v3!.abilityTags).toBeNull();
    expect(v3!.diff).toBeNull();
  });

  it("任务完成趋势:12 周窗口(8 周窗口外但 12 周内的任务计入)", async () => {
    const report = await computeGrowthReport(prisma, userId, NOW);
    expect(report.taskTrend).toHaveLength(REPORT_WEEKS);
    expect(report.taskTrend[11]).toEqual({ weekStart: THIS_WEEK_START, count: 1 });
    expect(report.taskTrend[10]!.count).toBe(1); // 上周
    expect(report.taskTrend[7]!.count).toBe(1); // 三周前
    expect(report.taskTrend[1]!.count).toBe(1); // 06-10:12 周内、8 周外
    const total = report.taskTrend.reduce((sum, bucket) => sum + bucket.count, 0);
    expect(total).toBe(4);
  });

  it("匹配度曲线:仅 succeeded 且分数为数值的 run,时间升序", async () => {
    const report = await computeGrowthReport(prisma, userId, NOW);
    expect(report.matchScores).toEqual([
      { createdAt: "2026-08-01T09:00:00.000Z", overallScore: 60 },
      { createdAt: "2026-08-02T09:00:00.000Z", overallScore: 65 },
    ]);
  });
});

describe("computeGrowthAggregate 匿名聚合", () => {
  it("按方向分组平均阶段达成率;样本不足 5 的组不返回;最新版本去重", async () => {
    const aggregate = await computeGrowthAggregate(prisma);
    const groupA = aggregate.find((e) => e.direction === `后端A-${suffix}`);
    expect(groupA).toEqual({
      direction: `后端A-${suffix}`,
      userCount: 6, // 无路线图用户与 v2 改向用户均不计入
      avgStageCompletion: 0.75,
    });
    // B 组 4 人(< MIN_AGGREGATE_USERS)→ 整组不返回
    expect(aggregate.find((e) => e.direction === `产品B-${suffix}`)).toBeUndefined();
    // 单人的 X 方向同样不返回
    expect(aggregate.find((e) => e.direction === `数据X-${suffix}`)).toBeUndefined();
  });

  it("脱敏:每条仅含方向/组大小/平均达成率,无任何用户标识", async () => {
    const aggregate = await computeGrowthAggregate(prisma);
    expect(aggregate.length).toBeGreaterThan(0);
    for (const entry of aggregate) {
      expect(Object.keys(entry).sort()).toEqual(["avgStageCompletion", "direction", "userCount"]);
    }
    const serialized = JSON.stringify(aggregate);
    expect(serialized).not.toContain("@test.local");
    expect(serialized).not.toContain(userId);
    // 阈值口径:样本不足整组不返回(计划 8.2:样本不足展示引导而非报错)
    expect(MIN_AGGREGATE_USERS).toBe(5);
  });
});
