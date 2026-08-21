// 文件存储抽象(4.1):上传/下载/删除三操作的最小接口,业务代码只依赖本接口。
// 加密由 EncryptedStorage 装饰器提供,与具体存储实现解耦 —— 5.3 切换 Vercel Blob 时加密承诺不丢。
// 密钥策略:FILE_ENCRYPTION_KEY(base64 或 hex 的 32 字节)显式配置;生产环境缺 key 首次使用时抛错
// (fail closed:禁止未加密上传),开发环境从 NEXTAUTH_SECRET SHA-256 派生并告警。
import { createHash } from "node:crypto";
import path from "node:path";
import { EncryptedStorage } from "./encrypted";
import { LocalFSStorage } from "./local-fs";

export interface BlobStorage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<Buffer>;
  /** 幂等:键不存在时视为已删除,不抛错(DB 与文件删除的补偿简单化) */
  delete(key: string): Promise<void>;
}

// 密钥解析:base64 优先,hex 次之;均为 32 字节(AES-256)
function decodeKey(raw: string): Buffer {
  const value = raw.trim();
  const base64 = Buffer.from(value, "base64");
  if (base64.length === 32 && Buffer.from(base64.toString("base64"), "base64").equals(base64)) {
    return base64;
  }
  if (/^[0-9a-fA-F]{64}$/.test(value)) {
    return Buffer.from(value, "hex");
  }
  throw new Error("FILE_ENCRYPTION_KEY 格式不正确:须为 32 字节的 base64 或 64 位 hex");
}

// 开发环境缺 key:从 NEXTAUTH_SECRET 派生(确定性,重启不变);生产环境缺 key:抛错禁用上传
export function resolveEncryptionKey(): Buffer {
  const raw = process.env.FILE_ENCRYPTION_KEY;
  if (raw) return decodeKey(raw);
  if (process.env.NODE_ENV === "production") {
    throw new Error("未配置文件加密密钥(FILE_ENCRYPTION_KEY),已禁用简历上传");
  }
  console.warn("[file-storage] 开发环境未配置 FILE_ENCRYPTION_KEY,使用 NEXTAUTH_SECRET 派生密钥");
  return createHash("sha256").update(process.env.NEXTAUTH_SECRET ?? "").digest();
}

let cached: BlobStorage | null = null;

// 存储工厂:FILE_STORAGE_PROVIDER=local 默认;vercel-blob 于 5.3 接入
export function getFileStorage(): BlobStorage {
  if (cached) return cached;
  const provider = (process.env.FILE_STORAGE_PROVIDER ?? "local").trim();
  let base: BlobStorage;
  if (provider === "local") {
    base = new LocalFSStorage(process.env.UPLOAD_DIR ?? path.join(process.cwd(), "storage"));
  } else if (provider === "vercel-blob") {
    throw new Error("vercel-blob 存储尚未接入(计划于 5.3 实现),请改用 local");
  } else {
    throw new Error(`未知的 FILE_STORAGE_PROVIDER:${provider}`);
  }
  cached = new EncryptedStorage(base, resolveEncryptionKey());
  return cached;
}
