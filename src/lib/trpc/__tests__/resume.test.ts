// @vitest-environment node
// 简历数据层接口测试(4.1,真实写库):get 空态/粘贴创建/列表隔离/pasteText 补全/删除级联清理/越权与未登录
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { createCaller } from "../router";
import { prisma } from "@/lib/db/prisma";

// 假存储 spy:断言 resume.delete 调用 storage.delete(键匹配);read/save 在本测试不应被调用
const mockStorage = vi.hoisted(() => ({ deleted: [] as string[] }));
vi.mock("@/lib/file/storage", () => ({
  getFileStorage: () => ({
    save: async () => undefined,
    read: async () => {
      throw new Error("测试中不应读取文件");
    },
    delete: async (key: string) => {
      mockStorage.deleted.push(key);
    },
  }),
}));

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const emailA = `resume-api-a-${suffix}@test.local`;
const emailB = `resume-api-b-${suffix}@test.local`;

let userIdA: string;
let userIdB: string;

function caller(sessionUserId: string | null) {
  return createCaller({
    session: sessionUserId
      ? { user: { id: sessionUserId, email: "x@y.z", name: "甲" }, expires: "2030-01-01T00:00:00.000Z" }
      : null,
    prisma,
  });
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const passwordHash = await bcrypt.hash("password-123", 10);
  const userA = await prisma.user.create({
    data: { email: emailA, name: "简历A", passwordHash, authMethod: "password" },
  });
  const userB = await prisma.user.create({
    data: { email: emailB, name: "简历B", passwordHash, authMethod: "password" },
  });
  userIdA = userA.id;
  userIdB = userB.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("resume 数据层(真实写库,顺序执行)", () => {
  it("未上传时 get 返回 null,list 为空", async () => {
    expect(await caller(userIdA).resume.get()).toBeNull();
    expect(await caller(userIdA).resume.list()).toEqual([]);
  });

  it("createFromText:内容过短 → BAD_REQUEST;合法粘贴创建数据行", async () => {
    await expect(caller(userIdA).resume.createFromText({ text: "太短" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    const row = await caller(userIdA).resume.createFromText({
      text: "张三\n求职意向:前端开发工程师\n工作经历:某公司前端开发 3 年",
    });
    const dbRow = await prisma.resume.findUnique({ where: { id: row.id } });
    expect(dbRow?.userId).toBe(userIdA);
    expect(dbRow?.originalText).toContain("张三");
    expect(dbRow?.fileName).toBeNull();
    expect(dbRow?.storageKey).toBeNull();
    expect(dbRow?.extractError).toBeNull();
    // 模块顺序快照(4.10):粘贴入库时按原文检测写入
    expect(dbRow?.sectionOrder).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "basicInfo", label: "求职意向" }),
        expect.objectContaining({ kind: "experiences", label: "工作经历", type: "工作" }),
      ])
    );
  });

  it("get:返回最新一行元信息(含粘贴行)与模块顺序计划(4.10)", async () => {
    const get = await caller(userIdA).resume.get();
    expect(get?.fileName).toBeNull();
    expect(get?.extractError).toBeNull();
    expect(get?.id).toBeTruthy();
    // sectionPlan 按原文顺序派生:未解析时仅含检测出的模块(无 items 归组)
    expect(get?.sectionPlan).toMatchObject([
      { kind: "basicInfo", label: "求职意向" },
      { kind: "experiences", label: "工作经历", type: "工作" },
    ]);
  });

  it("get({resumeId})(4.12):返回指定行(活跃简历);不存在/越权 id 回退最新行", async () => {
    // 第二行(此后为最新行)
    const second = await caller(userIdA).resume.createFromText({
      text: "赵六\n求职意向:测试工程师\n工作经历:两年测试经验",
    });
    const latest = await caller(userIdA).resume.get();
    expect(latest?.id).toBe(second.id);
    // 指定旧行(第一行)id:返回旧行而非最新行
    const older = await prisma.resume.findFirst({
      where: { userId: userIdA },
      orderBy: { createdAt: "asc" },
    });
    const byId = await caller(userIdA).resume.get({ resumeId: older!.id });
    expect(byId?.id).toBe(older!.id);
    expect(byId?.fileName).toBeNull();
    expect(byId?.sectionPlan).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "basicInfo", label: "求职意向" })])
    );
    // 不存在/越权 id(带 userId 过滤,他人 id 同样命中不了)→ 回退最新行
    const fallback = await caller(userIdA).resume.get({ resumeId: "does-not-exist" });
    expect(fallback?.id).toBe(latest!.id);
  });

  it("pasteText:补全提取失败行 —— 原文写入 + extractError 清空 + 旧解析结果清空", async () => {
    const broken = await prisma.resume.create({
      data: { userId: userIdA, extractError: "no-text", parsedData: { basicInfo: { name: "旧数据" } } },
    });
    const row = await caller(userIdA).resume.pasteText({
      resumeId: broken.id,
      text: "李四\n求职意向:后端开发工程师\n教育经历:某大学本科",
    });
    expect(row.id).toBe(broken.id);
    const dbRow = await prisma.resume.findUnique({ where: { id: broken.id } });
    expect(dbRow?.extractError).toBeNull();
    expect(dbRow?.originalText).toContain("李四");
    expect(dbRow?.parsedData).toBeNull();
  });

  it("list:只返回本人的文件列表(含粘贴行),按时间倒序", async () => {
    await caller(userIdB).resume.createFromText({ text: "王五\n求职意向:产品经理\n工作经历:三年产品经验" });
    const listA = await caller(userIdA).resume.list();
    const listB = await caller(userIdB).resume.list();
    expect(listA.length).toBeGreaterThanOrEqual(2);
    expect(listB.length).toBe(1);
    // 隔离:对方的行不出现
    expect(listA.every((item) => item.id !== listB[0]!.id)).toBe(true);
  });

  it("delete:先删 DB 行(级联)再清理存储文件(键匹配);再删同 id → NOT_FOUND", async () => {
    const storageKey = `resumes/${userIdA}/delete-me.pdf`;
    const row = await prisma.resume.create({
      data: { userId: userIdA, fileName: "待删除.pdf", storageKey, sizeBytes: 1024 },
    });
    const before = mockStorage.deleted.length;
    expect((await caller(userIdA).resume.delete({ id: row.id })).ok).toBe(true);
    expect(await prisma.resume.findUnique({ where: { id: row.id } })).toBeNull();
    expect(mockStorage.deleted.slice(before)).toContain(storageKey);
    await expect(caller(userIdA).resume.delete({ id: row.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "简历不存在",
    });
  });

  it("delete:粘贴行(无 storageKey)不调存储删除", async () => {
    const row = await prisma.resume.create({
      data: { userId: userIdA, originalText: "粘贴行原文内容足够长" },
    });
    const before = mockStorage.deleted.length;
    expect((await caller(userIdA).resume.delete({ id: row.id })).ok).toBe(true);
    expect(mockStorage.deleted.length).toBe(before);
  });

  it("越权:他人简历的 pasteText / delete → NOT_FOUND(不泄露存在性)", async () => {
    const other = await prisma.resume.create({
      data: { userId: userIdB, extractError: "no-text" },
    });
    await expect(
      caller(userIdA).resume.pasteText({ resumeId: other.id, text: "十一个字以上的文本内容" })
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "简历不存在" });
    await expect(caller(userIdA).resume.delete({ id: other.id })).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "简历不存在",
    });
    // 原行未受影响
    expect(await prisma.resume.findUnique({ where: { id: other.id } })).not.toBeNull();
  });

  it("latestRun stale 阈值(2026-08):running 在 LLM 超时 + 余量内仍返回 running;超过视为中断(仅显示态)", async () => {
    const run = await prisma.agentRun.create({
      data: { agentName: "resume-rewrite-agent", intent: "rewrite-resume", userId: userIdA, status: "running", input: {} },
    });
    try {
      // 回拨 updatedAt 用 SQL 区间运算(不传 Date 参数:JS Date 经 Prisma raw SQL 会被按本地时区序列化,
      // 在 UTC+8 机器上存入即偏移 8 小时导致断言失真);相对行自身值回拨,也不依赖 DB 时钟
      // 3 分钟前:旧固定 2 分钟阈值会误报「分析中断」,新阈值(3 分钟超时 + 1 分钟余量)内 → 仍 running
      await prisma.$executeRaw`UPDATE agent_runs SET updated_at = updated_at - INTERVAL '3 minutes' WHERE id = ${run.id}`;
      expect(await caller(userIdA).resume.latestRun({ intent: "rewrite-resume" })).toMatchObject({
        status: "running",
        stale: false,
        error: null,
      });
      // 5 分钟前:超过阈值 → 序列化为失败态供前端重试,但不改 DB 原状态
      await prisma.$executeRaw`UPDATE agent_runs SET updated_at = updated_at - INTERVAL '5 minutes' WHERE id = ${run.id}`;
      expect(await caller(userIdA).resume.latestRun({ intent: "rewrite-resume" })).toMatchObject({
        status: "failed",
        stale: true,
        error: "分析中断,请重试",
      });
      expect((await prisma.agentRun.findUnique({ where: { id: run.id } }))?.status).toBe("running");
    } finally {
      await prisma.agentRun.delete({ where: { id: run.id } });
    }
  });

  it("未登录:全部入口 → UNAUTHORIZED", async () => {
    await expect(caller(null).resume.get()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).resume.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).resume.createFromText({ text: "十一个字以上的文本内容" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      caller(null).resume.pasteText({ resumeId: "x", text: "十一个字以上的文本内容" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller(null).resume.delete({ id: "x" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
