// @vitest-environment node
// 设置页接口测试(1.8,真实写库):updateProfile / changePassword
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = `settings-${suffix}@test.local`;
const oldPassword = "old-password-123";
const newPassword = "new-password-456";

let userId: string;

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
  const user = await prisma.user.create({
    data: {
      email,
      name: "设置测试",
      passwordHash: await bcrypt.hash(oldPassword, 10),
      authMethod: "password",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("user.updateProfile", () => {
  it("更新昵称与头像色,返回并落库", async () => {
    const result = await caller(userId).user.updateProfile({ name: "新昵称", avatarColor: "#7c5cfc" });
    expect(result).toEqual({ id: userId, name: "新昵称", avatarColor: "#7c5cfc" });
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(dbUser?.name).toBe("新昵称");
    expect(dbUser?.avatarColor).toBe("#7c5cfc");
  });

  it("昵称为空 → BAD_REQUEST", async () => {
    await expect(
      caller(userId).user.updateProfile({ name: "", avatarColor: null })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("头像色非 hex 格式 → BAD_REQUEST", async () => {
    await expect(
      caller(userId).user.updateProfile({ name: "甲", avatarColor: "blue" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("未登录 → UNAUTHORIZED", async () => {
    await expect(
      caller(null).user.updateProfile({ name: "甲", avatarColor: null })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("user.changePassword", () => {
  it("当前密码正确:改密后旧密码失效、新密码可验证", async () => {
    const result = await caller(userId).user.changePassword({
      currentPassword: oldPassword,
      newPassword,
    });
    expect(result).toEqual({ ok: true });
    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(await bcrypt.compare(oldPassword, dbUser?.passwordHash ?? "")).toBe(false);
    expect(await bcrypt.compare(newPassword, dbUser?.passwordHash ?? "")).toBe(true);
  });

  it("当前密码错误 → BAD_REQUEST「当前密码不正确」", async () => {
    await expect(
      caller(userId).user.changePassword({ currentPassword: "wrong-password", newPassword })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "当前密码不正确" });
  });

  it("新密码不足 8 位 → BAD_REQUEST", async () => {
    await expect(
      caller(userId).user.changePassword({ currentPassword: newPassword, newPassword: "short" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("未登录 → UNAUTHORIZED", async () => {
    await expect(
      caller(null).user.changePassword({ currentPassword: newPassword, newPassword })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
