// Vercel Blob 存储(5.3):@vercel/blob 的 put/get/del 均支持以 pathname 为键 —— 关闭 addRandomSuffix 后
// pathname 即业务侧 storageKey(resumes/{userId}/{uuid}{ext}),与 BlobStorage 的键语义天然对应,无需键 → URL 映射。
// access 统一 private:文件本就经 EncryptedStorage 加密落盘,private 进一步禁止无凭证直读;下载由服务端
// getFileStorage().read 解密后返回,不向客户端暴露 Blob 直链。
// 凭据:SDK 2.8.0 隐式只认 BLOB_READ_WRITE_TOKEN;Vercel 新 Blob Store 面板注入的是
// NEW_BLOB_READ_WRITE_TOKEN → 此处显式读取并透传 token 选项(旧名保留回退,兼容旧环境/本地)。
// 删除幂等:BlobNotFoundError 视为已删除(与 LocalFSStorage 的 ENOENT 语义一致,DB 与文件删除可补偿)。
import { BlobNotFoundError, del, get, put } from "@vercel/blob";
import type { BlobStorage } from "./storage";
import { FileNotFoundError } from "./local-fs";

const READ_WRITE_TOKEN = process.env.NEW_BLOB_READ_WRITE_TOKEN ?? process.env.BLOB_READ_WRITE_TOKEN;
const TOKEN_OPTIONS = READ_WRITE_TOKEN ? { token: READ_WRITE_TOKEN } : {};

export class VercelBlobStorage implements BlobStorage {
  private readonly options = {
    access: "private" as const,
    addRandomSuffix: false,
    ...TOKEN_OPTIONS,
  };

  async save(key: string, data: Buffer): Promise<void> {
    await put(key, data, this.options);
  }

  async read(key: string): Promise<Buffer> {
    const result = await get(key, this.options);
    // 304(无 body)本场景不会出现(无条件请求),防御性按缺失处理
    if (!result || result.statusCode !== 200) throw new FileNotFoundError(key);
    return Buffer.from(await new Response(result.stream).arrayBuffer());
  }

  async delete(key: string): Promise<void> {
    try {
      if (READ_WRITE_TOKEN) await del(key, { token: READ_WRITE_TOKEN });
      else await del(key);
    } catch (err) {
      if (err instanceof BlobNotFoundError) return;
      throw err;
    }
  }
}
