// 简历上传业务逻辑(4.1):Route Handler 薄壳之外的全部逻辑 —— 类型校验/大小上限/文本提取/加密存储/建行。
// 每次上传新建 Resume 行(永不覆盖旧文件);建行失败补偿删除已存文件(delete 幂等,不抛补偿错误)。
// storage 可注入(测试用假实现),缺省走全局加密存储工厂。
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getFileStorage, type BlobStorage } from "@/lib/file/storage";
import { extractResumeText } from "./parser";

export const MAX_RESUME_SIZE_BYTES = 10 * 1024 * 1024; // 10MB 上限(PRD 3.3.3)

// 浏览器 File 的结构子集(测试可直接用普通对象,不依赖 File 全局)
export type UploadFile = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ResumeUploadErrorCode = "unsupported-type" | "doc-not-supported" | "too-large" | "storage-error";

export type ResumeUploadOutcome =
  | { ok: true; resumeId: string; textLength: number; extractError: string | null }
  | { ok: false; error: string; code: ResumeUploadErrorCode };

export async function handleResumeUpload(params: {
  userId: string;
  file: UploadFile;
  storage?: BlobStorage;
}): Promise<ResumeUploadOutcome> {
  const { userId, file } = params;
  const storage = params.storage ?? getFileStorage();

  const ext = extname(file.name).toLowerCase();
  if (ext === ".doc") {
    return {
      ok: false,
      error: "暂不支持旧版 .doc 格式,请在 Word 中另存为 .docx 或导出为 PDF 后上传",
      code: "doc-not-supported",
    };
  }
  if (ext !== ".pdf" && ext !== ".docx") {
    return { ok: false, error: "仅支持 PDF 或 Word(.docx)格式的简历", code: "unsupported-type" };
  }
  if (file.size > MAX_RESUME_SIZE_BYTES) {
    return { ok: false, error: "文件超过 10MB 上限,请压缩后再上传", code: "too-large" };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const extracted = await extractResumeText({ fileName: file.name, buffer });

  // 提取成功与否都保留原始文件(原文保留原则);提取失败行 extractError 供前端引导粘贴
  const storageKey = `resumes/${userId}/${randomUUID()}${ext}`;
  try {
    await storage.save(storageKey, buffer);
  } catch {
    return { ok: false, error: "文件存储失败,请稍后重试", code: "storage-error" };
  }

  try {
    const row = await prisma.resume.create({
      data: {
        userId,
        originalText: extracted.ok ? extracted.text : null,
        fileName: file.name,
        mimeType: file.type || null,
        sizeBytes: file.size,
        storageKey,
        extractError: extracted.ok ? null : extracted.code,
      },
    });
    return {
      ok: true,
      resumeId: row.id,
      textLength: extracted.ok ? extracted.text.length : 0,
      extractError: extracted.ok ? null : extracted.code,
    };
  } catch (err) {
    // 建行失败:补偿删除已存文件(幂等,失败忽略),异常交 Route Handler 转 500
    await storage.delete(storageKey).catch(() => undefined);
    throw err;
  }
}
