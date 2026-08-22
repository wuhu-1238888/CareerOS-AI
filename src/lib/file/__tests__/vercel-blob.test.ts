// @vitest-environment node
// Vercel Blob 存储测试(5.3):put/get/del 以 pathname 为键直连(private 访问级)、
// 缺失读抛 FileNotFoundError、删除幂等(BlobNotFoundError 视为已删)、工厂接线(加密装饰器生效)
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileNotFoundError } from "../local-fs";
import { VercelBlobStorage } from "../vercel-blob";

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  BlobNotFoundError: class BlobNotFoundError extends Error {},
}));

vi.mock("@vercel/blob", () => ({
  put: mocks.put,
  get: mocks.get,
  del: mocks.del,
  BlobNotFoundError: mocks.BlobNotFoundError,
}));

const PRIVATE_OPTIONS = { access: "private", addRandomSuffix: false };

function mockGetResult(data: Buffer) {
  // get 返回体:内容在 stream(blob 字段仅元数据);200 = 完整响应
  return {
    statusCode: 200,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(data));
        controller.close();
      },
    }),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("VercelBlobStorage", () => {
  it("save:put 以 pathname 为键、private 访问级、关闭随机后缀", async () => {
    const storage = new VercelBlobStorage();
    await storage.save("resumes/u1/doc.pdf", Buffer.from("pdf-bytes"));
    expect(mocks.put).toHaveBeenCalledWith("resumes/u1/doc.pdf", Buffer.from("pdf-bytes"), PRIVATE_OPTIONS);
  });

  it("read:get 按同键取回并转 Buffer(roundtrip)", async () => {
    mocks.get.mockResolvedValue(mockGetResult(Buffer.from("简历内容")));
    const storage = new VercelBlobStorage();
    expect((await storage.read("resumes/u1/doc.pdf")).toString("utf-8")).toBe("简历内容");
    expect(mocks.get).toHaveBeenCalledWith("resumes/u1/doc.pdf", PRIVATE_OPTIONS);
  });

  it("read:get 返回 null(键不存在)→ 抛 FileNotFoundError(调用方转 404)", async () => {
    mocks.get.mockResolvedValue(null);
    const storage = new VercelBlobStorage();
    await expect(storage.read("resumes/u1/missing.pdf")).rejects.toBeInstanceOf(FileNotFoundError);
  });

  it("delete:del 按同键删除;BlobNotFoundError 幂等静默(与 LocalFS ENOENT 同语义)", async () => {
    const storage = new VercelBlobStorage();
    await storage.delete("resumes/u1/doc.pdf");
    expect(mocks.del).toHaveBeenCalledWith("resumes/u1/doc.pdf");
    mocks.del.mockRejectedValueOnce(new mocks.BlobNotFoundError());
    await expect(storage.delete("resumes/u1/missing.pdf")).resolves.toBeUndefined();
  });

  it("delete:其他错误向上抛出(不吞真故障)", async () => {
    mocks.del.mockRejectedValueOnce(new Error("network down"));
    const storage = new VercelBlobStorage();
    await expect(storage.delete("resumes/u1/doc.pdf")).rejects.toThrow("network down");
  });
});

describe("getFileStorage 工厂(vercel-blob 分支,5.3)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("FILE_STORAGE_PROVIDER=vercel-blob → EncryptedStorage(VercelBlobStorage):落库密文、读回明文", async () => {
    vi.stubEnv("FILE_STORAGE_PROVIDER", "vercel-blob");
    vi.stubEnv("FILE_ENCRYPTION_KEY", ""); // 测试环境走 NEXTAUTH_SECRET 派生(dev 兜底)
    const { getFileStorage } = await import("../storage");
    const storage = getFileStorage();

    await storage.save("resumes/u1/a.bin", Buffer.from("张三 138-0000-0000"));
    expect(mocks.put).toHaveBeenCalledTimes(1);
    const [keyArg, dataArg, optsArg] = mocks.put.mock.calls[0] as [string, Buffer, typeof PRIVATE_OPTIONS];
    expect(keyArg).toBe("resumes/u1/a.bin");
    expect(optsArg).toEqual(PRIVATE_OPTIONS);
    // 加密装饰器生效:上传到 Blob 的字节不含明文(信封加密)
    expect(dataArg.toString("utf-8")).not.toContain("138-0000-0000");

    // 读路径:Blob 返回密文 → 装饰器解密还原
    mocks.get.mockResolvedValue(mockGetResult(dataArg));
    const back = await storage.read("resumes/u1/a.bin");
    expect(back.toString("utf-8")).toBe("张三 138-0000-0000");

    // 删除路径透传
    await storage.delete("resumes/u1/a.bin");
    expect(mocks.del).toHaveBeenCalledWith("resumes/u1/a.bin");
  });
});
