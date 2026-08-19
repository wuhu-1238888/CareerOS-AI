// appRouter:全部业务 mutation/query 的唯一注册点(CRUD 与 Agent 调用走 tRPC,见 technical-design API 层约定)
// user.register 为任务 1.4 注册流程;受保护过程模板 protectedProcedure 供 1.8 起使用
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const publicProcedure = t.procedure;

// 受保护过程:未登录 → UNAUTHORIZED;登录后 ctx.userId 为数据库用户 id
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  const userId = ctx.session?.user?.id;
  if (!userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录" });
  }
  return next({ ctx: { ...ctx, userId } });
});

export const appRouter = t.router({
  user: t.router({
    // 当前登录用户资料(顶栏头像/昵称、1.8 设置页同步)
    me: protectedProcedure.query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { id: true, name: true, avatarColor: true },
      });
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
      }
      return user;
    }),

    // 更新资料(昵称/头像色,1.8 设置页);头像色为 5 预设色之一(UI 限定,服务端校验 hex 格式)
    updateProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1, "请输入昵称").max(30, "昵称最多 30 个字符"),
          avatarColor: z
            .string()
            .regex(/^#[0-9a-fA-F]{6}$/, "头像颜色格式不正确")
            .nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await ctx.prisma.user.update({
          where: { id: ctx.userId },
          data: { name: input.name, avatarColor: input.avatarColor },
          select: { id: true, name: true, avatarColor: true },
        });
        return user;
      }),

    // 修改密码:校验当前密码后写入新哈希(不重签会话,当前会话保持有效)
    changePassword: protectedProcedure
      .input(
        z.object({
          currentPassword: z.string().min(1, "请输入当前密码"),
          newPassword: z.string().min(8, "新密码至少 8 位").max(72, "新密码最多 72 位"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await ctx.prisma.user.findUnique({ where: { id: ctx.userId } });
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "用户不存在" });
        }
        if (!user.passwordHash || !(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "当前密码不正确" });
        }
        const passwordHash = await bcrypt.hash(input.newPassword, 10);
        await ctx.prisma.user.update({ where: { id: ctx.userId }, data: { passwordHash } });
        return { ok: true };
      }),

    register: publicProcedure
      .input(
        z.object({
          email: z.string().email("邮箱格式不正确"),
          name: z.string().min(1, "请输入昵称").max(30, "昵称最多 30 个字符"),
          password: z.string().min(8, "密码至少 8 位").max(72, "密码最多 72 位"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await ctx.prisma.user.findUnique({ where: { email: input.email } });
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "该邮箱已注册" });
        }
        const passwordHash = await bcrypt.hash(input.password, 10);
        const user = await ctx.prisma.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash,
            authMethod: "password",
          },
        });
        return { id: user.id, email: user.email, name: user.name };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// 服务端直连 caller(SSR / 接口测试用,不经过 HTTP 层)
export const createCaller = t.createCallerFactory(appRouter);
