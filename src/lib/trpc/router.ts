// appRouter:全部业务 mutation/query 的唯一注册点(CRUD 与 Agent 调用走 tRPC,见 technical-design API 层约定)
// user.register 为任务 1.4 注册流程;受保护过程模板 protectedProcedure 供 1.8 起使用
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import type { Context } from "./context";
import {
  profileDataSchema,
  careerPathInputSchema,
  educationEntrySchema,
  skillEntrySchema,
  experienceEntrySchema,
} from "@/lib/profile/schemas";
import { analyzeProfile } from "@/lib/profile/pipeline";

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

// 画像数据读取边界:Json 列内容经 schema 校验后返回(不直接信任数据库原始 JSON,损坏/缺失回退空值)
function parseProfileData(row: {
  education: unknown;
  skills: unknown;
  experiences: unknown;
  interests: unknown;
  targets: unknown;
}) {
  const education = educationEntrySchema.array().max(5).safeParse(row.education);
  const skills = skillEntrySchema.array().max(20).safeParse(row.skills);
  const experiences = experienceEntrySchema.array().max(10).safeParse(row.experiences);
  const interests = z.array(z.string()).safeParse(row.interests);
  const targets = z.array(z.string()).safeParse(row.targets);
  return {
    education: education.success ? education.data : [],
    skills: skills.success ? skills.data : [],
    experiences: experiences.success ? experiences.data : [],
    interests: interests.success ? interests.data : [],
    targets: targets.success ? targets.data : [],
  };
}

// 画像行序列化:对外输出统一形状 { 元信息 + data(ProfileData)+ aiAnalysis }
type ProfileRowShape = {
  id: string;
  version: number;
  parentVersion: number | null;
  createdAt: Date;
  updatedAt: Date;
  education: unknown;
  skills: unknown;
  experiences: unknown;
  interests: unknown;
  targets: unknown;
  aiAnalysis: unknown;
};

function serializeProfile(row: ProfileRowShape) {
  return {
    id: row.id,
    version: row.version,
    parentVersion: row.parentVersion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    data: parseProfileData(row),
    aiAnalysis: row.aiAnalysis,
  };
}

// AgentRun 状态序列化(2.4):running 超过 2 分钟视为中断(服务端进程被杀),返回失败态供重试
const RUN_STALE_MS = 2 * 60 * 1000;

function serializeRun(run: {
  id: string;
  status: string;
  progress: unknown;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const stale = run.status === "running" && Date.now() - run.updatedAt.getTime() > RUN_STALE_MS;
  return {
    id: run.id,
    status: stale ? "failed" : run.status,
    stale,
    progress: parseRunProgress(run.progress),
    error: stale ? "分析中断,请重试" : run.error,
    createdAt: run.createdAt,
  };
}

function parseRunProgress(value: unknown): { stage: string; message: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (p): p is { stage: string; message: string } =>
      !!p &&
      typeof p === "object" &&
      typeof (p as { stage?: unknown }).stage === "string" &&
      typeof (p as { message?: unknown }).message === "string"
  );
}

// 分析输入(2.4):表单数据 + 可选纠偏反馈;analyze 与 retry(从 AgentRun.input 重放)共用
const analyzeInputSchema = profileDataSchema.extend({
  feedback: z
    .object({
      areas: z.array(z.enum(["direction", "ability", "strength"])).min(1, "请选择不准确的部分"),
      note: z.string().max(500, "补充说明最多 500 字").optional(),
    })
    .optional(),
});

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
      const row = await ctx.prisma.careerProfile.findFirst({
        where: { userId: ctx.userId },
        orderBy: { version: "desc" },
        include: { careerPaths: { orderBy: { matchScore: "desc" } } },
      });
      if (!row) return null;
      const { careerPaths, ...rest } = row;
      return { ...serializeProfile(rest), careerPaths };
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
        await requireOwnedProfile(ctx, input.id);
        const row = await ctx.prisma.careerProfile.findUnique({
          where: { id: input.id },
          include: { careerPaths: { orderBy: { matchScore: "desc" } } },
        });
        if (!row) return null;
        const { careerPaths, ...rest } = row;
        return { ...serializeProfile(rest), careerPaths };
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
      const row = await ctx.prisma.careerProfile.create({
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
      return serializeProfile(row);
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
      const row = await ctx.prisma.careerProfile.update({
        where: { id: latest.id },
        data: {
          education: input.education,
          skills: input.skills,
          experiences: input.experiences,
          interests: input.interests,
          targets: input.targets,
        },
      });
      return serializeProfile(row);
    }),

    // 删除全部版本(CareerPath/Roadmap 级联删除)
    delete: protectedProcedure.mutation(async ({ ctx }) => {
      await ctx.prisma.careerProfile.deleteMany({ where: { userId: ctx.userId } });
      return { ok: true };
    }),

    // 画像分析(2.4):表单/纠偏/更新共用 —— 等待执行完成后返回新版本信息;
    // 进度事件已随执行实时写入 AgentRun.progress,客户端轮询 latestRun/getRun 展示
    analyze: protectedProcedure
      .input(analyzeInputSchema)
      .mutation(async ({ ctx, input }) => {
        const { feedback, ...data } = input;
        const outcome = await analyzeProfile({ userId: ctx.userId, data, feedback });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return { profileId: outcome.profileId, version: outcome.version, runId: outcome.runId };
      }),

    // 失败重试(2.4):从最近一次失败 run 的 input 重放分析(刷新后数据仍在服务端,无需客户端回传)
    retry: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const run = await ctx.prisma.agentRun.findUnique({ where: { id: input.runId } });
        if (!run || run.userId !== ctx.userId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "分析任务不存在" });
        }
        const parsed = analyzeInputSchema.safeParse(run.input);
        if (!parsed.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "无法重试该任务,请重新填写" });
        }
        const { feedback, ...data } = parsed.data;
        const outcome = await analyzeProfile({ userId: ctx.userId, data, feedback });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return { profileId: outcome.profileId, version: outcome.version, runId: outcome.runId };
      }),

    // 指定分析任务的运行状态与进度(仅本人可见)
    getRun: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const run = await ctx.prisma.agentRun.findUnique({ where: { id: input.runId } });
        if (!run || run.userId !== ctx.userId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "分析任务不存在" });
        }
        return serializeRun(run);
      }),

    // 最近一次画像分析 run:分析页轮询(700ms)与刷新恢复的统一入口
    latestRun: protectedProcedure.query(async ({ ctx }) => {
      const run = await ctx.prisma.agentRun.findFirst({
        where: { userId: ctx.userId, intent: "analyze-profile" },
        orderBy: { createdAt: "desc" },
      });
      return run ? serializeRun(run) : null;
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
