// @vitest-environment node
// user.me 接口测试(1.7):真实写库;返回当前用户资料 / 未登录拒绝 / 用户不存在 NOT_FOUND
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = `me-${suffix}@test.local`;

let userId: string;

function callerWithSession(sessionUserId: string) {
  return createCaller({
    session: {
      user: { id: sessionUserId, email: "x@y.z", name: "甲" },
      expires: "2030-01-01T00:00:00.000Z",
    },
    prisma,
  });
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const user = await prisma.user.create({
    data: { email, name: "我的资料测试", authMethod: "password" },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("user.me", () => {
  it("已登录:返回 id/昵称/头像色(默认 null)", async () => {
    const result = await callerWithSession(userId).user.me();
    expect(result).toEqual({ id: userId, name: "我的资料测试", avatarColor: null });
  });

  it("未登录 → UNAUTHORIZED「请先登录」", async () => {
    const unauth = createCaller({ session: null, prisma });
    await expect(unauth.user.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "请先登录",
    });
  });

  it("会话有效但用户已删除 → NOT_FOUND", async () => {
    const ghostId = `ghost-${suffix}`;
    await expect(callerWithSession(ghostId).user.me()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
