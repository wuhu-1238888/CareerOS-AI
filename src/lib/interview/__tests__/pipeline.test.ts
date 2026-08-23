// @vitest-environment node
// 模拟面试出题管线测试(7.1,真实写库):开场覆盖式 upsert + 题数 echo 交叉校验 + 失败不落行。
// (7.2/7.3 评估/追问/报告管线测试在本文件后续 describe 中扩展)
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import { MockAdapter } from "@/lib/llm/mock";
import { prisma } from "@/lib/db/prisma";
import { runInterviewQuestions } from "../pipeline";
import { interviewQuestionsSchema } from "@/lib/interview/analysis-schemas";
import { interviewSamples } from "@/lib/agents/__tests__/interview-samples";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `interviewpipeline-a-${suffix}@test.local`;
const emailB = `interviewpipeline-b-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;

const backend5 = interviewSamples.find((s) => s.id === "backend-behavioral-5")!;
const backend10 = interviewSamples.find((s) => s.id === "backend-technical-10")!;

function mockAdapterFor(sample: (typeof interviewSamples)[number]) {
  return new MockAdapter(0, () => JSON.stringify(sample.mockOutput));
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const [a, b] = await Promise.all(
    [emailA, emailB].map((email) =>
      prisma.user.create({ data: { email, name: "面试管线", passwordHash, authMethod: "password" } })
    )
  );
  userIdA = a.id;
  userIdB = b.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("runInterviewQuestions 管线(真实写库,顺序执行)", () => {
  it("成功:InterviewSession 落库(场次快照 + 题目数组)+ AgentRun succeeded 含 5 条进度", async () => {
    const outcome = await runInterviewQuestions({
      userId: userIdA,
      input: backend5.input,
      adapter: mockAdapterFor(backend5),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.interviewType).toBe("行为面");
    expect(row?.questionCount).toBe(5);
    expect(row?.targetPosition).toBe("后端开发工程师");
    expect(row?.resumeText).toBe(backend5.input.resumeText);
    expect(row?.status).toBe("in_progress");
    expect(row?.currentQuestionIndex).toBe(0);
    expect(row?.answers).toStrictEqual([]);
    expect(row?.report).toBeNull();
    // questions 为数组(不包 {questions} 信封),可经输出 Schema 防御解析回读
    const parsed = interviewQuestionsSchema.safeParse({ questions: row?.questions });
    expect(parsed.success).toBe(true);
    expect(parsed.success ? parsed.data.questions.length : 0).toBe(5);

    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("succeeded");
    expect(run?.intent).toBe("generate-interview-questions");
    const progress = run?.progress as { stage: string }[];
    expect(progress).toHaveLength(5);
    expect(progress.map((p) => p.stage)).toEqual(["start", "prompt", "llm", "parse", "done"]);
    // 输入含简历/岗位/档位(重试从 run.input 重放依赖)
    expect(run?.input).toMatchObject({ targetPosition: "后端开发工程师", questionCount: 5 });
    expect((run?.input as { resumeText: string }).resumeText).toContain("Python");
  });

  it("题数 echo 交叉校验:10 档只输出 5 道 → ok:false 不落库(既有行不变)", async () => {
    // userB 先成功开场 5 题,再用「10 档 + 5 题输出」跑一次:echo 不符,行必须保持原样
    const first = await runInterviewQuestions({
      userId: userIdB,
      input: backend5.input,
      adapter: mockAdapterFor(backend5),
    });
    expect(first.ok).toBe(true);
    const before = await prisma.interviewSession.findUnique({ where: { userId: userIdB } });

    const shortOutput = new MockAdapter(0, () =>
      JSON.stringify({ questions: backend10.mockOutput.questions.slice(0, 5) })
    );
    const outcome = await runInterviewQuestions({
      userId: userIdB,
      input: { ...backend10.input, resumeText: backend10.input.resumeText },
      adapter: shortOutput,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toContain("不一致");

    const after = await prisma.interviewSession.findUnique({ where: { userId: userIdB } });
    expect(after?.questionCount).toBe(before?.questionCount);
    expect(after?.questions).toStrictEqual(before?.questions);
    expect(after?.updatedAt).toEqual(before?.updatedAt);
  });

  it("重新开场:覆盖式新建,重置作答/进度/报告(单行模型,answers 清空)", async () => {
    // userA 已有场次:手工预置一条作答与进度,再跑 10 题技术面 → 全部重置
    await prisma.interviewSession.update({
      where: { userId: userIdA },
      data: {
        currentQuestionIndex: 3,
        answers: [
          { questionId: "q-1", answer: "旧作答", evaluation: null, followUpQuestion: null, followUpAnswer: null },
        ],
        report: { overallEvaluation: "旧报告" },
      },
    });
    const outcome = await runInterviewQuestions({
      userId: userIdA,
      input: backend10.input,
      adapter: mockAdapterFor(backend10),
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");

    const row = await prisma.interviewSession.findUnique({ where: { userId: userIdA } });
    expect(row?.interviewType).toBe("技术面");
    expect(row?.questionCount).toBe(10);
    expect(row?.status).toBe("in_progress");
    expect(row?.currentQuestionIndex).toBe(0);
    expect(row?.answers).toStrictEqual([]);
    expect(row?.report).toBeNull();
    // 仍只有一行
    const rows = await prisma.interviewSession.findMany({ where: { userId: userIdA } });
    expect(rows).toHaveLength(1);
  });

  it("失败不落行:ok=false 友好错误 + AgentRun failed + 已有行不变", async () => {
    const junk = new MockAdapter(0, () => "这不是 JSON");
    const before = await prisma.interviewSession.findUnique({ where: { userId: userIdB } });
    const outcome = await runInterviewQuestions({
      userId: userIdB,
      input: backend5.input,
      adapter: junk,
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("unreachable");
    expect(outcome.error).toBe("AI 返回了无法识别的结果,请稍后重试");
    const run = await prisma.agentRun.findUnique({ where: { id: outcome.runId } });
    expect(run?.status).toBe("failed");
    const after = await prisma.interviewSession.findUnique({ where: { userId: userIdB } });
    expect(after?.questions).toStrictEqual(before?.questions);
  });
});
