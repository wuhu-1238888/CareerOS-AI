// @vitest-environment node
// 注册接口测试(1.4):tRPC createCaller 直连,不经 HTTP 层;真实写库,测试后清理。
// 断言要点:注册成功建用户、密码只存哈希、重复邮箱 CONFLICT、非法输入 BAD_REQUEST、守卫过程。
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { initTRPC } from "@trpc/server";
import type { Context } from "../context";
import { createCaller, protectedProcedure } from "../router";
import { prisma } from "@/lib/db/prisma";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = `reg-${suffix}@test.local`;
const password = "careeros-pass-123";

const caller = createCaller({ session: null, prisma });

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("user.register(tRPC caller 直连)", () => {
  it("注册成功:返回用户信息,数据库只存 bcrypt 哈希", async () => {
    const result = await caller.user.register({ email, name: "注册测试", password });
    expect(result).toEqual({ id: expect.any(String), email, name: "注册测试" });

    const dbUser = await prisma.user.findUnique({ where: { email } });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.passwordHash).not.toBe(password); // 非明文
    expect(dbUser?.authMethod).toBe("password");
    const matches = await bcrypt.compare(password, dbUser?.passwordHash ?? "");
    expect(matches).toBe(true); // 哈希可验证原文
  });

  it("重复邮箱 → CONFLICT「该邮箱已注册」", async () => {
    await expect(
      caller.user.register({ email, name: "重复注册", password })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // 数据库仍只有一条记录
    const count = await prisma.user.count({ where: { email } });
    expect(count).toBe(1);
  });

  it("非法输入 → BAD_REQUEST(邮箱格式 / 密码长度 / 昵称为空)", async () => {
    const cases = [
      { email: "not-an-email", name: "甲", password },
      { email: `bad-${suffix}@test.local`, name: "乙", password: "short" },
      { email: `bad2-${suffix}@test.local`, name: "", password },
    ];
    for (const input of cases) {
      await expect(caller.user.register(input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    const count = await prisma.user.count({
      where: { email: { endsWith: `${suffix}@test.local` } },
    });
    expect(count).toBe(1); // 非法输入未产生脏数据
  });
});

describe("protectedProcedure 守卫(1.8 起业务过程的统一守门)", () => {
  // 用测试本地 t 实例挂载真实的 protectedProcedure 探针,验证守卫行为与 userId 注入
  const probeT = initTRPC.context<Context>().create();
  const guardRouter = probeT.router({
    userId: protectedProcedure.query(({ ctx }) => ctx.userId),
  });
  const guardCaller = probeT.createCallerFactory(guardRouter);

  // 守卫只读 session.user.id,不访问数据库,夹具无需真实用户
  const loggedInSession = {
    user: { id: "guard-test-user", email: "guard@test.local", name: "守卫测试" },
    expires: "2030-01-01T00:00:00.000Z",
  };

  it("未登录 → UNAUTHORIZED「请先登录」", async () => {
    const unauth = guardCaller({ session: null, prisma });
    await expect(unauth.userId()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "请先登录",
    });
  });

  it("已登录 → 放行并注入 userId", async () => {
    const authed = guardCaller({ session: loggedInSession, prisma });
    await expect(authed.userId()).resolves.toBe("guard-test-user");
  });
});
