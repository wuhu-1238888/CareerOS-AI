// @vitest-environment node
// linkage 命名空间接口测试(8.1b/8.1c,真实写库):rules 查询、dismiss 幂等去重、
// resolveDirection 按 (profileVersion, matchDirection) 幂等更新、resolution 查询、未登录隔离。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `linkagerouter-a-${suffix}@test.local`;

let userIdA: string;
let roadmapIdA: string;

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
    data: { email: emailA, name: "联动接口", passwordHash, authMethod: "password" },
  });
  userIdA = a.id;

  // 最小数据:画像 v1 + 路线图(完成实践项目「个人博客系统」)+ 简历(无项目)→ 一条 resume_project 活跃
  await prisma.careerProfile.create({ data: { userId: userIdA, version: 1, parentVersion: null } });
  const roadmap = await prisma.roadmap.create({
    data: { userId: userIdA, targetDirection: "后端开发" },
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
  await prisma.resume.create({
    data: {
      userId: userIdA,
      originalText: "简历原文",
      parsedData: {
        basicInfo: { name: "", targetPosition: "", phone: "", email: "" },
        education: [],
        skills: [],
        experiences: [],
        projects: [],
      },
    },
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("linkage 接口(真实写库,顺序执行)", () => {
  it("未登录访问 → UNAUTHORIZED", async () => {
    await expect(caller(null).linkage.rules()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).linkage.dismiss({ kind: "resume_project", refVersion: "x" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).linkage.resolveDirection({
        profileVersion: 1,
        profileDirection: "后端开发",
        matchDirection: "新媒体运营",
        choice: "prefer_profile",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).linkage.resolution({ profileVersion: 1, matchDirection: "新媒体运营" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rules:返回活跃规则(完成项目未入简历)", async () => {
    const rules = await caller(userIdA).linkage.rules();
    const project = rules.find((r) => r.kind === "resume_project");
    expect(project).toBeDefined();
    if (project?.kind === "resume_project") {
      expect(project.refVersion).toBe(roadmapIdA);
      expect(project.projectTitle).toBe("个人博客系统");
    }
  });

  it("dismiss:落库关闭记录,同 (kind, refVersion) 不再出现在 rules;重复 dismiss 幂等", async () => {
    const first = await caller(userIdA).linkage.dismiss({ kind: "resume_project", refVersion: roadmapIdA });
    expect(first.ok).toBe(true);
    const rules = await caller(userIdA).linkage.rules();
    expect(rules.some((r) => r.kind === "resume_project")).toBe(false);

    // 幂等:再次 dismiss 不报错、不产生重复行
    await caller(userIdA).linkage.dismiss({ kind: "resume_project", refVersion: roadmapIdA });
    const rows = await prisma.linkageHint.findMany({
      where: { userId: userIdA, kind: "resume_project", refVersion: roadmapIdA },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.dismissedAt).not.toBeNull();
  });

  it("dismiss:输入校验(kind 非法)→ BAD_REQUEST", async () => {
    await expect(
      caller(userIdA).linkage.dismiss({ kind: "bad_kind" as never, refVersion: "x" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("resolution:无裁决记录 → null", async () => {
    expect(await caller(userIdA).linkage.resolution({ profileVersion: 1, matchDirection: "新媒体运营" })).toBeNull();
  });

  it("resolveDirection:落库后可查询;同一 (profileVersion, matchDirection) 重复裁决幂等更新(单行)", async () => {
    const result = await caller(userIdA).linkage.resolveDirection({
      profileVersion: 1,
      profileDirection: "后端开发",
      matchDirection: "新媒体运营",
      choice: "prefer_profile",
    });
    expect(result.ok).toBe(true);
    expect(result.choice).toBe("prefer_profile");

    const saved = await caller(userIdA).linkage.resolution({ profileVersion: 1, matchDirection: "新媒体运营" });
    expect(saved?.profileDirection).toBe("后端开发");
    expect(saved?.choice).toBe("prefer_profile");

    // 同冲突再次裁决 → 更新原行选择,不产生重复行
    await caller(userIdA).linkage.resolveDirection({
      profileVersion: 1,
      profileDirection: "后端开发",
      matchDirection: "新媒体运营",
      choice: "keep_both",
    });
    const updated = await caller(userIdA).linkage.resolution({ profileVersion: 1, matchDirection: "新媒体运营" });
    expect(updated?.choice).toBe("keep_both");
    const rows = await prisma.directionResolution.findMany({
      where: { userId: userIdA, profileVersion: 1, matchDirection: "新媒体运营" },
    });
    expect(rows).toHaveLength(1);

    // 不同 matchDirection 是不同冲突:互不影响
    expect(await caller(userIdA).linkage.resolution({ profileVersion: 1, matchDirection: "产品经理" })).toBeNull();
  });

  it("resolveDirection:choice 非法 → BAD_REQUEST", async () => {
    await expect(
      caller(userIdA).linkage.resolveDirection({
        profileVersion: 1,
        profileDirection: "后端开发",
        matchDirection: "产品经理",
        choice: "bad_choice" as never,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
