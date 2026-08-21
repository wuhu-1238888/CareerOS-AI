// @vitest-environment node
// 文件存储层测试(4.1):本地 FS 读写删/键安全/删除幂等;加密装饰器 roundtrip/密文无明文特征/
// IV 随机/篡改检测/密钥不匹配;密钥解析(base64/hex/生产缺 key fail closed/开发派生)
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { EncryptedFileError, EncryptedStorage } from "../encrypted";
import { FileNotFoundError, LocalFSStorage } from "../local-fs";
import { resolveEncryptionKey, type BlobStorage } from "../storage";

const tmpRoot = mkdtempSync(path.join(tmpdir(), "careeros-storage-"));
afterAll(() => rmSync(tmpRoot, { recursive: true, force: true }));

const key = Buffer.alloc(32, 7);

// 内存实现:密文观察/篡改注入用
class MemoryStorage implements BlobStorage {
  files = new Map<string, Buffer>();
  async save(k: string, data: Buffer) {
    this.files.set(k, Buffer.from(data));
  }
  async read(k: string) {
    const data = this.files.get(k);
    if (!data) throw new FileNotFoundError(k);
    return data;
  }
  async delete(k: string) {
    this.files.delete(k);
  }
}

describe("LocalFSStorage", () => {
  it("save/read roundtrip;delete 后 read 抛 FileNotFoundError", async () => {
    const storage = new LocalFSStorage(path.join(tmpRoot, "a"));
    await storage.save("resumes/u1/a.txt", Buffer.from("你好"));
    expect((await storage.read("resumes/u1/a.txt")).toString("utf-8")).toBe("你好");
    await storage.delete("resumes/u1/a.txt");
    await expect(storage.read("resumes/u1/a.txt")).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it("delete 幂等:键不存在时静默成功", async () => {
    const storage = new LocalFSStorage(path.join(tmpRoot, "b"));
    await expect(storage.delete("missing/key.bin")).resolves.toBeUndefined();
  });

  it("拒绝目录穿越与绝对路径键", async () => {
    const storage = new LocalFSStorage(path.join(tmpRoot, "c"));
    await expect(storage.save("../escape.txt", Buffer.from("x"))).rejects.toThrow("非法的存储键");
    await expect(storage.save("C:/abs.txt", Buffer.from("x"))).rejects.toThrow("非法的存储键");
  });
});

describe("EncryptedStorage", () => {
  it("roundtrip:保存后读回一致(中文二进制内容)", async () => {
    const inner = new MemoryStorage();
    const storage = new EncryptedStorage(inner, key);
    const payload = Buffer.from("张伟的简历内容\n联系电话:138-0000-0000");
    await storage.save("r1", payload);
    expect((await storage.read("r1")).toString("utf-8")).toBe(payload.toString("utf-8"));
  });

  it("密文不含明文特征:信封带 MAGIC+IV 头部", async () => {
    const inner = new MemoryStorage();
    const storage = new EncryptedStorage(inner, key);
    await storage.save("r1", Buffer.from("联系电话:138-0000-0000"));
    const raw = inner.files.get("r1")!;
    expect(raw.toString("utf-8")).not.toContain("138-0000-0000");
    expect(raw.subarray(0, 2).toString("ascii")).toBe("CE");
    expect(raw.length).toBe(2 + 12 + Buffer.byteLength("联系电话:138-0000-0000") + 16);
  });

  it("同一内容两次保存 IV 随机 → 密文不同", async () => {
    const inner = new MemoryStorage();
    const storage = new EncryptedStorage(inner, key);
    const payload = Buffer.from("相同内容");
    await storage.save("a", payload);
    await storage.save("b", payload);
    expect(inner.files.get("a")!.equals(inner.files.get("b")!)).toBe(false);
  });

  it("篡改密文 → 抛 EncryptedFileError", async () => {
    const inner = new MemoryStorage();
    const storage = new EncryptedStorage(inner, key);
    await storage.save("r1", Buffer.from("数据"));
    const raw = inner.files.get("r1")!;
    raw[20] = raw[20]! ^ 0xff;
    await expect(storage.read("r1")).rejects.toBeInstanceOf(EncryptedFileError);
  });

  it("损坏信封(截断/魔数不符)→ 抛 EncryptedFileError", async () => {
    const inner = new MemoryStorage();
    const storage = new EncryptedStorage(inner, key);
    inner.files.set("short", Buffer.from("CEshort"));
    inner.files.set("badmagic", Buffer.concat([Buffer.from("XX"), Buffer.alloc(40, 1)]));
    await expect(storage.read("short")).rejects.toBeInstanceOf(EncryptedFileError);
    await expect(storage.read("badmagic")).rejects.toBeInstanceOf(EncryptedFileError);
  });

  it("密钥不匹配 → 抛 EncryptedFileError", async () => {
    const inner = new MemoryStorage();
    await new EncryptedStorage(inner, key).save("r1", Buffer.from("数据"));
    await expect(new EncryptedStorage(inner, Buffer.alloc(32, 9)).read("r1")).rejects.toBeInstanceOf(
      EncryptedFileError
    );
  });

  it("delete 透传到底层存储", async () => {
    const inner = new MemoryStorage();
    const storage = new EncryptedStorage(inner, key);
    await storage.save("r1", Buffer.from("x"));
    await storage.delete("r1");
    expect(inner.files.has("r1")).toBe(false);
  });
});

describe("resolveEncryptionKey(环境变量)", () => {
  const env = process.env;

  it("base64 与 hex 格式均解析为 32 字节;非法格式抛错", () => {
    vi.stubEnv("FILE_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("base64"));
    expect(resolveEncryptionKey().length).toBe(32);
    vi.stubEnv("FILE_ENCRYPTION_KEY", "ab".repeat(32));
    expect(resolveEncryptionKey().equals(Buffer.alloc(32, 0xab))).toBe(true);
    vi.stubEnv("FILE_ENCRYPTION_KEY", "too-short");
    expect(() => resolveEncryptionKey()).toThrow("格式不正确");
  });

  it("生产环境缺 key → 抛错禁用上传(fail closed)", () => {
    vi.stubEnv("FILE_ENCRYPTION_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => resolveEncryptionKey()).toThrow("已禁用简历上传");
  });

  it("开发环境缺 key → 从 NEXTAUTH_SECRET 确定性派生(两次一致)", () => {
    vi.stubEnv("FILE_ENCRYPTION_KEY", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXTAUTH_SECRET", "secret-1");
    const a = resolveEncryptionKey();
    const b = resolveEncryptionKey();
    expect(a.equals(b)).toBe(true);
    vi.stubEnv("NEXTAUTH_SECRET", "secret-2");
    expect(resolveEncryptionKey().equals(a)).toBe(false);
  });

  afterAll(() => {
    process.env = env;
  });
});
