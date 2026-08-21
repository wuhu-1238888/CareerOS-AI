// appRouter:全部业务 mutation/query 的唯一注册点(CRUD 与 Agent 调用走 tRPC,见 technical-design API 层约定)
// user.register 为任务 1.4 注册流程;受保护过程模板 protectedProcedure 供 1.8 起使用
import { initTRPC, TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getFileStorage } from "@/lib/file/storage";
import type { Context } from "./context";
import {
  profileDataSchema,
  careerPathInputSchema,
  educationEntrySchema,
  skillEntrySchema,
  experienceEntrySchema,
} from "@/lib/profile/schemas";
import { analyzeProfile } from "@/lib/profile/pipeline";
import { generateRoadmap, parseRoadmapSummary, parseStageContent, regenerateStage } from "@/lib/navigator/pipeline";
import { parseParsedData, parseResume, rewriteResume, scoreAts } from "@/lib/resume/pipeline";
import { buildFinalResumeText, type OptimizationText } from "@/lib/resume/final-text";
import { parsedResumeSchema } from "@/lib/resume/analysis-schemas";
import { resumeParseAgentInputSchema } from "@/lib/agents/resume.agent";

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

// 路线图归属校验(3.1):不属于当前用户 → NOT_FOUND(不泄露他人路线图存在性)
async function requireOwnedRoadmap(
  ctx: { prisma: Context["prisma"]; userId: string },
  roadmapId: string
) {
  const roadmap = await ctx.prisma.roadmap.findFirst({
    where: { id: roadmapId, userId: ctx.userId },
  });
  if (!roadmap) {
    throw new TRPCError({ code: "NOT_FOUND", message: "路线图不存在" });
  }
  return roadmap;
}

// 任务归属校验(3.1):经 stage → roadmap 链路核对属主
async function requireOwnedTask(
  ctx: { prisma: Context["prisma"]; userId: string },
  taskId: string
) {
  const task = await ctx.prisma.task.findUnique({
    where: { id: taskId },
    include: { stage: { include: { roadmap: { select: { userId: true } } } } },
  });
  if (!task || task.stage.roadmap.userId !== ctx.userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "任务不存在" });
  }
  return task;
}

// 简历归属校验(4.1):不属于当前用户 → NOT_FOUND(不泄露他人简历存在性)
async function requireOwnedResume(
  ctx: { prisma: Context["prisma"]; userId: string },
  resumeId: string
) {
  const resume = await ctx.prisma.resume.findFirst({
    where: { id: resumeId, userId: ctx.userId },
  });
  if (!resume) {
    throw new TRPCError({ code: "NOT_FOUND", message: "简历不存在" });
  }
  return resume;
}

// 修改建议归属校验(4.5):optimization → resumeVersion → resume 链路属于当前用户
async function requireOwnedOptimization(
  ctx: { prisma: Context["prisma"]; userId: string },
  optimizationId: string
) {
  const optimization = await ctx.prisma.optimization.findFirst({
    where: { id: optimizationId, resumeVersion: { resume: { userId: ctx.userId } } },
  });
  if (!optimization) {
    throw new TRPCError({ code: "NOT_FOUND", message: "修改建议不存在" });
  }
  return optimization;
}

// 优化版本归属校验(4.5):resumeVersion → resume 链路属于当前用户
async function requireOwnedVersion(
  ctx: { prisma: Context["prisma"]; userId: string },
  versionId: string
) {
  const version = await ctx.prisma.resumeVersion.findFirst({
    where: { id: versionId, resume: { userId: ctx.userId } },
  });
  if (!version) {
    throw new TRPCError({ code: "NOT_FOUND", message: "优化版本不存在" });
  }
  return version;
}

// 优化版本序列化(4.5):仅返回最新版本 + 按 order 升序的建议列表;changes/atsReport 保持 Json 原样(读取方防御解析);
// 4.7 起附带 finalText(accepted 片段合成最终文本,复制/导出的单一事实源)
function serializeVersion(
  version: {
    id: string;
    targetDirection: string | null;
    changes: unknown;
    atsScore: number | null;
    atsReport: unknown;
    atsScoredAt: Date | null;
    createdAt: Date;
    optimizations: {
      id: string;
      category: string | null;
      originalText: string | null;
      optimizedText: string | null;
      reason: string | null;
      order: number;
      status: string;
      updatedAt: Date;
    }[];
  } | null,
  originalText: string | null
) {
  if (!version) return null;
  return {
    id: version.id,
    targetDirection: version.targetDirection,
    changes: version.changes,
    atsScore: version.atsScore,
    atsReport: version.atsReport,
    atsScoredAt: version.atsScoredAt,
    createdAt: version.createdAt,
    // 文本列在 Prisma 类型上可空,但落库路径(schema min(1))保证非空;防御过滤
    finalText: originalText
      ? buildFinalResumeText(
          originalText,
          version.optimizations.filter(
            (o): o is typeof o & OptimizationText =>
              o.originalText !== null && o.optimizedText !== null
          )
        )
      : null,
    optimizations: version.optimizations.map((o) => ({
      id: o.id,
      category: o.category,
      originalText: o.originalText,
      optimizedText: o.optimizedText,
      reason: o.reason,
      order: o.order,
      status: o.status,
      updatedAt: o.updatedAt,
    })),
  };
}

// 运行时读取最新画像的能力标签(3.4 路线图生成输入):aiAnalysis.abilityTags 防御解析,无画像/损坏 → []
async function readAbilityTags(ctx: { prisma: Context["prisma"]; userId: string }) {
  const profile = await ctx.prisma.careerProfile.findFirst({
    where: { userId: ctx.userId },
    orderBy: { version: "desc" },
    select: { aiAnalysis: true },
  });
  if (!profile) return [];
  const raw = (profile.aiAnalysis as { abilityTags?: unknown } | null)?.abilityTags;
  const parsed = z
    .array(z.object({ name: z.string().min(1).max(50), level: z.enum(["基础", "熟练", "精通"]) }))
    .max(20)
    .safeParse(raw);
  return parsed.success ? parsed.data : [];
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

// 路线图行序列化(3.1):嵌套 stages/tasks 按 order 升序返回;content/summary 经防御解析(3.4),损坏回退 null
type RoadmapRowShape = {
  id: string;
  targetDirection: string;
  weeklyHours: number | null;
  currentStage: string | null;
  summary: unknown;
  createdAt: Date;
  stages: {
    id: string;
    name: string;
    goal: string;
    order: number;
    estimatedDuration: string | null;
    content: unknown;
    tasks: { id: string; description: string; type: string; status: string; order: number }[];
  }[];
};

function serializeRoadmap(row: RoadmapRowShape) {
  return {
    id: row.id,
    targetDirection: row.targetDirection,
    weeklyHours: row.weeklyHours,
    currentStage: row.currentStage,
    summary: parseRoadmapSummary(row.summary),
    createdAt: row.createdAt,
    stages: row.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      goal: stage.goal,
      order: stage.order,
      estimatedDuration: stage.estimatedDuration,
      content: parseStageContent(stage.content),
      tasks: stage.tasks,
    })),
  };
}

// AgentRun 状态序列化(2.4):running 超过 2 分钟视为中断(服务端进程被杀),返回失败态供重试;
// 本次修订:从 run.input 防御解析 resumeId/targetDirection 透出(简历页按简历行归属判断/失败后回填目标方向;其他模块不受影响)
const RUN_STALE_MS = 2 * 60 * 1000;

function serializeRun(run: {
  id: string;
  status: string;
  progress: unknown;
  error: string | null;
  input: unknown;
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
    resumeId: extractRunInputString(run.input, "resumeId"),
    targetDirection: extractRunInputString(run.input, "targetDirection"),
    createdAt: run.createdAt,
  };
}

// 从 AgentRun.input(Json 列)防御提取字符串字段:损坏/缺失 → null(前端按「旧 run 视为当前行」/无回填兜底)
function extractRunInputString(input: unknown, key: string): string | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
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

// 路线图生成输入(3.4):generate 与 retry(从 AgentRun.input 重放)共用
const generateInputSchema = z.object({
  direction: z.string().min(1, "请输入目标方向").max(30, "方向名称最多 30 个字符"),
  weeklyHours: z
    .number()
    .int("每周投入时间须为整数")
    .min(1, "每周投入时间至少 1 小时")
    .max(80, "每周投入时间最多 80 小时"),
  currentStage: z.enum(["完全新手", "有一定基础", "接近入门"], {
    errorMap: () => ({ message: "当前阶段不正确" }),
  }),
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

  // 路线图数据层(3.1):Roadmap/Stage/Task 三层嵌套 CRUD;生成与单阶段重生成管线在 3.4/3.5 接入
  navigator: t.router({
    roadmap: t.router({
      // 当前用户最新路线图(嵌套阶段与任务,按 order 升序);从未创建 → null
      get: protectedProcedure.query(async ({ ctx }) => {
        const row = await ctx.prisma.roadmap.findFirst({
          where: { userId: ctx.userId },
          orderBy: { createdAt: "desc" },
          include: {
            stages: {
              orderBy: { order: "asc" },
              include: { tasks: { orderBy: { order: "asc" } } },
            },
          },
        });
        return row ? serializeRoadmap(row) : null;
      }),

      // 创建空路线图(数据层能力;产品主路径由 3.4 生成管线一次性写入完整结构)
      create: protectedProcedure
        .input(
          z.object({
            targetDirection: z.string().min(1, "请输入目标方向").max(30, "方向名称最多 30 个字符"),
            weeklyHours: z
              .number()
              .int("每周投入时间须为整数")
              .min(1, "每周投入时间至少 1 小时")
              .max(80, "每周投入时间最多 80 小时")
              .optional(),
            currentStage: z.string().max(30, "当前阶段最多 30 个字符").optional(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const row = await ctx.prisma.roadmap.create({
            data: {
              userId: ctx.userId,
              targetDirection: input.targetDirection,
              weeklyHours: input.weeklyHours ?? null,
              currentStage: input.currentStage ?? null,
            },
          });
          return { id: row.id };
        }),

      // 生成成长路线(3.4):替换式落库;能力标签运行时读最新画像(无画像 → 空数组)
      generate: protectedProcedure.input(generateInputSchema).mutation(async ({ ctx, input }) => {
        const abilityTags = await readAbilityTags(ctx);
        const outcome = await generateRoadmap({ userId: ctx.userId, input, abilityTags });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return { roadmapId: outcome.roadmapId, runId: outcome.runId };
      }),

      // 失败重试(3.4):从最近一次失败 run 的 input 重放(刷新后数据仍在服务端)
      retry: protectedProcedure
        .input(z.object({ runId: z.string().min(1) }))
        .mutation(async ({ ctx, input }) => {
          const run = await ctx.prisma.agentRun.findUnique({ where: { id: input.runId } });
          if (!run || run.userId !== ctx.userId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "生成任务不存在" });
          }
          const parsed = generateInputSchema.safeParse(run.input);
          if (!parsed.success) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "无法重试该任务,请重新填写" });
          }
          const abilityTags = await readAbilityTags(ctx);
          const outcome = await generateRoadmap({
            userId: ctx.userId,
            input: parsed.data,
            abilityTags,
          });
          if (!outcome.ok) {
            throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
          }
          return { roadmapId: outcome.roadmapId, runId: outcome.runId };
        }),

      // 最近一次路线图生成 run(3.4):页面轮询(700ms)与刷新恢复的统一入口;按 intent 与画像分析不串台
      latestRun: protectedProcedure.query(async ({ ctx }) => {
        const run = await ctx.prisma.agentRun.findFirst({
          where: { userId: ctx.userId, intent: "generate-roadmap" },
          orderBy: { createdAt: "desc" },
        });
        return run ? serializeRun(run) : null;
      }),
    }),

    stage: t.router({
      // 追加阶段:order 缺省自动取当前最大 +1(从 1 起)
      create: protectedProcedure
        .input(
          z.object({
            roadmapId: z.string().min(1),
            name: z.string().min(1, "请输入阶段名称").max(30, "阶段名称最多 30 个字符"),
            goal: z.string().min(1, "请输入阶段目标").max(200, "阶段目标最多 200 字"),
            order: z.number().int().min(1).optional(),
            estimatedDuration: z.string().max(30, "预估时长最多 30 个字符").optional(),
            content: z.record(z.string(), z.unknown()).optional(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          await requireOwnedRoadmap(ctx, input.roadmapId);
          const last = await ctx.prisma.stage.findFirst({
            where: { roadmapId: input.roadmapId },
            orderBy: { order: "desc" },
            select: { order: true },
          });
          const row = await ctx.prisma.stage.create({
            data: {
              roadmapId: input.roadmapId,
              name: input.name,
              goal: input.goal,
              order: input.order ?? (last ? last.order + 1 : 1),
              estimatedDuration: input.estimatedDuration ?? null,
              content: (input.content ?? {}) as Prisma.InputJsonValue,
            },
          });
          return { id: row.id, order: row.order };
        }),

      // 单阶段重生成(3.5):任务反馈(太难了/已经会了)→ Stage Agent 重写该阶段(原地更新,其余阶段不动)
      regenerate: protectedProcedure
        .input(
          z.object({
            roadmapId: z.string().min(1),
            stageId: z.string().min(1),
            feedback: z.enum(["太难了", "已经会了"], { errorMap: () => ({ message: "反馈内容不正确" }) }),
          })
        )
        .mutation(async ({ ctx, input }) => {
          await requireOwnedRoadmap(ctx, input.roadmapId);
          const row = await ctx.prisma.stage.findUnique({
            where: { id: input.stageId },
            include: {
              roadmap: { select: { id: true, targetDirection: true, weeklyHours: true, currentStage: true } },
            },
          });
          if (!row || row.roadmap.id !== input.roadmapId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "阶段不存在" });
          }
          // 阶段重生成需要完整路线图输入(周时/阶段自评);3.1 空路线图未含 → 引导重新生成
          if (row.roadmap.weeklyHours == null || !row.roadmap.currentStage) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "路线图信息不完整,请重新生成后再试" });
          }
          const abilityTags = await readAbilityTags(ctx);
          const outcome = await regenerateStage({
            userId: ctx.userId,
            stageId: input.stageId,
            input: {
              direction: row.roadmap.targetDirection,
              weeklyHours: row.roadmap.weeklyHours,
              currentStage: row.roadmap.currentStage,
            },
            stage: { name: row.name, content: parseStageContent(row.content) },
            feedback: input.feedback,
            abilityTags,
          });
          if (!outcome.ok) {
            throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
          }
          return { stageId: outcome.stageId };
        }),
    }),

    task: t.router({
      // 追加任务:order 缺省自动取当前最大 +1(从 1 起)
      create: protectedProcedure
        .input(
          z.object({
            stageId: z.string().min(1),
            description: z.string().min(1, "请输入任务描述").max(200, "任务描述最多 200 字"),
            type: z.string().min(1, "请输入任务类型").max(20, "任务类型最多 20 个字符"),
            order: z.number().int().min(1).optional(),
          })
        )
        .mutation(async ({ ctx, input }) => {
          const stage = await ctx.prisma.stage.findUnique({
            where: { id: input.stageId },
            include: { roadmap: { select: { userId: true } } },
          });
          if (!stage || stage.roadmap.userId !== ctx.userId) {
            throw new TRPCError({ code: "NOT_FOUND", message: "阶段不存在" });
          }
          const last = await ctx.prisma.task.findFirst({
            where: { stageId: input.stageId },
            orderBy: { order: "desc" },
            select: { order: true },
          });
          const row = await ctx.prisma.task.create({
            data: {
              stageId: input.stageId,
              description: input.description,
              type: input.type,
              order: input.order ?? (last ? last.order + 1 : 1),
            },
          });
          return { id: row.id, order: row.order };
        }),

      // 任务三态切换(服务端持久化,3.1 数据层 / 3.5 交互闭环共用)
      updateStatus: protectedProcedure
        .input(
          z.object({
            taskId: z.string().min(1),
            status: z.enum(["pending", "in_progress", "completed"], {
              errorMap: () => ({ message: "任务状态不正确" }),
            }),
          })
        )
        .mutation(async ({ ctx, input }) => {
          await requireOwnedTask(ctx, input.taskId);
          const row = await ctx.prisma.task.update({
            where: { id: input.taskId },
            data: { status: input.status },
          });
          return { id: row.id, status: row.status };
        }),
    }),
  }),

  // 简历数据层(4.1):文件上传走 /api/resume/upload(自鉴权 Route Handler);解析/改写/评分管线 4.3 起接入
  resume: t.router({
    // 当前用户最新一份简历(元信息 + 解析结果 + 最新优化版本,防御解析);从未上传 → null
    get: protectedProcedure.query(async ({ ctx }) => {
      const row = await ctx.prisma.resume.findFirst({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          extractError: true,
          createdAt: true,
          parsedData: true,
          originalText: true,
        },
      });
      if (!row) return null;
      const { parsedData, originalText, ...meta } = row;
      const versionRow = await ctx.prisma.resumeVersion.findFirst({
        where: { resumeId: row.id },
        orderBy: { createdAt: "desc" },
        include: { optimizations: { orderBy: { order: "asc" } } },
      });
      return {
        ...meta,
        parsedData: parseParsedData(parsedData),
        version: serializeVersion(versionRow, originalText),
      };
    }),

    // 简历文件列表(设置页「简历文件管理」):仅元信息,下载走 /api/resume/download
    list: protectedProcedure.query(async ({ ctx }) => {
      return ctx.prisma.resume.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          extractError: true,
          createdAt: true,
        },
      });
    }),

    // 粘贴创建简历(4.1,PRD 3.3.3 粘贴路径):无文件建行;与上传一致,每次粘贴新增一行
    createFromText: protectedProcedure
      .input(
        z.object({
          text: z
            .string()
            .min(10, "简历内容至少 10 个字符")
            .max(20000, "简历内容最多 20000 字"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const row = await ctx.prisma.resume.create({
          data: { userId: ctx.userId, originalText: input.text.trim() },
        });
        return { id: row.id };
      }),

    // 提取失败后粘贴补全(4.2):写入原文并清除 extractError;清空旧解析结果防残留
    pasteText: protectedProcedure
      .input(
        z.object({
          resumeId: z.string().min(1),
          text: z
            .string()
            .min(10, "简历内容至少 10 个字符")
            .max(20000, "简历内容最多 20000 字"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedResume(ctx, input.resumeId);
        const row = await ctx.prisma.resume.update({
          where: { id: input.resumeId },
          data: {
            originalText: input.text.trim(),
            extractError: null,
            parsedData: Prisma.DbNull,
          },
        });
        return { id: row.id };
      }),

    // 解析简历(4.3):提取原文交给 Parse Agent,成功后写 parsedData;进度经 latestRun 轮询
    parse: protectedProcedure
      .input(z.object({ resumeId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const resume = await requireOwnedResume(ctx, input.resumeId);
        if (!resume.originalText) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "简历原文缺失,请重新上传或粘贴简历内容",
          });
        }
        const outcome = await parseResume({
          userId: ctx.userId,
          resumeId: resume.id,
          resumeText: resume.originalText,
        });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return { runId: outcome.runId };
      }),

    // 解析失败重试(4.3):从最近一次失败 run 的 input 重放(刷新后数据仍在服务端)
    retryParse: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const run = await ctx.prisma.agentRun.findUnique({ where: { id: input.runId } });
        if (!run || run.userId !== ctx.userId || run.intent !== "parse-resume") {
          throw new TRPCError({ code: "NOT_FOUND", message: "解析任务不存在" });
        }
        const parsed = resumeParseAgentInputSchema
          .extend({ resumeId: z.string().min(1) })
          .safeParse(run.input);
        if (!parsed.success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "无法重试该任务,请重新上传或粘贴简历内容",
          });
        }
        await requireOwnedResume(ctx, parsed.data.resumeId); // 简历已删除 → NOT_FOUND
        const outcome = await parseResume({
          userId: ctx.userId,
          resumeId: parsed.data.resumeId,
          resumeText: parsed.data.resumeText,
        });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return { runId: outcome.runId };
      }),

    // 保存核对修正后的解析结果(4.3):用户在核对表单修正后覆盖保存
    saveParsedData: protectedProcedure
      .input(z.object({ resumeId: z.string().min(1), parsedData: parsedResumeSchema }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedResume(ctx, input.resumeId);
        await ctx.prisma.resume.update({
          where: { id: input.resumeId },
          data: { parsedData: input.parsedData as Prisma.InputJsonValue },
        });
        return { ok: true };
      }),

    // 生成修改建议(4.4):核对后解析结果 + 画像能力标签 + 目标方向 → 新建不可变版本(3-8 条建议,状态 pending)
    rewrite: protectedProcedure
      .input(
        z.object({
          resumeId: z.string().min(1),
          parsedData: parsedResumeSchema,
          targetDirection: z.string().min(1, "目标方向不能为空").max(30),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const resume = await requireOwnedResume(ctx, input.resumeId);
        if (!resume.originalText) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "简历原文缺失,请重新上传或粘贴简历内容",
          });
        }
        const abilityTags = await readAbilityTags(ctx);
        const outcome = await rewriteResume({
          userId: ctx.userId,
          resumeId: resume.id,
          parsedData: input.parsedData,
          abilityTags,
          targetDirection: input.targetDirection,
        });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return { versionId: outcome.versionId, runId: outcome.runId };
      }),

    // 单条修改建议状态(4.5):pending/accepted/rejected 三态切换(接受/拒绝/撤销),归属链校验
    updateOptimization: protectedProcedure
      .input(
        z.object({
          optimizationId: z.string().min(1),
          status: z.enum(["pending", "accepted", "rejected"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await requireOwnedOptimization(ctx, input.optimizationId);
        const row = await ctx.prisma.optimization.update({
          where: { id: input.optimizationId },
          data: { status: input.status },
        });
        return { id: row.id, status: row.status };
      }),

    // 全部接受(4.5):用户显式操作,整版置为 accepted(最终采纳文本由 accepted 片段合成)
    acceptAll: protectedProcedure
      .input(z.object({ versionId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        await requireOwnedVersion(ctx, input.versionId);
        await ctx.prisma.optimization.updateMany({
          where: { resumeVersionId: input.versionId },
          data: { status: "accepted" },
        });
        return { ok: true };
      }),

    // ATS 评分(4.6):显式按钮触发(用户拍板决策);服务端由 accepted 片段合成最终文本(单一事实源)→ 规则分 + LLM 分项合成落库
    scoreAts: protectedProcedure
      .input(z.object({ versionId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const version = await requireOwnedVersion(ctx, input.versionId);
        const resume = await ctx.prisma.resume.findFirst({
          where: { id: version.resumeId },
          select: { originalText: true },
        });
        if (!resume?.originalText) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "简历原文缺失,请重新上传或粘贴简历内容",
          });
        }
        if (!version.targetDirection) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "优化版本缺少目标方向,请重新分析",
          });
        }
        const optimizations = await ctx.prisma.optimization.findMany({
          where: { resumeVersionId: version.id },
          orderBy: { order: "asc" },
        });
        // 文本列在 Prisma 类型上可空,但落库路径(schema min(1))保证非空;防御过滤
        const finalText = buildFinalResumeText(
          resume.originalText,
          optimizations.filter(
            (o): o is typeof o & OptimizationText =>
              o.originalText !== null && o.optimizedText !== null
          )
        );
        const outcome = await scoreAts({
          userId: ctx.userId,
          versionId: version.id,
          finalText,
          targetDirection: version.targetDirection,
        });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return {
          versionId: version.id,
          total: outcome.report.total,
          level: outcome.report.level,
          runId: outcome.runId,
        };
      }),

    // 最近一次简历任务 run(4.3):页面轮询(700ms)与刷新恢复的统一入口;按 intent 参数化,与画像/路线图 latestRun 同构
    latestRun: protectedProcedure
      .input(z.object({ intent: z.enum(["parse-resume", "rewrite-resume", "score-ats"]) }))
      .query(async ({ ctx, input }) => {
        const run = await ctx.prisma.agentRun.findFirst({
          where: { userId: ctx.userId, intent: input.intent },
          orderBy: { createdAt: "desc" },
        });
        return run ? serializeRun(run) : null;
      }),

    // 删除简历(4.1):先删 DB 行(版本/修改级联),再删存储文件(幂等,失败不阻断删除结果)
    delete: protectedProcedure
      .input(z.object({ id: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const resume = await requireOwnedResume(ctx, input.id);
        await ctx.prisma.resume.delete({ where: { id: input.id } });
        if (resume.storageKey) {
          await getFileStorage().delete(resume.storageKey).catch(() => undefined);
        }
        return { ok: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// 服务端直连 caller(SSR / 接口测试用,不经过 HTTP 层)
export const createCaller = t.createCallerFactory(appRouter);
