// @vitest-environment node
// 工作台聚合查询测试(5.1,真实写库):KPI 数据、增量徽章基线、Agent 状态(含 running 超时判死)、
// 上海时区周边界、task.updateStatus 完成时间维护、用户数据隔离、
// 待处理建议(最近工作简历最新版本 pending 计数,工作台导航优化 P2)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";
import { shanghaiWeekStarts } from "@/lib/dashboard/stats";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `dash-a-${suffix}@test.local`;
const emailB = `dash-b-${suffix}@test.local`;

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

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const a = await prisma.user.create({
    data: { email: emailA, name: "工作台甲", passwordHash, authMethod: "password" },
  });
  const b = await prisma.user.create({
    data: { email: emailB, name: "工作台乙", passwordHash, authMethod: "password" },
  });
  userIdA = a.id;
  userIdB = b.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("dashboard.stats(真实写库,顺序执行)", () => {
  it("无任何数据:全空 + 三 Agent 待命", async () => {
    const stats = await caller(userIdA).dashboard.stats();
    expect(stats.profile.version).toBeNull();
    expect(stats.profile.analyzed).toBe(false);
    expect(stats.profile.matchScore).toBeNull();
    expect(stats.profile.matchScoreDelta).toBeNull();
    expect(stats.roadmap.exists).toBe(false);
    expect(stats.roadmap.progress).toBeNull();
    expect(stats.resume).toEqual({
      fileCount: 0,
      versionCount: 0,
      latestFileName: null,
      latestAt: null,
      lastActivityId: null,
      lastActivityFileName: null,
      lastActivityVersionCount: 0,
      pendingCount: null,
    });
    expect(stats.weekTasks).toEqual({ completed: 0, delta: null });
    expect(stats.agents.profile.status).toBe("idle");
    expect(stats.agents.roadmap.status).toBe("idle");
    expect(stats.agents.resume.status).toBe("idle");
  });

  it("画像两版本:最高匹配度 + 较上次增量(上一版本为基线)", async () => {
    await prisma.careerProfile.create({
      data: {
        userId: userIdA,
        version: 1,
        aiAnalysis: { summary: "v1" },
        careerPaths: {
          create: [{ directionName: "数据分析", matchScore: 72, strengths: [], weaknesses: [] }],
        },
      },
    });
    await prisma.careerProfile.create({
      data: {
        userId: userIdA,
        version: 2,
        aiAnalysis: { summary: "v2" },
        careerPaths: {
          create: [
            { directionName: "数据产品", matchScore: 88, strengths: [], weaknesses: [] },
            { directionName: "数据分析", matchScore: 80, strengths: [], weaknesses: [] },
          ],
        },
      },
    });
    const stats = await caller(userIdA).dashboard.stats();
    expect(stats.profile.version).toBe(2);
    expect(stats.profile.analyzed).toBe(true);
    expect(stats.profile.matchScore).toBe(88);
    expect(stats.profile.matchScoreDelta).toBe(16);
    expect(stats.profile.directionCount).toBe(2);
    expect(stats.profile.topDirection).toBe("数据产品");
    expect(stats.profile.updatedAt).toBeTruthy();
  });

  it("路线图 + 本周/上周任务:进度与增量徽章基线;updateStatus 维护 completedAt", async () => {
    const { id: roadmapId } = await caller(userIdA).navigator.roadmap.create({
      targetDirection: "数据产品",
    });
    const { id: stageId } = await caller(userIdA).navigator.stage.create({
      roadmapId,
      name: "基础",
      goal: "打好基础",
    });
    const t1 = await caller(userIdA).navigator.task.create({
      stageId,
      description: "完成本周任务",
      type: "学习",
    });
    const t2 = await caller(userIdA).navigator.task.create({
      stageId,
      description: "完成上周任务",
      type: "学习",
    });
    const t3 = await caller(userIdA).navigator.task.create({
      stageId,
      description: "未完成任务",
      type: "学习",
    });
    // t1 经 updateStatus 完成 → completedAt = 现在(本周)
    await caller(userIdA).navigator.task.updateStatus({ taskId: t1.id, status: "completed" });
    // t2 直接落库上周完成时间(模拟历史完成)
    const lastWeek = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await prisma.task.update({ where: { id: t2.id }, data: { status: "completed", completedAt: lastWeek } });
    await caller(userIdA).navigator.task.updateStatus({ taskId: t3.id, status: "in_progress" });

    const stats = await caller(userIdA).dashboard.stats();
    expect(stats.roadmap.exists).toBe(true);
    expect(stats.roadmap.total).toBe(3);
    expect(stats.roadmap.completed).toBe(2);
    expect(stats.roadmap.progress).toBe(67);
    expect(stats.roadmap.stageCount).toBe(1);
    expect(stats.roadmap.targetDirection).toBe("数据产品");
    expect(stats.weekTasks.completed).toBe(1);
    expect(stats.weekTasks.delta).toBe(0); // 本周 1 - 上周 1

    // completed → 离开 completed:completedAt 清空
    await caller(userIdA).navigator.task.updateStatus({ taskId: t1.id, status: "pending" });
    const dbTask = await prisma.task.findUnique({ where: { id: t1.id } });
    expect(dbTask?.completedAt).toBeNull();
    await caller(userIdA).navigator.task.updateStatus({ taskId: t1.id, status: "completed" });
    const dbTask2 = await prisma.task.findUnique({ where: { id: t1.id } });
    expect(dbTask2?.completedAt).toBeInstanceOf(Date);
  });

  it("简历文件与优化版本计数 + 最近文件名", async () => {
    const { id: resumeId } = await caller(userIdA).resume.createFromText({
      text: "张三 前端工程师 3 年经验\n技能:React TypeScript\n教育:某大学 计算机",
    });
    await prisma.resumeVersion.create({
      data: { resumeId, targetDirection: "数据产品", changes: {} },
    });
    await prisma.resumeVersion.create({
      data: { resumeId, targetDirection: "数据分析", changes: {} },
    });
    const stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.fileCount).toBe(1);
    expect(stats.resume.versionCount).toBe(2);
    expect(stats.resume.latestFileName).toBeNull(); // 粘贴路径无文件名
    expect(stats.resume.latestAt).toBeTruthy();
    // 无简历类 run → 最近工作简历回退最新创建行
    expect(stats.resume.lastActivityId).toBe(resumeId);
    expect(stats.resume.lastActivityFileName).toBeNull(); // 粘贴路径无文件名
    expect(stats.resume.lastActivityVersionCount).toBe(2); // 该简历的两个版本计入最近工作口径
  });

  it("Agent 状态:running(带进度)/ succeeded(带末条文案)/ 失败;简历 Agent 取三 intent 最近一次", async () => {
    await prisma.agentRun.create({
      data: {
        userId: userIdA,
        agentName: "career-profile-analyzer",
        intent: "analyze-profile",
        status: "succeeded",
        progress: [
          { stage: "start", message: "启动" },
          { stage: "done", message: "分析完成" },
        ],
      },
    });
    await prisma.agentRun.create({
      data: {
        userId: userIdA,
        agentName: "career-roadmap-planner",
        intent: "generate-roadmap",
        status: "running",
        progress: [
          { stage: "start", message: "正在启动「career-roadmap-planner」…" },
          { stage: "prompt", message: "正在理解你的背景与目标…" },
          { stage: "llm", message: "正在分析…" },
        ],
      },
    });
    // 简历类 intent 多次运行,取最近一次(running)
    await prisma.agentRun.create({
      data: { userId: userIdA, agentName: "resume-parse-agent", intent: "parse-resume", status: "succeeded", progress: [] },
    });
    await prisma.agentRun.create({
      data: { userId: userIdA, agentName: "resume-rewrite-agent", intent: "rewrite-resume", status: "running", progress: [] },
    });

    const stats = await caller(userIdA).dashboard.stats();
    expect(stats.agents.profile.status).toBe("succeeded");
    expect(stats.agents.profile.progressCount).toBe(2);
    expect(stats.agents.profile.lastMessage).toBe("分析完成");
    expect(stats.agents.roadmap.status).toBe("running");
    expect(stats.agents.roadmap.progressCount).toBe(3);
    expect(stats.agents.roadmap.lastMessage).toBe("正在分析…");
    expect(stats.agents.resume.status).toBe("running"); // rewrite 比 parse 新
  });

  it("running 超时判死(updatedAt 超 3 分钟 + 60s 缓冲 → failed)", async () => {
    await prisma.agentRun.create({
      data: {
        userId: userIdB,
        agentName: "career-profile-analyzer",
        intent: "analyze-profile",
        status: "running",
        progress: [],
        updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });
    const stats = await caller(userIdB).dashboard.stats();
    expect(stats.agents.profile.status).toBe("failed");
  });

  it("用户数据隔离:乙的任务/简历不计入甲", async () => {
    // 乙有自己的路线图任务与简历,甲的 weekTasks/resume 计数不受影响
    const { id: roadmapId } = await caller(userIdB).navigator.roadmap.create({
      targetDirection: "测试方向",
    });
    const { id: stageId } = await caller(userIdB).navigator.stage.create({
      roadmapId,
      name: "基础",
      goal: "打好基础",
    });
    const t = await caller(userIdB).navigator.task.create({ stageId, description: "乙的任务", type: "学习" });
    await caller(userIdB).navigator.task.updateStatus({ taskId: t.id, status: "completed" });
    await caller(userIdB).resume.createFromText({ text: "乙的简历内容 测试工程师 两年经验" });

    const statsA = await caller(userIdA).dashboard.stats();
    expect(statsA.weekTasks.completed).toBe(1); // 仅甲自己的本周完成
    expect(statsA.resume.fileCount).toBe(1);
    const statsB = await caller(userIdB).dashboard.stats();
    expect(statsB.weekTasks.completed).toBe(1);
    expect(statsB.resume.fileCount).toBe(1);
  });

  it("最近工作简历派生:简历类 run 的 input.resumeId 决定 lastActivity(优于创建时间);score-ats 无 resumeId 不参与", async () => {
    // R1 先建(createdAt 旧)、R2 后建(createdAt 新)
    const { id: r1 } = await caller(userIdA).resume.createFromText({
      text: "简历一 前端工程师 两年经验\n技能:React",
    });
    const { id: r2 } = await caller(userIdA).resume.createFromText({
      text: "简历二 产品经理 三年经验\n技能:需求分析",
    });
    // 无简历类 run → 回退最新创建(R2)
    let stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.lastActivityId).toBe(r2);

    // 最新的 parse run 指向 R1 → 击败 createdAt 顺序,指向 R1
    await prisma.agentRun.create({
      data: {
        userId: userIdA,
        agentName: "resume-parse-agent",
        intent: "parse-resume",
        status: "succeeded",
        progress: [],
        input: { resumeId: r1 },
      },
    });
    stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.lastActivityId).toBe(r1);

    // 更新的 rewrite run 指向 R2 → 指向 R2
    await prisma.agentRun.create({
      data: {
        userId: userIdA,
        agentName: "resume-rewrite-agent",
        intent: "rewrite-resume",
        status: "succeeded",
        progress: [],
        input: { resumeId: r2 },
      },
    });
    stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.lastActivityId).toBe(r2);

    // score-ats 的 input 不含 resumeId → 扫描跳过,派生结果不变(已知限制,见 technical-design)
    await prisma.agentRun.create({
      data: {
        userId: userIdA,
        agentName: "resume-ats-agent",
        intent: "score-ats",
        status: "succeeded",
        progress: [],
        input: { finalText: "文本", targetDirection: "产品经理" },
      },
    });
    stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.lastActivityId).toBe(r2);
  });

  it("悬空回退:run 引用的简历已删除 → 跳过并回退;全部删除 → null", async () => {
    // 承接上一用例:R2(简历二)为当前 lastActivity,run 同时引用 R1(简历一)/R2
    const r1 = await prisma.resume.findFirst({
      where: { userId: userIdA, originalText: { contains: "简历一" } },
    });
    const r2 = await prisma.resume.findFirst({
      where: { userId: userIdA, originalText: { contains: "简历二" } },
    });
    expect(r1).toBeTruthy();
    expect(r2).toBeTruthy();
    const before = await caller(userIdA).dashboard.stats();
    expect(before.resume.lastActivityId).toBe(r2!.id);

    // 删除 R2(当前 lastActivity)→ run 中 R2 引用悬空,回退到仍有有效 run 引用的 R1
    await caller(userIdA).resume.delete({ id: r2!.id });
    let stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.lastActivityId).toBe(r1!.id);

    // 删除 R1 → 全部 run 引用悬空,回退最新创建行(最早那张粘贴简历)
    await caller(userIdA).resume.delete({ id: r1!.id });
    stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.lastActivityId).not.toBeNull();
    expect(stats.resume.lastActivityId).not.toBe(r1!.id);
    expect(stats.resume.lastActivityId).not.toBe(r2!.id);

    // 全部删除 → 无简历 → lastActivityId 为 null
    await caller(userIdA).resume.delete({ id: stats.resume.lastActivityId! });
    stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.lastActivityId).toBeNull();
    expect(stats.resume.lastActivityFileName).toBeNull();
  });

  it("用户隔离:乙的简历 run 不影响甲的 lastActivity", async () => {
    const { id: bResume } = await caller(userIdB).resume.createFromText({
      text: "乙的新简历 测试工程师 一年经验",
    });
    await prisma.agentRun.create({
      data: {
        userId: userIdB,
        agentName: "resume-parse-agent",
        intent: "parse-resume",
        status: "succeeded",
        progress: [],
        input: { resumeId: bResume },
      },
    });
    // 甲当前无简历(上一用例已全删)→ 不受乙影响
    const statsA = await caller(userIdA).dashboard.stats();
    expect(statsA.resume.lastActivityId).toBeNull();
    // 乙 → 自己的简历
    const statsB = await caller(userIdB).dashboard.stats();
    expect(statsB.resume.lastActivityId).toBe(bResume);
  });

  it("待处理建议:最近工作简历最新版本 pending 计数(工作台导航优化 P2)", async () => {
    const { id: resumeId } = await caller(userIdA).resume.createFromText({
      text: "甲的新简历 数据分析师 三年经验\n技能:SQL Python",
    });
    const version = await prisma.resumeVersion.create({
      data: { resumeId, targetDirection: "数据分析", changes: {} },
    });
    await prisma.optimization.createMany({
      data: [
        { resumeVersionId: version.id, status: "pending", order: 0 },
        { resumeVersionId: version.id, status: "pending", order: 1 },
        { resumeVersionId: version.id, status: "accepted", order: 2 },
      ],
    });
    const stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.lastActivityId).toBe(resumeId); // 无有效 run → 回退最新创建行
    expect(stats.resume.pendingCount).toBe(2); // 仅 pending 计入,accepted 不计
  });

  it("待处理建议取最新版本口径:旧版本有 pending、新版本无 → 0", async () => {
    const { id: resumeId } = await caller(userIdA).resume.createFromText({
      text: "甲的另一份简历 产品经理 两年经验",
    });
    // 旧版本(显式旧 createdAt,避免同毫秒落库导致口径不确定)带 1 条 pending
    const oldVersion = await prisma.resumeVersion.create({
      data: {
        resumeId,
        targetDirection: "产品经理",
        changes: {},
        createdAt: new Date(Date.now() - 60 * 1000),
      },
    });
    await prisma.optimization.create({
      data: { resumeVersionId: oldVersion.id, status: "pending", order: 0 },
    });
    // 新版本无 pending(仅 1 条 accepted)
    const newVersion = await prisma.resumeVersion.create({
      data: { resumeId, targetDirection: "产品经理", changes: {} },
    });
    await prisma.optimization.create({
      data: { resumeVersionId: newVersion.id, status: "accepted", order: 0 },
    });
    const stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.lastActivityId).toBe(resumeId);
    expect(stats.resume.pendingCount).toBe(0); // 最新版本口径:旧版本遗留 pending 不计
  });

  it("待处理建议:有简历无优化版本 → null(KPI「—」,不伪造 0)", async () => {
    const { id: resumeId } = await caller(userIdA).resume.createFromText({
      text: "甲的第三份简历 测试工程师 一年经验",
    });
    const stats = await caller(userIdA).dashboard.stats();
    expect(stats.resume.lastActivityId).toBe(resumeId);
    expect(stats.resume.pendingCount).toBeNull();
  });
});

describe("shanghaiWeekStarts(上海时区周一 00:00 边界)", () => {
  it("周一上午(上海)本身 → 本周起点为当日零点", () => {
    // 2026-08-17 是周一;上海 10:00 = UTC 02:00
    const { thisWeek, lastWeek } = shanghaiWeekStarts(new Date("2026-08-17T02:00:00.000Z"));
    expect(thisWeek.toISOString()).toBe("2026-08-16T16:00:00.000Z"); // 上海周一 00:00
    expect(lastWeek.toISOString()).toBe("2026-08-09T16:00:00.000Z");
  });

  it("周日深夜(上海)仍属本周 → 起点为上上个周一零点之后的本周一", () => {
    // 2026-08-23 是周日;上海 23:00 = UTC 15:00
    const { thisWeek } = shanghaiWeekStarts(new Date("2026-08-23T15:00:00.000Z"));
    expect(thisWeek.toISOString()).toBe("2026-08-16T16:00:00.000Z");
  });

  it("UTC 凌晨(上海已进入次日)→ 按上海日期取整", () => {
    // UTC 2026-08-16 18:00 = 上海 2026-08-17(周一)02:00 → 本周起点为上海周一
    const { thisWeek } = shanghaiWeekStarts(new Date("2026-08-16T18:00:00.000Z"));
    expect(thisWeek.toISOString()).toBe("2026-08-16T16:00:00.000Z");
  });
});
