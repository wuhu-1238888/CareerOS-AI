// @vitest-environment node
// 简历解析管线测试(4.3,真实写库):成功写 parsedData / 失败不落行 / 文本截断 /
// 防御解析 + router 层护栏(parse/retryParse/saveParsedData/latestRun 越权与 intent 隔离)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { MockAdapter } from "@/lib/llm/mock";
import { prisma } from "@/lib/db/prisma";
import {
  MAX_RESUME_TEXT_FOR_LLM,
  parseParsedData,
  parseResume,
  rewriteResume,
  scoreAts,
} from "../pipeline";
import { scoreRuleSubscores, synthesizeAtsScore } from "../ats-rules";
import { resumeParseSamples } from "@/lib/agents/__tests__/resume-parse-samples";
import { resumeRewriteSamples } from "@/lib/agents/__tests__/resume-rewrite-samples";
import { resumeAtsSamples } from "@/lib/agents/__tests__/resume-ats-samples";
import { createCaller } from "@/lib/trpc/router";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `resumepipe-a-${suffix}@test.local`;
const emailB = `resumepipe-b-${suffix}@test.local`;
const emailC = `resumepipe-c-${suffix}@test.local`;
const emailD = `resumepipe-d-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;
let userIdC: string;
let userIdD: string;
let resumeIdA: string;
let resumeIdB: string;
let resumeIdC: string;
let failedRunId = "";

function caller(sessionUserId: string | null) {
  return createCaller({
    session: sessionUserId
      ? { user: { id: sessionUserId, email: "x@y.z", name: "甲" }, expires: "2030-01-01T00:00:00.000Z" }
      : null,
    prisma,
  });
}

const backend = resumeParseSamples.find((s) => s.id === "backend-engineer")!;

function mockAdapterFor(sample: (typeof resumeParseSamples)[number]) {
  return new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b, c, d] = await Promise.all(
    [emailA, emailB, emailC, emailD].map((email) =>
      prisma.user.create({ data: { email, name: "简历管线", passwordHash, authMethod: "password" } })
    )
  );
  userIdA = a.id;
  userIdB = b.id;
  userIdC = c.id;
  userIdD = d.id;
  // A/B/C 各有一份带原文的简历;D 有一份提取失败(无原文)的简历
  const [ra, rb, rc] = await Promise.all([
    prisma.resume.create({ data: { userId: userIdA, originalText: backend.input.resumeText } }),
    prisma.resume.create({ data: { userId: userIdB, originalText: backend.input.resumeText } }),
    prisma.resume.create({ data: { userId: userIdC, originalText: backend.input.resumeText } }),
    prisma.resume.create({ data: { userId: userIdD, extractError: "no-text", fileName: "扫描件.pdf" } }),
  ]);
  resumeIdA = ra.id;
  resumeIdB = rb.id;
  resumeIdC = rc.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("parseResume 管线(真实写库,顺序执行)", () => {
  it("成功:parsedData 落库 + AgentRun succeeded 含 5 条进度 + 输入含原文与 resumeId", async () => {
    const outcome = await parseResume({
      userId: userIdA,
      resumeId: resumeIdA,
      resumeText: backend.input.resumeText,
      adapter: mockAdapterFor(backend),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.resume.findUnique({ where: { id: resumeIdA } });
    expect(parseParsedData(row?.parsedData)?.basicInfo.name).toBe("张伟");
    expect(parseParsedData(row?.parsedData)?.skills).toHaveLength(6);

    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.intent).toBe("parse-resume");
    const progress = run?.progress as { stage: string }[];
    expect(progress).toHaveLength(5);
    expect(progress.map((p) => p.stage)).toEqual(["start", "prompt", "llm", "parse", "done"]);
    expect(run?.input).toMatchObject({ resumeId: resumeIdA });
    expect((run?.input as { resumeText: string }).resumeText).toBe(backend.input.resumeText);
  });

  it("失败不落行:parsedData 保持 null + AgentRun failed(友好错误)", async () => {
    const junk = new MockAdapter(0, () => "这不是 JSON");
    const outcome = await parseResume({
      userId: userIdB,
      resumeId: resumeIdB,
      resumeText: backend.input.resumeText,
      adapter: junk,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("AI 返回了无法识别的结果,请稍后重试");
    failedRunId = outcome.runId;
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("failed");
    const row = await prisma.resume.findUnique({ where: { id: resumeIdB } });
    expect(row?.parsedData).toBeNull();
  });

  it("原文超过 20000 字符:送 LLM 文本截断到上限(DB 存全文)", async () => {
    const longText = "张伟\n求职意向:后端开发工程师\n".padEnd(MAX_RESUME_TEXT_FOR_LLM + 500, "项目细节与职责描述");
    // DB 存全文(超限原文),管线只对送 LLM 的文本截断
    await prisma.resume.update({ where: { id: resumeIdC }, data: { originalText: longText } });
    const outcome = await parseResume({
      userId: userIdC,
      resumeId: resumeIdC,
      resumeText: longText,
      adapter: mockAdapterFor(backend),
    });
    expect(outcome.ok).toBe(true);
    const rowC = await prisma.resume.findUnique({ where: { id: resumeIdC } });
    expect(rowC?.originalText?.length).toBeGreaterThan(MAX_RESUME_TEXT_FOR_LLM);
    const runs = await prisma.agentRun.findMany({
      where: { userId: userIdC, intent: "parse-resume" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect((runs[0]?.input as { resumeText: string }).resumeText).toHaveLength(MAX_RESUME_TEXT_FOR_LLM);
  });

  it("防御解析:parsedData 损坏或缺失 → null", () => {
    expect(parseParsedData(null)).toBeNull();
    expect(parseParsedData({ basicInfo: "不是对象" })).toBeNull();
    expect(parseParsedData(backend.mockOutput)).toMatchObject({
      basicInfo: { name: "张伟" },
    });
  });
});

describe("resume.parse / retryParse / saveParsedData / latestRun 护栏(router 层)", () => {
  it("parse:未登录 → UNAUTHORIZED;越权 → NOT_FOUND;原文缺失 → BAD_REQUEST", async () => {
    await expect(caller(null).resume.parse({ resumeId: resumeIdA })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(userIdB).resume.parse({ resumeId: resumeIdA })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "简历不存在",
    });
    const broken = await prisma.resume.findFirst({ where: { userId: userIdD } });
    await expect(caller(userIdD).resume.parse({ resumeId: broken!.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "简历原文缺失,请重新上传或粘贴简历内容",
    });
  });

  it("retryParse:重放最近失败 run 的 input 成功写回 parsedData;runId 不存在/他人 run → NOT_FOUND", async () => {
    // 重放 B 的失败 run:成功写 B 行 parsedData
    const outcome = await caller(userIdB).resume.retryParse({ runId: failedRunId });
    expect(outcome.runId).toBeTruthy();
    const rowB = await prisma.resume.findUnique({ where: { id: resumeIdB } });
    expect(parseParsedData(rowB?.parsedData)?.basicInfo.name).toBe("张伟");
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");

    await expect(caller(userIdB).resume.retryParse({ runId: "nonexistent" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "解析任务不存在",
    });
    // 他人 run → NOT_FOUND
    await expect(caller(userIdA).resume.retryParse({ runId: failedRunId })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "解析任务不存在",
    });
  });

  it("retryParse:非法 input → BAD_REQUEST;简历已删除 → NOT_FOUND", async () => {
    const garbage = await prisma.agentRun.create({
      data: {
        agentName: "resume-parse-agent",
        intent: "parse-resume",
        userId: userIdC,
        status: "failed",
        input: { not: "a valid parse input" },
      },
    });
    await expect(caller(userIdC).resume.retryParse({ runId: garbage.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "无法重试该任务,请重新上传或粘贴简历内容",
    });
    // 指向已删除简历的合法 input
    const ghost = await prisma.agentRun.create({
      data: {
        agentName: "resume-parse-agent",
        intent: "parse-resume",
        userId: userIdC,
        status: "failed",
        input: { resumeText: "十一个字以上的简历原文内容", resumeId: "deleted-resume-id" },
      },
    });
    await expect(caller(userIdC).resume.retryParse({ runId: ghost.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "简历不存在",
    });
    // 清理:AgentRun 在删 User 时 SetNull 保留,测试结束后手动删除避免孤儿行
    await prisma.agentRun.deleteMany({ where: { id: { in: [garbage.id, ghost.id] } } });
  });

  it("saveParsedData:修正保存后 get 返回修正值;越权 → NOT_FOUND;未登录 → UNAUTHORIZED", async () => {
    const corrected = {
      ...backend.mockOutput,
      basicInfo: { ...backend.mockOutput.basicInfo, name: "张伟(已核对)" },
    };
    expect(
      (await caller(userIdA).resume.saveParsedData({ resumeId: resumeIdA, parsedData: corrected })).ok
    ).toBe(true);
    const get = await caller(userIdA).resume.get();
    expect(get?.parsedData?.basicInfo.name).toBe("张伟(已核对)");

    await expect(
      caller(userIdB).resume.saveParsedData({ resumeId: resumeIdA, parsedData: corrected })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "简历不存在" });
    await expect(
      caller(null).resume.saveParsedData({ resumeId: resumeIdA, parsedData: corrected })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("latestRun:按 intent 参数化隔离(parse-resume 有 run,rewrite-resume/score-ats 为 null);他人 run 不可见", async () => {
    const latestA = await caller(userIdA).resume.latestRun({ intent: "parse-resume" });
    expect(latestA?.status).toBe("succeeded");
    expect(latestA?.progress).toHaveLength(5);
    expect(await caller(userIdA).resume.latestRun({ intent: "rewrite-resume" })).toBeNull();
    expect(await caller(userIdA).resume.latestRun({ intent: "score-ats" })).toBeNull();
    // 与画像/路线图 intent 不串台:userA 无画像 run
    expect(await caller(userIdA).profile.latestRun()).toBeNull();
    // 从未解析 → null
    expect(await caller(userIdD).resume.latestRun({ intent: "parse-resume" })).toBeNull();
  });
});

describe("rewriteResume 管线(4.4,真实写库)", () => {
  const rewriteSample = resumeRewriteSamples.find((s) => s.id === "backend-engineer")!;
  const rewriteAdapter = () => new MockAdapter(0, () => JSON.stringify(rewriteSample.mockOutput));

  it("成功:事务建版本(targetDirection/changes 摘要)+ 建议批量落库(order 升序/status pending)", async () => {
    const outcome = await rewriteResume({
      userId: userIdA,
      resumeId: resumeIdA,
      parsedData: rewriteSample.input.parsedData,
      abilityTags: rewriteSample.input.abilityTags,
      targetDirection: rewriteSample.input.targetDirection,
      adapter: rewriteAdapter(),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const version = await prisma.resumeVersion.findUnique({
      where: { id: outcome.versionId },
      include: { optimizations: { orderBy: { order: "asc" } } },
    });
    expect(version?.targetDirection).toBe("后端开发工程师");
    expect((version?.changes as { modificationCount: number }).modificationCount).toBe(4);
    expect(version?.optimizations).toHaveLength(4);
    expect(version!.optimizations.map((o) => o.status)).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(version!.optimizations.map((o) => o.order)).toEqual([0, 1, 2, 3]);
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.intent).toBe("rewrite-resume");
  });

  it("二次改写:产生新版本(不可变快照),旧版本内容不变", async () => {
    const first = await rewriteResume({
      userId: userIdA,
      resumeId: resumeIdA,
      parsedData: rewriteSample.input.parsedData,
      abilityTags: [],
      targetDirection: "Java 后端",
      adapter: rewriteAdapter(),
    });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error("unreachable");
    const versions = await prisma.resumeVersion.findMany({
      where: { resumeId: resumeIdA },
      orderBy: { createdAt: "asc" },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]!.id).not.toBe(versions[1]!.id);
    expect(versions[0]!.targetDirection).toBe("后端开发工程师");
    expect(versions[1]!.targetDirection).toBe("Java 后端");
    // 旧版本快照不受影响
    const oldVersion = await prisma.resumeVersion.findUnique({
      where: { id: versions[0]!.id },
      include: { optimizations: true },
    });
    expect(oldVersion?.optimizations).toHaveLength(4);
  });

  it("validateModifications 失败(片段不在原文)→ 整次不落行,不产生版本", async () => {
    const tampered = {
      modifications: rewriteSample.mockOutput.modifications.map((m, i) =>
        i === 1 ? { ...m, originalText: "原文中不存在的片段XYZ" } : m
      ),
    };
    const adapter = new MockAdapter(0, () => JSON.stringify(tampered));
    const before = await prisma.resumeVersion.count({ where: { resumeId: resumeIdB } });
    const outcome = await rewriteResume({
      userId: userIdB,
      resumeId: resumeIdB,
      parsedData: rewriteSample.input.parsedData,
      abilityTags: [],
      targetDirection: "后端开发工程师",
      adapter,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("改写结果与简历原文不一致,请重新分析");
    expect(await prisma.resumeVersion.count({ where: { resumeId: resumeIdB } })).toBe(before);
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded"); // run 本身成功,业务校验拦截在落行前
  });

  it("原文缺失 → 失败且无 run(runId 空串)", async () => {
    const broken = await prisma.resume.findFirst({ where: { userId: userIdD } });
    const outcome = await rewriteResume({
      userId: userIdD,
      resumeId: broken!.id,
      parsedData: rewriteSample.input.parsedData,
      abilityTags: [],
      targetDirection: "后端开发工程师",
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("简历原文缺失,请重新上传或粘贴简历内容");
    expect(outcome.runId).toBe("");
  });
});

describe("resume.rewrite 护栏(router 层,4.4)", () => {
  const rewriteSample = resumeRewriteSamples.find((s) => s.id === "backend-engineer")!;
  const payload = {
    parsedData: rewriteSample.input.parsedData,
    targetDirection: "后端开发工程师",
  };

  it("未登录 → UNAUTHORIZED;越权 → NOT_FOUND;原文缺失 → BAD_REQUEST", async () => {
    await expect(caller(null).resume.rewrite({ resumeId: resumeIdA, ...payload })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(userIdB).resume.rewrite({ resumeId: resumeIdA, ...payload })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "简历不存在",
    });
    const broken = await prisma.resume.findFirst({ where: { userId: userIdD } });
    await expect(caller(userIdD).resume.rewrite({ resumeId: broken!.id, ...payload })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "简历原文缺失,请重新上传或粘贴简历内容",
    });
  });
});

describe("resume.updateOptimization / acceptAll(router 层,4.5)", () => {
  it("updateOptimization:接受/撤销三态切换;未登录/越权/不存在 → 护栏", async () => {
    // A 的第二个版本(「Java 后端」)已由 4.4 测试建立,取其一建议操作
    const version = await prisma.resumeVersion.findFirst({
      where: { resumeId: resumeIdA },
      orderBy: { createdAt: "desc" },
    });
    const opt = await prisma.optimization.findFirst({
      where: { resumeVersionId: version!.id },
      orderBy: { order: "asc" },
    });
    const accepted = await caller(userIdA).resume.updateOptimization({
      optimizationId: opt!.id,
      status: "accepted",
    });
    expect(accepted.status).toBe("accepted");
    // 撤销:回到 pending
    const undone = await caller(userIdA).resume.updateOptimization({
      optimizationId: opt!.id,
      status: "pending",
    });
    expect(undone.status).toBe("pending");

    await expect(
      caller(null).resume.updateOptimization({ optimizationId: opt!.id, status: "accepted" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    // 他人建议 → NOT_FOUND(不泄露存在性)
    await expect(
      caller(userIdB).resume.updateOptimization({ optimizationId: opt!.id, status: "accepted" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "修改建议不存在" });
    await expect(
      caller(userIdA).resume.updateOptimization({ optimizationId: "nonexistent", status: "accepted" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "修改建议不存在" });
  });

  it("acceptAll:整版置 accepted 且 get.version 同步;未登录/越权/不存在 → 护栏", async () => {
    const version = await prisma.resumeVersion.findFirst({
      where: { resumeId: resumeIdA },
      orderBy: { createdAt: "desc" },
    });
    expect((await caller(userIdA).resume.acceptAll({ versionId: version!.id })).ok).toBe(true);
    const opts = await prisma.optimization.findMany({ where: { resumeVersionId: version!.id } });
    expect(opts.every((o) => o.status === "accepted")).toBe(true);
    // get 返回 version 且状态同步(前端结果视图数据源)
    const get = await caller(userIdA).resume.get();
    expect(get?.version?.id).toBe(version!.id);
    expect(get?.version?.targetDirection).toBe(version!.targetDirection);
    expect(get?.version?.optimizations.every((o) => o.status === "accepted")).toBe(true);

    await expect(caller(null).resume.acceptAll({ versionId: version!.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(userIdB).resume.acceptAll({ versionId: version!.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "优化版本不存在",
    });
    await expect(caller(userIdA).resume.acceptAll({ versionId: "nonexistent" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "优化版本不存在",
    });
  });
});

describe("scoreAts 管线(4.6,真实写库)", () => {
  const atsSample = resumeAtsSamples.find((s) => s.id === "backend-engineer")!;
  // 4.4 已为 A 建立两个版本:旧版(后端开发工程师,建议全 pending)与新版(Java 后端,已被 4.5 acceptAll)
  let versionId = "";
  const adapter = () => new MockAdapter(0, () => JSON.stringify(atsSample.mockOutput));
  const expectedReport = () => {
    const rule = scoreRuleSubscores(atsSample.input.finalText, atsSample.input.targetDirection);
    return synthesizeAtsScore(rule, atsSample.mockOutput.llmSubscores);
  };

  it("成功:合成总分与报告落库(规则分确定性 + LLM 5/5)+ run succeeded 含 5 条进度", async () => {
    const version = await prisma.resumeVersion.findFirst({
      where: { resumeId: resumeIdA },
      orderBy: { createdAt: "asc" },
    });
    versionId = version!.id;
    const outcome = await scoreAts({
      userId: userIdA,
      versionId,
      finalText: atsSample.input.finalText,
      targetDirection: atsSample.input.targetDirection,
      adapter: adapter(),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const expected = expectedReport();
    expect(outcome.report.total).toBe(expected.total);
    expect(outcome.report.ruleScore).toBe(expected.ruleScore);
    expect(outcome.report.level).toBe(expected.level);

    const row = await prisma.resumeVersion.findUnique({ where: { id: versionId } });
    expect(row?.atsScore).toBe(expected.total);
    expect(row?.atsScoredAt).not.toBeNull();
    const report = row?.atsReport as {
      total: number;
      level: string;
      ruleScore: number;
      suggestions: unknown[];
    } | null;
    expect(report?.total).toBe(expected.total);
    expect(report?.level).toBe(expected.level);
    expect(report?.ruleScore).toBe(expected.ruleScore);
    expect(report?.suggestions).toHaveLength(atsSample.expectedSuggestionCount);

    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.intent).toBe("score-ats");
    expect((run?.progress as { stage: string }[]).map((p) => p.stage)).toEqual([
      "start",
      "prompt",
      "llm",
      "parse",
      "done",
    ]);
    expect((run?.input as { finalText: string }).finalText).toBe(atsSample.input.finalText);
  });

  it("同一输入两次评分:分差 0(≤10 验收;规则确定性 + Mock 同回放)", async () => {
    const first = await scoreAts({
      userId: userIdA,
      versionId,
      finalText: atsSample.input.finalText,
      targetDirection: atsSample.input.targetDirection,
      adapter: adapter(),
    });
    const second = await scoreAts({
      userId: userIdA,
      versionId,
      finalText: atsSample.input.finalText,
      targetDirection: atsSample.input.targetDirection,
      adapter: adapter(),
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error("unreachable");
    expect(Math.abs(second.report.total - first.report.total)).toBe(0);
    // 两次均落库为同一总分
    const row = await prisma.resumeVersion.findUnique({ where: { id: versionId } });
    expect(row?.atsScore).toBe(first.report.total);
  });

  it("LLM 失败:不覆盖旧评分(atsScore/atsReport 保持上次值)", async () => {
    const before = await prisma.resumeVersion.findUnique({ where: { id: versionId } });
    const junk = new MockAdapter(0, () => "这不是 JSON");
    const outcome = await scoreAts({
      userId: userIdA,
      versionId,
      finalText: atsSample.input.finalText,
      targetDirection: atsSample.input.targetDirection,
      adapter: junk,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("AI 返回了无法识别的结果,请稍后重试");
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("failed");
    const after = await prisma.resumeVersion.findUnique({ where: { id: versionId } });
    expect(after?.atsScore).toBe(before?.atsScore);
    expect(after?.atsReport).toEqual(before?.atsReport);
  });
});

describe("resume.scoreAts 护栏(router 层,4.6)", () => {
  it("未登录 → UNAUTHORIZED;越权/不存在 → NOT_FOUND;无方向/原文缺失 → BAD_REQUEST", async () => {
    const versionA = await prisma.resumeVersion.findFirst({
      where: { resumeId: resumeIdA },
      orderBy: { createdAt: "asc" },
    });
    await expect(caller(null).resume.scoreAts({ versionId: versionA!.id })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(caller(userIdB).resume.scoreAts({ versionId: versionA!.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "优化版本不存在",
    });
    await expect(caller(userIdA).resume.scoreAts({ versionId: "nonexistent" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "优化版本不存在",
    });
    // 目标方向缺失的版本(直接造行,随用户级联删除清理)
    const noDirection = await prisma.resumeVersion.create({
      data: { resumeId: resumeIdA, targetDirection: null },
    });
    await expect(caller(userIdA).resume.scoreAts({ versionId: noDirection.id })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "优化版本缺少目标方向,请重新分析",
    });
    // 原文缺失的简历上的版本 → 原文缺失 BAD_REQUEST
    const brokenResume = await prisma.resume.findFirst({ where: { userId: userIdD } });
    const brokenVersion = await prisma.resumeVersion.create({
      data: { resumeId: brokenResume!.id, targetDirection: "后端开发工程师" },
    });
    await expect(
      caller(userIdD).resume.scoreAts({ versionId: brokenVersion.id })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "简历原文缺失,请重新上传或粘贴简历内容",
    });
  });
});
