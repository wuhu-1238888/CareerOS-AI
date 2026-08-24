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
import { runMatch } from "@/lib/matching/pipeline";
import { matchAnalysisSchema } from "@/lib/matching/analysis-schemas";
import { matchingAgentInputSchema } from "@/lib/agents/matching.agent";
import { runCoachPlan, coachRequirementsFromReport } from "@/lib/coach/pipeline";
import { coachPlanSchema } from "@/lib/coach/analysis-schemas";
import { coachAgentInputSchema } from "@/lib/agents/coach.agent";
import {
  runInterviewQuestions,
  runEvaluateAnswer,
  evaluateStoredAnswer,
  runFollowUpAnswer,
  runInterviewReport,
  parseStoredQuestions,
  parseStoredAnswers,
} from "@/lib/interview/pipeline";
import {
  interviewTypeSchema,
  interviewQuestionCountSchema,
  interviewReportSchema,
} from "@/lib/interview/analysis-schemas";
import { interviewQuestionAgentInputSchema } from "@/lib/agents/interview-question.agent";
import { interviewEvaluatorAgentInputSchema } from "@/lib/agents/interview-evaluator.agent";
import { interviewReportAgentInputSchema } from "@/lib/agents/interview-report.agent";
import { parseParsedData, parseResume, rewriteResume, scoreAts } from "@/lib/resume/pipeline";
import { buildFinalTextForVersion } from "@/lib/resume/final-text";
import { parsedResumeSchema } from "@/lib/resume/analysis-schemas";
import { buildSectionPlan, detectSections, parseStoredSections } from "@/lib/resume/section-order";
import { resumeParseAgentInputSchema } from "@/lib/agents/resume.agent";
import { extractRunInputString } from "@/lib/agents/run-input";
import { RUN_STALE_MS } from "@/lib/orchestration/orchestrator";
import { computeDashboardStats } from "@/lib/dashboard/stats";
import { evaluateLinkageRules } from "@/lib/linkage/rules";

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
    // canonical finalText 单一构造入口(4.10-layout):预览/复制/PDF 导出与 ATS 评分同源
    finalText: originalText ? buildFinalTextForVersion(originalText, version.optimizations) : null,
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

// JobMatch 行序列化(6.2):matchReport 与 coachPlan(6.4 起)均经输出 Schema 防御解析(损坏回退 null);
// jdTitle 供技能分析表单预填目标岗位
function serializeJobMatch(
  row: {
    jdText: string | null;
    jdTitle: string | null;
    matchReport: unknown;
    coachPlan: unknown;
    weeklyHours: number | null;
    updatedAt: Date;
  } | null
) {
  if (!row) return null;
  return {
    jdText: row.jdText,
    jdTitle: row.jdTitle,
    matchReport: matchAnalysisSchema.safeParse(row.matchReport).success ? row.matchReport : null,
    coachPlan: coachPlanSchema.safeParse(row.coachPlan).success ? row.coachPlan : null,
    weeklyHours: row.weeklyHours,
    updatedAt: row.updatedAt,
  };
}

// InterviewSession 行序列化(7.1):questions/answers/report 均经输出 Schema 防御解析
// (损坏回退 null → 前端按无有效场次处理,镜像 serializeJobMatch 先例);
// report 返回解析后的值(InterviewReport | null,前端免二次断言);
// interviewType/questionCount/status 为服务端写入时已校验的标量,原样透传。
function serializeInterviewSession(
  row: {
    interviewType: string;
    questionCount: number;
    targetPosition: string;
    status: string;
    questions: unknown;
    currentQuestionIndex: number;
    answers: unknown;
    report: unknown;
    updatedAt: Date;
  } | null
) {
  if (!row) return null;
  const parsedReport = interviewReportSchema.safeParse(row.report);
  return {
    interviewType: row.interviewType,
    questionCount: row.questionCount,
    targetPosition: row.targetPosition,
    status: row.status,
    questions: parseStoredQuestions(row.questions),
    currentQuestionIndex: row.currentQuestionIndex,
    answers: parseStoredAnswers(row.answers),
    report: parsedReport.success ? parsedReport.data : null,
    updatedAt: row.updatedAt,
  };
}

// 匹配输入组装(6.2,服务端聚合,客户端只传 JD):
// 画像摘要 = 最新画像 aiAnalysis 的摘要/能力/雷达/方向(截断 3000 字符,输入 Schema 上限);
// 简历文本 = 最新简历最新版本的 canonical finalText(无 accepted 时即原文,仍为有效证据)
async function readProfileSummaryForMatch(ctx: { prisma: Context["prisma"]; userId: string }) {
  const profile = await ctx.prisma.careerProfile.findFirst({
    where: { userId: ctx.userId },
    orderBy: { version: "desc" },
    select: { aiAnalysis: true },
  });
  const raw = profile?.aiAnalysis as
    | { summary?: unknown; abilityTags?: unknown; radar?: unknown; directions?: unknown }
    | null;
  if (!raw || typeof raw !== "object") return null;
  const compact = {
    summary: raw.summary,
    abilityTags: raw.abilityTags,
    radar: raw.radar,
    directions: raw.directions,
  };
  if (Object.values(compact).every((v) => v == null)) return null;
  return JSON.stringify(compact, null, 2).slice(0, 3000);
}

async function readOptimizedResumeTextForMatch(ctx: { prisma: Context["prisma"]; userId: string }) {
  const resume = await ctx.prisma.resume.findFirst({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, originalText: true },
  });
  if (!resume?.originalText) return null;
  const version = await ctx.prisma.resumeVersion.findFirst({
    where: { resumeId: resume.id },
    orderBy: { createdAt: "desc" },
    include: { optimizations: { orderBy: { order: "asc" } } },
  });
  if (!version) return null;
  return buildFinalTextForVersion(resume.originalText, version.optimizations);
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

// AgentRun 状态序列化(2.4):running 超过阈值视为中断(服务端进程被杀),返回失败态供重试;
// 2026-08 修订:阈值 = LLM 超时 + 1 分钟余量。此前固定 2 分钟会把正常的长 LLM 任务(最长 LLM_TIMEOUT_MS)
// 误报为「分析中断」(真实任务仍在跑、随后成功)——显示态与真实状态脱节。健康 run 的 updatedAt 停更间隙
// 不会超过 LLM_TIMEOUT_MS(超时即落 failed),因此「超过本阈值仍 running」只可能是进程死亡。
// 本次修订:从 run.input 防御解析 resumeId/targetDirection 透出(简历页按简历行归属判断/失败后回填目标方向;其他模块不受影响)
// RUN_STALE_MS 已单源化至 src/lib/orchestration/orchestrator.ts(面试管线 in-flight 互斥共用同一口径)

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

// extractRunInputString 已移至共享模块 src/lib/agents/run-input.ts(工作台 stats 与 serializeRun 共用)

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
            data: {
              status: input.status,
              // 5.1:完成时间仅随状态维护(工作台「本周任务」KPI 依据);离开 completed 即清空
              completedAt: input.status === "completed" ? new Date() : null,
            },
          });
          return { id: row.id, status: row.status };
        }),
    }),
  }),

  // 简历数据层(4.1):文件上传走 /api/resume/upload(自鉴权 Route Handler);解析/改写/评分管线 4.3 起接入
  resume: t.router({
    // 当前简历(4.12):可选 resumeId 指定活跃简历(URL 参数,设置页「查看」);未传/越权/已删 → 最新一份;从未上传 → null
    get: protectedProcedure
      .input(z.object({ resumeId: z.string().optional() }).optional()) // 整体可选:无参调用 = 最新行(向后兼容)
      .query(async ({ ctx, input }) => {
        const select = {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          extractError: true,
          createdAt: true,
          parsedData: true,
          originalText: true,
          sectionOrder: true,
        } as const;
        const byId = input?.resumeId
          ? await ctx.prisma.resume.findFirst({
              where: { id: input.resumeId, userId: ctx.userId },
              select,
            })
          : null;
        const row =
          byId ??
          (await ctx.prisma.resume.findFirst({
            where: { userId: ctx.userId },
            orderBy: { createdAt: "desc" },
            select,
          }));
        if (!row) return null;
        const { parsedData, originalText, sectionOrder, ...meta } = row;
        const versionRow = await ctx.prisma.resumeVersion.findFirst({
          where: { resumeId: row.id },
          orderBy: { createdAt: "desc" },
          include: { optimizations: { orderBy: { order: "asc" } } },
        });
        // 模块顺序计划(4.10):表单渲染与最终文本统一遵循用户原文顺序;
        // sectionOrder 落库快照优先,非法/缺失时按原文现场重算(读取时派生,无异步乱序)
        const sectionPlan = originalText
          ? buildSectionPlan(originalText, parseParsedData(parsedData) ?? null, parseStoredSections(sectionOrder))
          : null;
        return {
          ...meta,
          parsedData: parseParsedData(parsedData),
          sectionPlan,
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
        const text = input.text.trim();
        const row = await ctx.prisma.resume.create({
          data: {
            userId: ctx.userId,
            originalText: text,
            // 模块顺序快照(4.10):粘贴路径同样入库,表单按原文顺序渲染
            sectionOrder: detectSections(text) as unknown as Prisma.InputJsonValue,
          },
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
        const text = input.text.trim();
        const row = await ctx.prisma.resume.update({
          where: { id: input.resumeId },
          data: {
            originalText: text,
            // 补全新原文时重写模块顺序快照(与原文一致,防旧快照错位)
            sectionOrder: detectSections(text) as unknown as Prisma.InputJsonValue,
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
        // ATS 分析的正是「最终文本预览」的 canonical finalText(同一构造入口,4.10-layout)
        const finalText = buildFinalTextForVersion(resume.originalText, optimizations);
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

    // 简历优化版本列表(6.6):仅版本元信息(时间降序,最新在前);「第 N 版」编号由客户端按列表倒序派生(无 version 列)
    listVersions: protectedProcedure
      .input(z.object({ resumeId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        await requireOwnedResume(ctx, input.resumeId);
        return ctx.prisma.resumeVersion.findMany({
          where: { resumeId: input.resumeId },
          orderBy: { createdAt: "desc" },
          select: { id: true, targetDirection: true, atsScore: true, createdAt: true },
        });
      }),

    // 查看指定优化版本(6.6):复用 serializeVersion(含 canonical finalText,复制/导出同源);越权 → NOT_FOUND
    getVersion: protectedProcedure
      .input(z.object({ versionId: z.string().min(1) }))
      .query(async ({ ctx, input }) => {
        const version = await requireOwnedVersion(ctx, input.versionId);
        const [optimizations, resume] = await Promise.all([
          ctx.prisma.optimization.findMany({
            where: { resumeVersionId: version.id },
            orderBy: { order: "asc" },
          }),
          ctx.prisma.resume.findUnique({
            where: { id: version.resumeId },
            select: { originalText: true },
          }),
        ]);
        return serializeVersion({ ...version, optimizations }, resume?.originalText ?? null);
      }),

    // 复制为新版本(6.6):深拷贝目标方向 + 变更摘要 + 全部建议(状态原样);ATS 三列不复制(新版本需重新评分)
    duplicateVersion: protectedProcedure
      .input(z.object({ versionId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const version = await requireOwnedVersion(ctx, input.versionId);
        const optimizations = await ctx.prisma.optimization.findMany({
          where: { resumeVersionId: version.id },
          orderBy: { order: "asc" },
        });
        const duplicate = await ctx.prisma.resumeVersion.create({
          data: {
            resumeId: version.resumeId,
            targetDirection: version.targetDirection,
            changes: version.changes as Prisma.InputJsonValue,
            optimizations: {
              create: optimizations.map((o) => ({
                category: o.category,
                originalText: o.originalText,
                optimizedText: o.optimizedText,
                reason: o.reason,
                order: o.order,
                status: o.status, // 状态原样复制(计划 6.6 决策:采纳状态随版本延续)
              })),
            },
          },
        });
        return { versionId: duplicate.id };
      }),

    // 删除优化版本(6.6):至少保留一个版本;级联删建议(Optimization),简历行与原文不动
    deleteVersion: protectedProcedure
      .input(z.object({ versionId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const version = await requireOwnedVersion(ctx, input.versionId);
        const remaining = await ctx.prisma.resumeVersion.count({
          where: { resumeId: version.resumeId },
        });
        if (remaining <= 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "至少保留一个优化版本" });
        }
        await ctx.prisma.resumeVersion.delete({ where: { id: version.id } });
        return { ok: true };
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

    // 简历导出埋点(5.3):复制最终文本 / 下载 PDF 时记 FunnelEvent(resume-export),供漏斗指标统计。
    // 失败不阻断导出(埋点是观测旁路,导出成功与否以用户操作为准)。
    logExport: protectedProcedure.mutation(async ({ ctx }) => {
      await ctx.prisma.funnelEvent.create({ data: { userId: ctx.userId, event: "resume-export" } });
      return { ok: true };
    }),
  }),

  // 岗位匹配(6.2):JobMatch 每用户一行;匹配报告与教练计划(6.4)由两条独立管线按列 upsert。
  // 输入组装(画像摘要/简历文本)全在服务端,客户端只传 JD 与纠偏反馈。
  matching: t.router({
    // 当前用户的匹配记录(匹配报告 + 教练计划);从未匹配 → null
    get: protectedProcedure.query(async ({ ctx }) => {
      const row = await ctx.prisma.jobMatch.findUnique({ where: { userId: ctx.userId } });
      return serializeJobMatch(row);
    }),

    // 开始/重新匹配(6.2):服务端读最新画像与简历组装输入 → Matching Agent → 按列 upsert
    run: protectedProcedure
      .input(
        z.object({
          jdText: z.string().min(1, "请粘贴岗位描述").max(8000, "JD 最多 8000 字"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const profileSummary = await readProfileSummaryForMatch(ctx);
        const optimizedResumeText = await readOptimizedResumeTextForMatch(ctx);
        const outcome = await runMatch({
          userId: ctx.userId,
          jdText: input.jdText.trim(),
          profileSummary,
          optimizedResumeText,
        });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return { runId: outcome.runId };
      }),

    // 纠偏重匹配(6.2)「这个要求我其实满足」:读落库 JD 原文 + 定向反馈重新匹配
    correct: protectedProcedure
      .input(
        z.object({
          requirementId: z.string().min(1).max(20),
          note: z.string().min(1, "请说明你的情况").max(200, "说明最多 200 字"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const row = await ctx.prisma.jobMatch.findUnique({ where: { userId: ctx.userId } });
        if (!row?.jdText) {
          throw new TRPCError({ code: "NOT_FOUND", message: "请先完成岗位匹配" });
        }
        // requirementId 必须存在于当前报告(防纠偏指向已失效条目)
        const report = matchAnalysisSchema.safeParse(row.matchReport);
        if (!report.success || !report.data.requirements.some((r) => r.id === input.requirementId)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "该岗位要求已失效,请重新匹配" });
        }
        const profileSummary = await readProfileSummaryForMatch(ctx);
        const optimizedResumeText = await readOptimizedResumeTextForMatch(ctx);
        const outcome = await runMatch({
          userId: ctx.userId,
          jdText: row.jdText,
          profileSummary,
          optimizedResumeText,
          feedback: [{ requirementId: input.requirementId, note: input.note }],
        });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return { runId: outcome.runId };
      }),

    // 生成 90 天提升计划(6.4):服务端从匹配报告组装教练输入——差距清单(coachRequirementsFromReport:
    // name/importance 原样带出,status→gap 映射,无对比条目的要求跳过)+ 最新画像能力标签;
    // 客户端只传目标岗位/每周投入/学习偏好(「一键发起」数据自动带出)。
    coach: protectedProcedure
      .input(
        z.object({
          targetPosition: z.string().min(1, "请填写目标岗位").max(50, "目标岗位最多 50 字"),
          weeklyHours: z.number().int("每周投入须为整数").min(1, "每周投入至少 1 小时").max(80, "每周投入最多 80 小时"),
          learningPreference: z.string().max(200, "学习偏好最多 200 字").optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const row = await ctx.prisma.jobMatch.findUnique({ where: { userId: ctx.userId } });
        if (!row?.matchReport) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "请先完成岗位匹配" });
        }
        const report = matchAnalysisSchema.safeParse(row.matchReport);
        if (!report.success) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "匹配报告已失效,请重新匹配" });
        }
        const requirements = coachRequirementsFromReport(report.data);
        if (requirements.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "匹配报告缺少能力对比项,请重新匹配" });
        }
        const abilityTags = await readAbilityTags(ctx);
        const outcome = await runCoachPlan({
          userId: ctx.userId,
          input: {
            targetPosition: input.targetPosition.trim(),
            requirements,
            abilityBaseline: { abilityTags },
            weeklyHours: input.weeklyHours,
            learningPreference: input.learningPreference?.trim() || undefined,
          },
        });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return { runId: outcome.runId };
      }),

    // 失败重试(6.2):从 run.input 重放,按 intent 双路(analyze-match / build-coach-plan,后者 6.4 接入)
    retry: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const run = await ctx.prisma.agentRun.findUnique({ where: { id: input.runId } });
        if (!run || run.userId !== ctx.userId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "分析任务不存在" });
        }
        if (run.intent === "analyze-match") {
          const parsed = matchingAgentInputSchema.safeParse(run.input);
          if (!parsed.success) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "无法重试该任务,请重新粘贴岗位描述" });
          }
          const outcome = await runMatch({ userId: ctx.userId, ...parsed.data });
          if (!outcome.ok) {
            throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
          }
          return { runId: outcome.runId };
        }
        // 6.4:教练 run 重放(输入为服务端组装对象,直接经输入 Schema 校验回放)
        if (run.intent === "build-coach-plan") {
          const parsed = coachAgentInputSchema.safeParse(run.input);
          if (!parsed.success) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "无法重试该任务,请重新生成提升计划" });
          }
          const outcome = await runCoachPlan({ userId: ctx.userId, input: parsed.data });
          if (!outcome.ok) {
            throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
          }
          return { runId: outcome.runId };
        }
        throw new TRPCError({ code: "NOT_FOUND", message: "分析任务不存在" });
      }),

    // 最近一次匹配/教练 run(6.2):页面轮询(700ms)与刷新恢复的统一入口;按 intent 隔离(与画像/简历同构)
    latestRun: protectedProcedure
      .input(z.object({ intent: z.enum(["analyze-match", "build-coach-plan"]) }))
      .query(async ({ ctx, input }) => {
        const run = await ctx.prisma.agentRun.findFirst({
          where: { userId: ctx.userId, intent: input.intent },
          orderBy: { createdAt: "desc" },
        });
        return run ? serializeRun(run) : null;
      }),
  }),

  // 模拟面试(7.1 出题 / 7.2 对话 / 7.3 报告):InterviewSession 每用户一行,对话消息为派生数据
  // (questions/answers/report 单行 JSON)。输入组装(简历文本/画像摘要)全在服务端,客户端只传
  // 面试类型/档位/目标岗位;start = 覆盖式新建场次(单行模型必然,前端有进行中场次时先确认)。
  interview: t.router({
    // 当前用户的面试场次(题目/作答/报告);从未开始 → null
    get: protectedProcedure.query(async ({ ctx }) => {
      const row = await ctx.prisma.interviewSession.findUnique({ where: { userId: ctx.userId } });
      return serializeInterviewSession(row);
    }),

    // 开始面试(7.1):服务端读最新简历 canonical finalText 与画像摘要组装输入 → 出题 Agent →
    // 题数 echo 校验 → 覆盖式 upsert(重置作答/进度/报告)
    start: protectedProcedure
      .input(
        z.object({
          interviewType: interviewTypeSchema,
          questionCount: interviewQuestionCountSchema,
          targetPosition: z.string().min(1, "请填写目标岗位").max(100, "目标岗位最多 100 字"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const resumeText = await readOptimizedResumeTextForMatch(ctx);
        if (!resumeText) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "请先在简历中心上传简历" });
        }
        const profileSummary = await readProfileSummaryForMatch(ctx);
        const outcome = await runInterviewQuestions({
          userId: ctx.userId,
          input: {
            resumeText: resumeText.slice(0, 8000),
            targetPosition: input.targetPosition.trim(),
            interviewType: input.interviewType,
            questionCount: input.questionCount,
            profileSummary,
          },
        });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        return { runId: outcome.runId };
      }),

    // 提交答案并评估(7.2):答案先落库、评估失败时答案保留(evaluation=null,前端 evaluate 重试);
    // 返回更新后的场次(前端以返回值渲染,失败时 catch 后重读 get 同步)
    submitAnswer: protectedProcedure
      .input(
        z.object({ answer: z.string().trim().min(1, "回答不能为空").max(2000, "回答最多 2000 字") })
      )
      .mutation(async ({ ctx, input }) => {
        const outcome = await runEvaluateAnswer({ userId: ctx.userId, answer: input.answer });
        if (!outcome.ok) {
          // CONFLICT(评估在途)→ HTTP 409,前端 friendlyError 直接显示中文文案
          throw new TRPCError({ code: outcome.code ?? "BAD_GATEWAY", message: outcome.error });
        }
        const row = await ctx.prisma.interviewSession.findUnique({ where: { userId: ctx.userId } });
        return serializeInterviewSession(row);
      }),

    // 评估重试(7.2):评估失败(evaluation=null)时对当前题已存答案重跑评估,不重复提交答案
    evaluate: protectedProcedure
      .input(z.object({ questionIndex: z.number().int().min(0, "题目序号非法").max(14, "题目序号非法") }))
      .mutation(async ({ ctx, input }) => {
        const outcome = await evaluateStoredAnswer({ userId: ctx.userId, questionIndex: input.questionIndex });
        if (!outcome.ok) {
          // CONFLICT(评估在途)→ HTTP 409,前端 friendlyError 直接显示中文文案
          throw new TRPCError({ code: outcome.code ?? "BAD_GATEWAY", message: outcome.error });
        }
        const row = await ctx.prisma.interviewSession.findUnique({ where: { userId: ctx.userId } });
        return serializeInterviewSession(row);
      }),

    // 提交追问回答(7.2):不触发 LLM;回答后进入下一题
    submitFollowUp: protectedProcedure
      .input(
        z.object({
          followUpAnswer: z.string().trim().min(1, "回答不能为空").max(2000, "回答最多 2000 字"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const outcome = await runFollowUpAnswer({
          userId: ctx.userId,
          followUpAnswer: input.followUpAnswer,
        });
        if (!outcome.ok) {
          throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
        }
        const row = await ctx.prisma.interviewSession.findUnique({ where: { userId: ctx.userId } });
        return serializeInterviewSession(row);
      }),

    // 跳过追问(7.2):追问回答置 null + 进入下一题
    skipFollowUp: protectedProcedure.mutation(async ({ ctx }) => {
      const outcome = await runFollowUpAnswer({ userId: ctx.userId, followUpAnswer: null });
      if (!outcome.ok) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
      }
      const row = await ctx.prisma.interviewSession.findUnique({ where: { userId: ctx.userId } });
      return serializeInterviewSession(row);
    }),

    // 结束面试并生成综合报告(7.3):至少 1 题已评估(未答/未评估题不计入,允许提前结束);
    // 报告 Agent 产出定性四要素,均分由前端确定性计算。返回更新后的场次(含 report)
    finish: protectedProcedure.mutation(async ({ ctx }) => {
      // 双保险前置校验:无已评估题 → BAD_REQUEST(管线内部同样校验)
      const row = await ctx.prisma.interviewSession.findUnique({ where: { userId: ctx.userId } });
      const evaluatedCount = row
        ? (parseStoredAnswers(row.answers) ?? []).filter((a) => a.evaluation).length
        : 0;
      if (evaluatedCount === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "至少完成一道题才能生成综合报告" });
      }
      const outcome = await runInterviewReport({ userId: ctx.userId });
      if (!outcome.ok) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
      }
      const fresh = await ctx.prisma.interviewSession.findUnique({ where: { userId: ctx.userId } });
      // 2026-08:附带 runId——复用既有 running 报告 run 时场次仍 in_progress,前端据 runId 收敛与失败透出
      return { session: serializeInterviewSession(fresh), runId: outcome.runId };
    }),

    // 失败重试(7.1):从 run.input 重放(输入含场次简历快照,简历后续变更不影响重放);
    // 7.2 接入评估 intent(重放时重读 session 该题当前答案重评);7.3 接入报告 intent
    retry: protectedProcedure
      .input(z.object({ runId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const run = await ctx.prisma.agentRun.findUnique({ where: { id: input.runId } });
        if (!run || run.userId !== ctx.userId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "分析任务不存在" });
        }
        if (run.intent === "generate-interview-questions") {
          const parsed = interviewQuestionAgentInputSchema.safeParse(run.input);
          if (!parsed.success) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "无法重试该任务,请重新开始面试" });
          }
          const outcome = await runInterviewQuestions({ userId: ctx.userId, input: parsed.data });
          if (!outcome.ok) {
            throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
          }
          return { runId: outcome.runId };
        }
        if (run.intent === "evaluate-interview-answer") {
          const parsed = interviewEvaluatorAgentInputSchema.safeParse(run.input);
          if (!parsed.success) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "无法重试该任务,请重新开始面试" });
          }
          // 重放时重读 session 该题当前答案重评(用户可能已重新提交答案,run.input.answer 已过期)
          const row = await ctx.prisma.interviewSession.findUnique({ where: { userId: ctx.userId } });
          const questions = row ? parseStoredQuestions(row.questions) : null;
          if (!questions) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "无法重试该任务,请重新开始面试" });
          }
          const questionIndex = questions.findIndex((q) => q.id === parsed.data.question.id);
          if (questionIndex === -1) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "无法重试该任务,请重新开始面试" });
          }
          const outcome = await evaluateStoredAnswer({ userId: ctx.userId, questionIndex });
          if (!outcome.ok) {
            // CONFLICT(评估在途)→ HTTP 409,前端 friendlyError 直接显示中文文案
            throw new TRPCError({ code: outcome.code ?? "BAD_GATEWAY", message: outcome.error });
          }
          return { runId: outcome.runId };
        }
        if (run.intent === "generate-interview-report") {
          const parsed = interviewReportAgentInputSchema.safeParse(run.input);
          if (!parsed.success) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "无法重试该任务,请重新开始面试" });
          }
          // 重放 = 按当前场次的已评估题重新组装摘要重跑报告(run.input.summary 仅作输入合法性门,
          // 与评估重放同原则:场次状态优先于 run.input 快照)
          const outcome = await runInterviewReport({ userId: ctx.userId });
          if (!outcome.ok) {
            throw new TRPCError({ code: "BAD_GATEWAY", message: outcome.error });
          }
          return { runId: outcome.runId };
        }
        throw new TRPCError({ code: "NOT_FOUND", message: "分析任务不存在" });
      }),

    // 最近一次 run(7.1):页面轮询(2s)与刷新恢复的统一入口(镜像 matching.latestRun;
    // 7.2 扩展评估 intent;7.3 扩展报告 intent)
    latestRun: protectedProcedure
      .input(
        z.object({
          intent: z.enum([
            "generate-interview-questions",
            "evaluate-interview-answer",
            "generate-interview-report",
          ]),
        })
      )
      .query(async ({ ctx, input }) => {
        const run = await ctx.prisma.agentRun.findFirst({
          where: { userId: ctx.userId, intent: input.intent },
          orderBy: { createdAt: "desc" },
        });
        return run ? serializeRun(run) : null;
      }),
  }),

  // 工作台聚合(5.1):KPI 行 / Agent 顾问区 / 模块入口卡的单一数据源,纯读(见 src/lib/dashboard/stats.ts)
  dashboard: t.router({
    stats: protectedProcedure.query(async ({ ctx }) => computeDashboardStats(ctx.prisma, ctx.userId)),
  }),
  // 联动提示(8.1b/8.1c):三条联动规则的活跃提示、关闭去重、匹配/画像方向冲突裁决记录。
  // 规则评估是状态派生(linkage/rules.ts);dismiss 只记关闭动作(同 (kind, refVersion) 不再骚扰);
  // resolveDirection 按 (profileVersion, matchDirection) 幂等更新(同一冲突只问一次,agent-design 4.4)。
  linkage: t.router({
    rules: protectedProcedure.query(async ({ ctx }) => evaluateLinkageRules(ctx.prisma, ctx.userId)),
    resolution: protectedProcedure
      .input(
        z.object({
          profileVersion: z.number().int().min(1, "画像版本必须为正整数"),
          matchDirection: z.string().min(1, "匹配方向不能为空").max(50),
        })
      )
      .query(async ({ ctx, input }) => {
        const row = await ctx.prisma.directionResolution.findFirst({
          where: {
            userId: ctx.userId,
            profileVersion: input.profileVersion,
            matchDirection: input.matchDirection,
          },
          orderBy: { createdAt: "desc" },
        });
        return row
          ? {
              profileVersion: row.profileVersion,
              profileDirection: row.profileDirection,
              matchDirection: row.matchDirection,
              choice: row.choice,
              createdAt: row.createdAt.toISOString(),
            }
          : null;
      }),
    dismiss: protectedProcedure
      .input(
        z.object({
          kind: z.enum(["resume_project", "resume_outdated", "roadmap_outdated"]),
          refVersion: z.string().min(1, "提示版本不能为空").max(100),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await ctx.prisma.linkageHint.upsert({
          where: {
            userId_kind_refVersion: { userId: ctx.userId, kind: input.kind, refVersion: input.refVersion },
          },
          create: { userId: ctx.userId, kind: input.kind, refVersion: input.refVersion, dismissedAt: new Date() },
          update: { dismissedAt: new Date() },
        });
        return { ok: true };
      }),
    resolveDirection: protectedProcedure
      .input(
        z.object({
          profileVersion: z.number().int().min(1, "画像版本必须为正整数"),
          profileDirection: z.string().min(1, "画像方向不能为空").max(50),
          matchDirection: z.string().min(1, "匹配方向不能为空").max(50),
          choice: z.enum(["prefer_profile", "prefer_match", "keep_both"]),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const existing = await ctx.prisma.directionResolution.findFirst({
          where: { userId: ctx.userId, profileVersion: input.profileVersion, matchDirection: input.matchDirection },
        });
        const resolution = existing
          ? await ctx.prisma.directionResolution.update({
              where: { id: existing.id },
              data: { profileDirection: input.profileDirection, choice: input.choice },
            })
          : await ctx.prisma.directionResolution.create({
              data: {
                userId: ctx.userId,
                profileVersion: input.profileVersion,
                profileDirection: input.profileDirection,
                matchDirection: input.matchDirection,
                choice: input.choice,
              },
            });
        return { ok: true, choice: resolution.choice };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// 服务端直连 caller(SSR / 接口测试用,不经过 HTTP 层)
export const createCaller = t.createCallerFactory(appRouter);
