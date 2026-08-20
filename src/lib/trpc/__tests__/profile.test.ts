// @vitest-environment node
// 画像数据层接口测试(2.1,真实写库):profile CRUD + careerPath CRUD、越权隔离、未登录拒绝
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";
import type { ProfileData } from "@/lib/profile/schemas";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `profile-a-${suffix}@test.local`;
const emailB = `profile-b-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;
let profileId: string;

function caller(sessionUserId: string | null) {
  return createCaller({
    session: sessionUserId
      ? { user: { id: sessionUserId, email: "x@y.z", name: "甲" }, expires: "2030-01-01T00:00:00.000Z" }
      : null,
    prisma,
  });
}

function profileData(): ProfileData {
  return {
    education: [
      { degree: "本科", major: "计算机科学与技术", school: "示例大学", graduationYear: 2026 },
    ],
    skills: [
      { name: "Python", level: "熟练" as const },
      { name: "数据分析", level: "基础" as const },
    ],
    experiences: [
      {
        type: "internship" as const,
        organization: "示例科技",
        role: "后端实习生",
        description: "参与内部工具开发",
      },
    ],
    interests: ["人工智能", "产品经理"],
    targets: ["后端开发工程师"],
  };
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const userA = await prisma.user.create({
    data: { email: emailA, name: "画像A", passwordHash, authMethod: "password" },
  });
  const userB = await prisma.user.create({
    data: { email: emailB, name: "画像B", passwordHash, authMethod: "password" },
  });
  userIdA = userA.id;
  userIdB = userB.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("profile CRUD(真实写库,顺序执行)", () => {
  it("未创建时 get 返回 null", async () => {
    expect(await caller(userIdA).profile.get()).toBeNull();
  });

  it("create:写入首个版本(version=1),数据落库", async () => {
    const row = await caller(userIdA).profile.create(profileData());
    profileId = row.id;
    expect(row.version).toBe(1);
    expect(row.data.education).toMatchObject([{ degree: "本科" }]);
    expect(row.aiAnalysis).toBeNull();
    const dbRow = await prisma.careerProfile.findUnique({ where: { id: row.id } });
    expect(dbRow?.userId).toBe(userIdA);
    expect(dbRow?.aiAnalysis).toBeNull();
  });

  it("create:已有画像 → CONFLICT", async () => {
    await expect(caller(userIdA).profile.create(profileData())).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("get:返回最新版本与方向列表", async () => {
    const row = await caller(userIdA).profile.get();
    expect(row?.id).toBe(profileId);
    expect(row?.careerPaths).toEqual([]);
  });

  it("update:更新最新版本基础数据", async () => {
    const data = profileData();
    data.skills = [{ name: "TypeScript", level: "精通" }];
    const row = await caller(userIdA).profile.update(data);
    expect(row.id).toBe(profileId);
    expect(row.data.skills).toMatchObject([{ name: "TypeScript", level: "精通" }]);
    const dbRow = await prisma.careerProfile.findUnique({ where: { id: profileId } });
    expect(dbRow?.skills).toMatchObject({ 0: { name: "TypeScript", level: "精通" } });
  });

  it("update:无画像 → NOT_FOUND", async () => {
    await expect(caller(userIdB).profile.update(profileData())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("getVersion:本人可读,他人画像 → NOT_FOUND(不泄露存在性)", async () => {
    const own = await caller(userIdA).profile.getVersion({ id: profileId });
    expect(own?.id).toBe(profileId);
    await expect(caller(userIdB).profile.getVersion({ id: profileId })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "画像不存在",
    });
    await expect(caller(userIdA).profile.getVersion({ id: "nonexistent" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("careerPath:创建(匹配度 0~100 整数)、列表按匹配度降序、删除", async () => {
    await caller(userIdA).profile.careerPath.create({
      profileId,
      directionName: "后端开发",
      matchScore: 85,
      strengths: ["Python 熟练"],
      weaknesses: [],
    });
    await caller(userIdA).profile.careerPath.create({
      profileId,
      directionName: "数据分析",
      matchScore: 62,
      strengths: [],
      weaknesses: ["统计学基础薄弱"],
    });
    const list = await caller(userIdA).profile.careerPath.list({ profileId });
    expect(list).toHaveLength(2);
    expect(list[0]?.directionName).toBe("后端开发");
    expect(list[0]?.matchScore).toBe(85);
    expect(list[1]?.matchScore).toBe(62);
    await caller(userIdA).profile.careerPath.delete({ id: list[1]!.id });
    const after = await caller(userIdA).profile.careerPath.list({ profileId });
    expect(after).toHaveLength(1);
  });

  it("careerPath:匹配度超范围 → BAD_REQUEST;越权 profile → NOT_FOUND", async () => {
    await expect(
      caller(userIdA).profile.careerPath.create({
        profileId,
        directionName: "越界",
        matchScore: 101,
        strengths: [],
        weaknesses: [],
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller(userIdB).profile.careerPath.create({
        profileId,
        directionName: "偷写",
        matchScore: 50,
        strengths: [],
        weaknesses: [],
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("careerPath:他人删除我的路径 → NOT_FOUND", async () => {
    const [path] = await caller(userIdA).profile.careerPath.list({ profileId });
    await expect(caller(userIdB).profile.careerPath.delete({ id: path!.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("listVersions:版本倒序(模拟管线已生成 v2)", async () => {
    await prisma.careerProfile.create({
      data: {
        userId: userIdA,
        version: 2,
        parentVersion: 1,
        education: [],
        skills: [],
        aiAnalysis: { summary: "v2 分析" },
      },
    });
    const versions = await caller(userIdA).profile.listVersions();
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    const latest = await caller(userIdA).profile.get();
    expect(latest?.version).toBe(2);
  });

  it("delete:删除全部版本并级联清理方向;get 回到 null", async () => {
    await caller(userIdA).profile.delete();
    expect(await caller(userIdA).profile.get()).toBeNull();
    expect(
      await prisma.careerPath.findMany({ where: { profileId } })
    ).toHaveLength(0);
    expect(await prisma.careerProfile.findMany({ where: { userId: userIdA } })).toHaveLength(0);
  });

  it("未登录:读写删均 → UNAUTHORIZED", async () => {
    await expect(caller(null).profile.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).profile.create(profileData())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(null).profile.update(profileData())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(null).profile.delete()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).profile.careerPath.list({ profileId })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
