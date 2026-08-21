// 本地文件系统存储(4.1):MVP 实现,rootDir 注入(生产可指向持久卷,UPLOAD_DIR 配置)。
// delete 幂等:ENOENT 视为已删除;read 缺失抛 FileReadError(调用方转 404)。
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BlobStorage } from "./storage";

export class FileNotFoundError extends Error {
  constructor(key: string) {
    super(`文件不存在:${key}`);
    this.name = "FileNotFoundError";
  }
}

export class LocalFSStorage implements BlobStorage {
  constructor(private rootDir: string) {}

  private resolve(key: string): string {
    // 防目录穿越:key 不得包含 .. 或绝对路径
    if (key.includes("..") || path.isAbsolute(key)) {
      throw new Error(`非法的存储键:${key}`);
    }
    return path.join(this.rootDir, key);
  }

  async save(key: string, data: Buffer): Promise<void> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
  }

  async read(key: string): Promise<Buffer> {
    try {
      return await readFile(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        throw new FileNotFoundError(key);
      }
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }
}
