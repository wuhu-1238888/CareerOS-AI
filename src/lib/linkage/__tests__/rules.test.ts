// @vitest-environment node
// 联动规则服务测试(8.1b,真实写库):三条规则检测、项目已覆盖不提示、
// dismiss 后同版本不再骚扰、画像新版本再现(版本隔离不串数据)、新用户空结果。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { evaluateLinkageRules } from "../rules";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `linkage-rules-a-${suffix}@test.local`;
const emailB = `linkage-rules-b-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;
let roadmapIdA: string;

const base = Date.now();
// 时间轴:画像 v1(t0)→ 简历版本(t0+1s)→ 路线图(t0+2s)→ 画像 v2(t0+10s)→ 画像 v3(t0+20s,测试中创建)
const profileV1At = new Date(base);
const resumeVersionAt = new Date(base + 1000);
const roadmapAt = new Date(base + 2000);
const profileV2At = new Date(base + 10000);

const resumeProjects = (projects: { name: string; timeRange: { start: string } }[]) => ({
  basicInfo: { name: "", targetPosition: "", phone: "", email: "" },
  education: [],
  skills: [],
  experiences: [],
  projects,
});

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b] = await Promise.all(
    [emailA, emailB].map((email) =>
      prisma.user.create({ data: { email, name: "联动规则", passwordHash, authMethod: "password" } })
    )
  );
  userIdA = a.id;
  userIdB = b.id;

  // A 用户:两版画像 + 简历(项目:校园二手交易平台)+ 路线图(完成实践项目:个人博客系统)
  await prisma.careerProfile.createMany({
    data: [
      { userId: userIdA, version: 1, parentVersion: null, createdAt: profileV1At },
      { userId: userIdA, version: 2, parentVersion: 1, createdAt: profileV2At },
    ],
  });
  const resume = await prisma.resume.create({
    data: {
      userId: userIdA,
      originalText: "简历原文",
      parsedData: resumeProjects([{ name: "校园二手交易平台", timeRange: { start: "2025-01" } }]),
    },
  });
  await prisma.resumeVersion.create({
    data: { resumeId: resume.id, targetDirection: "后端开发", createdAt: resumeVersionAt },
  });
  const roadmap = await prisma.roadmap.create({
    data: { userId: userIdA, targetDirection: "后端开发", createdAt: roadmapAt },
  });
  roadmapIdA = roadmap.id;
  const stage = await prisma.stage.create({
    data: {
      roadmapId: roadmap.id,
      name: "阶段一",
      goal: "夯实基础",
      order: 1,
      content: {
        learningContent: ["Python 基础", "SQL 入门", "HTTP 原理"],
        practiceProjects: [{ title: "个人博客系统", deliverable: "可访问的博客站点" }],
        resources: [],
        checkpoints: [],
      },
    },
  });
  await prisma.task.createMany({
    data: [
      { stageId: stage.id, description: "Python 基础", type: "学习", status: "completed", order: 1 },
      { stageId: stage.id, description: "个人博客系统", type: "实践项目", status: "completed", order: 2 },
    ],
  });

  // B 用户:画像(t0)→ 路线图/简历版本均晚于画像(t0+5s),且项目任务未完成 → 无任何活跃规则
  await prisma.careerProfile.create({
    data: { userId: userIdB, version: 1, parentVersion: null, createdAt: new Date(base) },
  });
  const roadmapB = await prisma.roadmap.create({
    data: { userId: userIdB, targetDirection: "数据分析", createdAt: new Date(base + 5000) },
  });
  const stageB = await prisma.stage.create({
    data: { roadmapId: roadmapB.id, name: "阶段一", goal: "入门", order: 1, content: {} },
  });
  await prisma.task.create({
    data: { stageId: stageB.id, description: "待办项目", type: "实践项目", status: "pending", order: 1 },
  });
  const resumeB = await prisma.resume.create({
    data: { userId: userIdB, originalText: "原文", parsedData: resumeProjects([]) },
  });
  await prisma.resumeVersion.create({
    data: { resumeId: resumeB.id, createdAt: new Date(base + 5000) },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("evaluateLinkageRules(8.1b,真实写库)", () => {
  it("三条规则全部检测:完成项目未入简历 + 画像 v2 晚于简历版本与路线图", async () => {
    const rules = await evaluateLinkageRules(prisma, userIdA);

    const project = rules.find((r) => r.kind === "resume_project");
    expect(project).toBeDefined();
    if (project?.kind === "resume_project") {
      expect(project.refVersion).toBe(roadmapIdA);
      expect(project.projectTitle).toBe("个人博客系统");
      expect(project.deliverable).toBe("可访问的博客站点");
    }

    const resumeOutdated = rules.find((r) => r.kind === "resume_outdated");
    expect(resumeOutdated).toBeDefined();
    if (resumeOutdated?.kind === "resume_outdated") {
      expect(resumeOutdated.refVersion).toBe("2");
      expect(resumeOutdated.profileVersion).toBe(2);
      expect(resumeOutdated.staleUpdatedAt).toBe(resumeVersionAt.toISOString());
    }

    const roadmapOutdated = rules.find((r) => r.kind === "roadmap_outdated");
    expect(roadmapOutdated).toBeDefined();
    if (roadmapOutdated?.kind === "roadmap_outdated") {
      expect(roadmapOutdated.refVersion).toBe("2");
      expect(roadmapOutdated.staleUpdatedAt).toBe(roadmapAt.toISOString());
    }
  });

  it("项目已加入简历:resume_project 不再提示(标题归一化包含判据)", async () => {
    const resume = await prisma.resume.findFirst({ where: { userId: userIdA } });
    await prisma.resume.update({
      where: { id: resume!.id },
      data: {
        parsedData: resumeProjects([
          { name: "校园二手交易平台", timeRange: { start: "2025-01" } },
          { name: "个人博客系统(课程实践)", timeRange: { start: "2025-03" } },
        ]),
      },
    });
    const rules = await evaluateLinkageRules(prisma, userIdA);
    expect(rules.some((r) => r.kind === "resume_project")).toBe(false);
    // 恢复原状供后续用例
    await prisma.resume.update({
      where: { id: resume!.id },
      data: { parsedData: resumeProjects([{ name: "校园二手交易平台", timeRange: { start: "2025-01" } }]) },
    });
    const restored = await evaluateLinkageRules(prisma, userIdA);
    expect(restored.some((r) => r.kind === "resume_project")).toBe(true);
  });

  it("dismiss 后同 (kind, refVersion) 不再骚扰,其余规则不受影响", async () => {
    await prisma.linkageHint.create({
      data: { userId: userIdA, kind: "resume_project", refVersion: roadmapIdA, dismissedAt: new Date() },
    });
    const rules = await evaluateLinkageRules(prisma, userIdA);
    expect(rules.some((r) => r.kind === "resume_project")).toBe(false);
    expect(rules.some((r) => r.kind === "resume_outdated")).toBe(true);
    expect(rules.some((r) => r.kind === "roadmap_outdated")).toBe(true);
  });

  it("版本隔离:已关闭的画像版本不再出现,新画像版本重新提示", async () => {
    // 关闭 v2 的 resume_outdated / roadmap_outdated
    await prisma.linkageHint.createMany({
      data: [
        { userId: userIdA, kind: "resume_outdated", refVersion: "2", dismissedAt: new Date() },
        { userId: userIdA, kind: "roadmap_outdated", refVersion: "2", dismissedAt: new Date() },
      ],
    });
    const closed = await evaluateLinkageRules(prisma, userIdA);
    expect(closed.some((r) => r.kind === "resume_outdated")).toBe(false);
    expect(closed.some((r) => r.kind === "roadmap_outdated")).toBe(false);

    // 画像 v3(v2 之后再次分析)→ 两条 outdated 规则以 refVersion "3" 重新出现(版本不串数据)
    await prisma.careerProfile.create({
      data: { userId: userIdA, version: 3, parentVersion: 2, createdAt: new Date(base + 20000) },
    });
    const reopened = await evaluateLinkageRules(prisma, userIdA);
    const outdated = reopened.filter(
      (r) => r.kind === "resume_outdated" || r.kind === "roadmap_outdated"
    );
    expect(outdated).toHaveLength(2);
    for (const rule of outdated) {
      if (rule.kind !== "resume_project") {
        expect(rule.refVersion).toBe("3");
        expect(rule.profileVersion).toBe(3);
      }
    }
  });

  it("画像早于路线图与简历版本、项目未完成:无任何活跃规则(新用户空结果)", async () => {
    const rules = await evaluateLinkageRules(prisma, userIdB);
    expect(rules).toEqual([]);
  });
});
