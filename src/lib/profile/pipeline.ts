// 画像分析管线(2.4):表单数据 → Orchestrator(Profile Agent)→ 新版本行 + 推荐方向重建。
// 关键决策:每次分析(首建/纠偏/更新)全量重算并产生新版本(version = max+1,parentVersion = 上一版本 id),
// 旧版本不可变、可查看(2.6/2.7 依赖);生命周期进度事件经 onRunProgress 实时写入 AgentRun.progress,
// 客户端轮询读取(分析中刷新页面可恢复)。
import type { Prisma } from "@prisma/client";
import { Orchestrator, orchestrator } from "@/lib/orchestration/orchestrator";
import * as contextBuilder from "@/lib/orchestration/context-builder";
import { prisma } from "@/lib/db/prisma";
import type { LLMAdapter } from "@/lib/llm/adapter";
import type { AgentProgress } from "@/lib/agents/types";
import type { ProfileAnalysis } from "@/lib/agents/profile.agent";
import type { ProfileData } from "./schemas";
import "@/lib/agents"; // 副作用:登记 Profile Agent(intent: analyze-profile)

export type CorrectionFeedback = {
  areas: ("direction" | "ability" | "strength")[];
  note?: string;
};

export type AnalyzeProfileOutcome =
  | { ok: true; profileId: string; version: number; runId: string; analysis: ProfileAnalysis }
  | { ok: false; error: string; runId: string };

export async function analyzeProfile(params: {
  userId: string;
  data: ProfileData;
  feedback?: CorrectionFeedback;
  /** 测试注入用;缺省走全局 llm(生产经 LLM_PROVIDER 切换) */
  adapter?: LLMAdapter;
}): Promise<AnalyzeProfileOutcome> {
  const { userId, data, feedback, adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  // 进度写库串行化:生命周期事件同步连发,读-改-写不排队会互相覆盖(丢事件)
  const progressChain = { current: Promise.resolve() };
  const outcome = await runner.run<ProfileAnalysis>({
    intent: "analyze-profile",
    input: { ...data, feedback },
    context: await contextBuilder.buildUserContext(prisma, userId, "career-profile-analyzer"),
    userId,
    onRunProgress: (runId, progress: AgentProgress) => {
      progressChain.current = progressChain.current.then(() => appendProgress(runId, progress));
    },
  });
  // 返回前等待进度全部落库(调用方随后查询能看到完整 5 条事件)
  await progressChain.current;

  if (!outcome.ok) {
    return outcome;
  }

  const { profileId, version } = await persistAnalysis({
    userId,
    data,
    analysis: outcome.result.data,
  });
  return { ok: true, profileId, version, runId: outcome.runId, analysis: outcome.result.data };
}

/**
 * 后台启动分析(2026-11 生产网关适配):创建 AgentRun 后立即返回,管线在容器进程内后台执行。
 * 背景:生产域名经 Cloudflare(100s 固定超时)前置,画像分析同步等待 LLM 最多 3 分钟,
 * 超时即被网关以 HTML 524 页截断,tRPC 客户端解析 HTML 抛「Unexpected token '<'」。
 * 客户端靠既有 latestRun 轮询(700ms)+ 失败重试 + stale 判死恢复,契约不变。
 * 失败(含分析成功但结果落库失败)一律落 run 终态,前端失败视图可重试;绝不 reject。
 */
export async function launchAnalyzeProfile(params: {
  userId: string;
  data: ProfileData;
  feedback?: CorrectionFeedback;
  /** 测试注入用;缺省走全局 llm(生产经 LLM_PROVIDER 切换) */
  adapter?: LLMAdapter;
}): Promise<{ runId: string; done: Promise<void> }> {
  const { userId, data, feedback, adapter } = params;
  const runner: Orchestrator = adapter ? new Orchestrator(prisma, adapter) : orchestrator;

  const progressChain = { current: Promise.resolve() };
  const { runId, done: runDone } = await runner.launch<ProfileAnalysis>({
    intent: "analyze-profile",
    input: { ...data, feedback },
    context: await contextBuilder.buildUserContext(prisma, userId, "career-profile-analyzer"),
    userId,
    onRunProgress: (runId, progress: AgentProgress) => {
      progressChain.current = progressChain.current.then(() => appendProgress(runId, progress));
    },
  });

  const done = runDone
    .then(async (outcome) => {
      await progressChain.current;
      if (!outcome.ok) return;
      try {
        await persistAnalysis({ userId, data, analysis: outcome.result.data });
      } catch (err) {
        // 分析成功但画像落库失败:标记 run 失败(前端失败视图可重试),避免用户停在「无结果」态
        console.error(`[profile] persist analysis failed for run ${runId}`, err);
        await prisma.agentRun.update({
          where: { id: runId },
          data: { status: "failed", error: "分析结果保存失败,请重试" },
        });
      }
    })
    .catch((err) => {
      // 基础设施级异常兜底:run 无法落终态时由 serializeRun 的 stale 判死兜底(「分析中断,请重试」)
      console.error(`[profile] background analysis ${runId} crashed`, err);
    });

  return { runId, done };
}

/** 分析结果落库:新版本行 + 推荐方向整体重建(同步 analyzeProfile 与后台 launch 共用) */
async function persistAnalysis(params: {
  userId: string;
  data: ProfileData;
  analysis: ProfileAnalysis;
}): Promise<{ profileId: string; version: number }> {
  const { userId, data, analysis } = params;

  const previous = await prisma.careerProfile.findFirst({
    where: { userId },
    orderBy: { version: "desc" },
  });
  const version = (previous?.version ?? 0) + 1;

  const profile = await prisma.careerProfile.create({
    data: {
      userId,
      version,
      parentVersion: previous?.version ?? null,
      education: data.education,
      skills: data.skills,
      experiences: data.experiences,
      interests: data.interests,
      targets: data.targets,
      aiAnalysis: analysis,
    },
  });

  // 推荐方向全量重建(每次分析整体替换,非增量 —— implementation-plan 2.6 已确认)
  await prisma.careerPath.deleteMany({ where: { profileId: profile.id } });
  await prisma.careerPath.createMany({
    data: analysis.directions.map((direction) => ({
      profileId: profile.id,
      directionName: direction.name,
      matchScore: direction.matchScore,
      strengths: direction.strengths,
      weaknesses: direction.weaknesses,
    })),
  });

  return { profileId: profile.id, version };
}

// 进度追加落库:同一 run 的事件顺序到达,读-改-写安全(唯一写入方为当前管线调用)
async function appendProgress(runId: string, progress: AgentProgress) {
  const run = await prisma.agentRun.findUnique({
    where: { id: runId },
    select: { progress: true },
  });
  const current = Array.isArray(run?.progress)
    ? (run.progress as unknown as AgentProgress[])
    : [];
  await prisma.agentRun.update({
    where: { id: runId },
    data: { progress: [...current, progress] as unknown as Prisma.InputJsonValue },
  });
}
