// @vitest-environment node
// Orchestrator 集成测试(1.6,真实写库):AgentRun 日志落库、非法输出友好错误不崩溃、进度转发、路由失败
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { MockAdapter } from "@/lib/llm/mock";
import { AgentRegistry } from "@/lib/agents/registry";
import { Orchestrator } from "../orchestrator";
import { SummaryAgent, VALID_JSON_REPLY, DEFAULT_CONTEXT } from "@/lib/agents/__tests__/fixtures";
import type { SummaryOutput } from "@/lib/agents/__tests__/fixtures";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = `orch-${suffix}@test.local`;

let userId: string;

const registry = new AgentRegistry();
registry.register(new SummaryAgent());

function makeOrchestrator(reply: string) {
  return new Orchestrator(prisma, new MockAdapter(2, () => reply), registry);
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const user = await prisma.user.create({
    data: { email, name: "编排测试", authMethod: "password" },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.agentRun.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("Orchestrator.run", () => {
  it("执行成功:返回结果 + AgentRun 落库(succeeded,含输出与耗时)", async () => {
    const outcome = await makeOrchestrator(VALID_JSON_REPLY).run({
      intent: "sample-summary",
      input: { text: "计算机专业,目标后端" },
      context: DEFAULT_CONTEXT,
      userId,
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect((outcome.result.data as SummaryOutput).keywords).toContain("后端");
      const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
      expect(run).toMatchObject({
        agentName: "sample-summary",
        intent: "sample-summary",
        status: "succeeded",
        userId,
      });
      expect((run?.output as { summary?: string })?.summary).toContain("后端");
      expect(run?.error).toBeNull();
      expect(run?.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("非法模型输出:ok=false + 友好错误文案 + AgentRun failed + 不抛出", async () => {
    const outcome = await makeOrchestrator("模型返回了一段无法解析的废话").run({
      intent: "sample-summary",
      input: { text: "计算机专业" },
      context: DEFAULT_CONTEXT,
      userId,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toBe("AI 返回了无法识别的结果,请稍后重试");
      const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
      expect(run?.status).toBe("failed");
      expect(run?.error).toBe(outcome.error);
      expect(run?.output).toBeNull();
    }
  });

  it("未注册意图:ok=false + 友好错误,不落 AgentRun", async () => {
    const before = await prisma.agentRun.count({ where: { userId } });
    const outcome = await makeOrchestrator(VALID_JSON_REPLY).run({
      intent: "unknown-intent",
      input: {},
      context: DEFAULT_CONTEXT,
      userId,
    });
    expect(outcome).toEqual({ ok: false, error: "暂不支持该任务类型", runId: "" });
    expect(await prisma.agentRun.count({ where: { userId } })).toBe(before);
  });

  it("进度事件逐条转发给调用方", async () => {
    const stages: string[] = [];
    const outcome = await makeOrchestrator(VALID_JSON_REPLY).run({
      intent: "sample-summary",
      input: { text: "计算机专业" },
      context: DEFAULT_CONTEXT,
      userId,
      onProgress: (p) => stages.push(p.stage),
    });
    expect(outcome.ok).toBe(true);
    expect(stages).toEqual(["start", "prompt", "llm", "parse", "done"]);
  });
});
