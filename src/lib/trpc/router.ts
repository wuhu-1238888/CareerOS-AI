// appRouter:全部业务 mutation/query 的唯一注册点(CRUD 与 Agent 调用走 tRPC,见 technical-design API 层约定)
// user.register 为任务 1.4 注册流程;受保护过程模板 protectedProcedure 供 1.8 起使用
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Context } from "./context";
import { profileDataSchema, careerPathInputSchema } from "@/lib/profile/schemas";

// 画像归属校验:profileId 不属于当前用户时一律 NOT_FOUND(不泄露他人画像存在性)
async function requireOwnedProfile(
  ctx: { prisma: Context["prisma"]; userId: string },
  profileId: string
) {
  const profile = await ctx.prisma.careerProfile.findFirst({
    where: { id: profileId, userId: ctx.userId },
  });
  if (!profile) {
    throw new TRPCError({ code: "NOT_FOUND", message: "画像不存在" });
  }
  return profile;
}

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

  // 画像数据层 CRUD(2.1):分析管线在 2.4 接入;版本模型 = 每次分析产生新行(活跃版本取最大 version)
  profile: t.router({
    // 当前用户最新画像(含推荐方向,按匹配度降序);从未创建 → null
    get: protectedProcedure.query(async ({ ctx }) => {
      return ctx.prisma.careerProfile.findFirst({
        where: { userId: ctx.userId },
        orderBy: { version: "desc" },
        include: { careerPaths: { orderBy: { matchScore: "desc" } } },
      });
    }),

    // 版本列表(结果页版本选择器用):仅返回元信息,内容按需 getVersion
    listVersions: protectedProcedure.query(async ({ ctx }) => {
      return ctx.prisma.careerProfile.findMany({
        where: { userId: ctx.userId },
        orderBy: { version: "desc" },
        select: { id: true, version: true, createdAt: true },
      });
    }),

    // 指定版本详情(旧版本查看,2.6 要求「旧版本仍可查看」)
    getVersion: protectedProcedure
      .input(z.object({ id: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const profile = await requireOwnedProfile(ctx, input.id);
        return ctx.prisma.careerProfile.findUnique({
          where: { id: profile.id },
          include: { careerPaths: { orderBy: { matchScore: "desc" } } },
        });
      }),

    // 创建首个数据行(version=1,无分析结果);已有画像 → CONFLICT
    create: protectedProcedure.input(profileDataSchema).mutation(async ({ ctx, input }) => {
      const existing = await ctx.prisma.careerProfile.findFirst({
        where: { userId: ctx.userId },
        orderBy: { version: "desc" },
      });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "已有画像,请使用更新或重新分析" });
      }
      return ctx.prisma.careerProfile.create({
        data: {
          userId: ctx.userId,
          version: 1,
          education: input.education,
          skills: input.skills,
          experiences: input.experiences,
          interests: input.interests,
          targets: input.targets,
        },
      });
    }),

    // 更新最新版本的基础数据列(不改变版本号;重新分析由 2.4 管线产生新版本)
    update: protectedProcedure.input(profileDataSchema).mutation(async ({ ctx, input }) => {
      const latest = await ctx.prisma.careerProfile.findFirst({
        where: { userId: ctx.userId },
        orderBy: { version: "desc" },
      });
      if (!latest) {
        throw new TRPCError({ code: "NOT_FOUND", message: "画像不存在" });
      }
      return ctx.prisma.careerProfile.update({
        where: { id: latest.id },
        data: {
          education: input.education,
          skills: input.skills,
          experiences: input.experiences,
          interests: input.interests,
          targets: input.targets,
        },
      });
    }),

    // 删除全部版本(CareerPath/Roadmap 级联删除)
    delete: protectedProcedure.mutation(async ({ ctx }) => {
      await ctx.prisma.careerProfile.deleteMany({ where: { userId: ctx.userId } });
      return { ok: true };
    }),

    // 推荐方向数据层 CRUD(创建/删除用于数据完整性;正常写入由分析管线 2.4 执行)
    careerPath: t.router({
      list: protectedProcedure
        .input(z.object({ profileId: z.string().min(1) }))
        .query(async ({ ctx, input }) => {
          await requireOwnedProfile(ctx, input.profileId);
          return ctx.prisma.careerPath.findMany({
            where: { profileId: input.profileId },
            orderBy: { matchScore: "desc" },
          });
        }),

      create: protectedProcedure
        .input(z.object({ profileId: z.string().min(1) }).merge(careerPathInputSchema))
        .mutation(async ({ ctx, input }) => {
          await requireOwnedProfile(ctx, input.profileId);
          return ctx.prisma.careerPath.create({
            data: {
              profileId: input.profileId,
              directionName: input.directionName,
              matchScore: input.matchScore,
              strengths: input.strengths,
              weaknesses: input.weaknesses,
            },
          });
        }),

      delete: protectedProcedure
        .input(z.object({ id: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          const path = await ctx.prisma.careerPath.findUnique({
            where: { id: input.id },
            include: { profile: { select: { userId: true } } },
          });
          if (!path || path.profile.userId !== ctx.userId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "推荐方向不存在" });
          }
          await ctx.prisma.careerPath.delete({ where: { id: input.id } });
          return { ok: true };
        }),
    }),
  }),
});

export type AppRouter = typeof appRouter;

// 服务端直连 caller(SSR / 接口测试用,不经过 HTTP 层)
export const createCaller = t.createCallerFactory(appRouter);
