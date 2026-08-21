// @vitest-environment node
// 上传业务函数测试(4.1,真实写库 + 真实解析器 + 假存储):
// 校验分支/成功落库/每次上传新行新键/提取失败行保留/存储失败/建行失败补偿删除;
// 4.10:乱序 PDF / 文本框逆序 DOCX 上传 → originalText 以视觉顺序落库
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { FileNotFoundError } from "@/lib/file/local-fs";
import type { BlobStorage } from "@/lib/file/storage";
import { MAX_RESUME_SIZE_BYTES, handleResumeUpload, type UploadFile } from "../upload";
import { buildSimplePdf } from "./fixtures/build-pdf";
import { buildTextboxDocx } from "./fixtures/build-textbox-docx";

const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
const email = `resume-upload-${suffix}@test.local`;
let userId: string;

const fixturesDir = path.join(__dirname, "fixtures");

class FakeStorage implements BlobStorage {
  saved = new Map<string, Buffer>();
  deleted: string[] = [];
  failSave = false;
  async save(key: string, data: Buffer) {
    if (this.failSave) throw new Error("磁盘已满");
    this.saved.set(key, data);
  }
  async read(key: string) {
    const data = this.saved.get(key);
    if (!data) throw new FileNotFoundError(key);
    return data;
  }
  async delete(key: string) {
    this.deleted.push(key);
    this.saved.delete(key);
  }
}

function makeFile(fileName: string, buffer: Buffer, size?: number): UploadFile {
  return {
    name: fileName,
    type: fileName.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: size ?? buffer.length,
    arrayBuffer: async () =>
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
  };
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  const user = await prisma.user.create({
    data: {
      email,
      name: "上传测试",
      passwordHash: await bcrypt.hash("password-123", 10),
      authMethod: "password",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: `${suffix}@test.local` } } });
  await prisma.$disconnect();
});

describe("handleResumeUpload", () => {
  it("合法 PDF:提取成功 → ok,DB 行落库,文件写入存储", async () => {
    const storage = new FakeStorage();
    const outcome = await handleResumeUpload({
      userId,
      file: makeFile("简历.pdf", readFileSync(path.join(fixturesDir, "sample-resume-cn.pdf"))),
      storage,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.extractError).toBeNull();
    expect(outcome.textLength).toBeGreaterThan(100);

    const row = await prisma.resume.findUnique({ where: { id: outcome.resumeId } });
    expect(row?.userId).toBe(userId);
    expect(row?.fileName).toBe("简历.pdf");
    expect(row?.extractError).toBeNull();
    expect(row?.originalText).toContain("张伟");
    expect(row?.storageKey).toContain(`${userId}`);
    expect(storage.saved.has(row!.storageKey!)).toBe(true);
  });

  it("合法 DOCX:同样成功并落库", async () => {
    const storage = new FakeStorage();
    const outcome = await handleResumeUpload({
      userId,
      file: makeFile("简历.docx", readFileSync(path.join(fixturesDir, "sample-resume.docx"))),
      storage,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.extractError).toBeNull();
    const row = await prisma.resume.findUnique({ where: { id: outcome.resumeId } });
    expect(row?.storageKey?.endsWith(".docx")).toBe(true);
  });

  it("4.10:z-order 乱序 PDF 上传 → originalText 以视觉顺序落库", async () => {
    // 内容流逆序:Projects/Experience/Skills/Education/Zhang Wei Engineer(同行右侧条目在前)
    const buffer = buildSimplePdf([
      { x: 72, y: 580, text: "Projects" },
      { x: 72, y: 620, text: "Experience" },
      { x: 72, y: 660, text: "Skills" },
      { x: 72, y: 700, text: "Education" },
      { x: 180, y: 740, text: "Engineer" },
      { x: 72, y: 740, text: "Zhang Wei" },
    ]);
    const storage = new FakeStorage();
    const outcome = await handleResumeUpload({
      userId,
      file: makeFile("乱序.pdf", buffer),
      storage,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const row = await prisma.resume.findUnique({ where: { id: outcome.resumeId } });
    const lines = (row?.originalText ?? "").split("\n").map((l) => l.trim()).filter((l) => l !== "");
    expect(lines).toEqual(["Zhang Wei Engineer", "Education", "Skills", "Experience", "Projects"]);
  });

  it("4.10:文本框逆序 DOCX 上传 → originalText 以视觉顺序落库", async () => {
    // XML 逆序写入的文本框模板;视觉顺序:基本信息 → 项目经历 → 教育经历 → 技能 → 实习经历
    const buffer = await buildTextboxDocx([
      { yIn: 5.5, xIn: 0.4, text: "实习经历" },
      { yIn: 4.0, xIn: 0.4, text: "技能" },
      { yIn: 2.8, xIn: 0.4, text: "教育经历" },
      { yIn: 2.0, xIn: 0.4, text: "项目经历" },
      { yIn: 0.5, xIn: 0.4, text: "基本信息" },
    ]);
    const storage = new FakeStorage();
    const outcome = await handleResumeUpload({
      userId,
      file: makeFile("模板简历.docx", buffer),
      storage,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const row = await prisma.resume.findUnique({ where: { id: outcome.resumeId } });
    const order = (row?.originalText ?? "")
      .split("\n\n")
      .map((p) => p.trim())
      .filter((p) => p !== "");
    expect(order).toEqual(["基本信息", "项目经历", "教育经历", "技能", "实习经历"]);
    expect(row?.originalText).not.toContain("DECOY");
  });

  it("两次上传 → 两个独立数据行与存储键(每次上传新行,不覆盖)", async () => {
    const storage = new FakeStorage();
    const buffer = readFileSync(path.join(fixturesDir, "sample-resume-cn.pdf"));
    const first = await handleResumeUpload({ userId, file: makeFile("第一份.pdf", buffer), storage });
    const second = await handleResumeUpload({ userId, file: makeFile("第一份.pdf", buffer), storage });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.resumeId).not.toBe(second.resumeId);
    const rows = await prisma.resume.findMany({ where: { userId } });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const firstRow = rows.find((r) => r.id === first.resumeId)!;
    const secondRow = rows.find((r) => r.id === second.resumeId)!;
    expect(firstRow.storageKey).not.toBe(secondRow.storageKey);
    expect(storage.saved.size).toBeGreaterThanOrEqual(2);
  });

  it("图片型 PDF(无文本层)→ 行保留:originalText=null + extractError=no-text", async () => {
    const storage = new FakeStorage();
    const outcome = await handleResumeUpload({
      userId,
      file: makeFile("扫描件.pdf", readFileSync(path.join(fixturesDir, "image-only.pdf"))),
      storage,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.extractError).toBe("no-text");
    expect(outcome.textLength).toBe(0);
    const row = await prisma.resume.findUnique({ where: { id: outcome.resumeId } });
    expect(row?.originalText).toBeNull();
    expect(row?.extractError).toBe("no-text");
    expect(row?.storageKey).toBeTruthy();
  });

  it(".doc(旧版 Word)→ doc-not-supported + 明确文案,不建行不存文件", async () => {
    const storage = new FakeStorage();
    const outcome = await handleResumeUpload({
      userId,
      file: makeFile("旧简历.doc", Buffer.from("fake-binary")),
      storage,
    });
    expect(outcome).toMatchObject({
      ok: false,
      code: "doc-not-supported",
      error: expect.stringContaining(".docx") as unknown as string,
    });
    expect(storage.saved.size).toBe(0);
  });

  it("不支持的扩展名(.txt)→ unsupported-type", async () => {
    const storage = new FakeStorage();
    const outcome = await handleResumeUpload({
      userId,
      file: makeFile("简历.txt", Buffer.from("文本")),
      storage,
    });
    expect(outcome).toMatchObject({ ok: false, code: "unsupported-type" });
    expect(storage.saved.size).toBe(0);
  });

  it("超过 10MB → too-large,不读取文件内容", async () => {
    const storage = new FakeStorage();
    const outcome = await handleResumeUpload({
      userId,
      file: {
        name: "大文件.pdf",
        type: "application/pdf",
        size: MAX_RESUME_SIZE_BYTES + 1,
        arrayBuffer: async () => {
          throw new Error("不应读取超大文件内容");
        },
      },
      storage,
    });
    expect(outcome).toMatchObject({ ok: false, code: "too-large" });
    expect(storage.saved.size).toBe(0);
  });

  it("存储失败 → storage-error,不建行", async () => {
    const storage = new FakeStorage();
    storage.failSave = true;
    const outcome = await handleResumeUpload({
      userId,
      file: makeFile("简历.pdf", readFileSync(path.join(fixturesDir, "sample-resume-cn.pdf"))),
      storage,
    });
    expect(outcome).toMatchObject({ ok: false, code: "storage-error" });
    const rows = await prisma.resume.findMany({ where: { userId, storageKey: { contains: "简历" } } });
    expect(rows.length).toBe(0);
  });

  it("建行失败 → 补偿删除已存文件(delete 幂等),异常上抛", async () => {
    const storage = new FakeStorage();
    const createSpy = vi
      .spyOn(prisma.resume, "create")
      .mockRejectedValueOnce(new Error("数据库连接中断"));
    try {
      await handleResumeUpload({
        userId,
        file: makeFile("简历.pdf", readFileSync(path.join(fixturesDir, "sample-resume-cn.pdf"))),
        storage,
      });
      expect.unreachable("建行失败应上抛异常");
    } catch (err) {
      expect((err as Error).message).toContain("数据库连接中断");
    } finally {
      createSpy.mockRestore();
    }
    expect(storage.deleted.length).toBe(1);
    expect(storage.saved.size).toBe(0);
  });
});
