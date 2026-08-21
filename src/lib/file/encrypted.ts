// 加密存储装饰器(4.1):AES-256-GCM 透明加解密,包装任意 BlobStorage。
// 单文件信封格式:MAGIC(2B "CE")+ IV(12B) + 密文 + AuthTag(16B,Node GCM 附在密文尾部)。
// 同一内容两次保存 IV 随机 → 密文不同;密文不含明文特征;篡改/损坏读取时抛错。
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { BlobStorage } from "./storage";

const MAGIC = Buffer.from("CE", "ascii");
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENVELOPE_HEADER_LENGTH = MAGIC.length + IV_LENGTH;

export class EncryptedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptedFileError";
  }
}

export class EncryptedStorage implements BlobStorage {
  constructor(private inner: BlobStorage, private key: Buffer) {}

  async save(key: string, data: Buffer): Promise<void> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
    const tag = cipher.getAuthTag();
    await this.inner.save(key, Buffer.concat([MAGIC, iv, encrypted, tag]));
  }

  async read(key: string): Promise<Buffer> {
    const envelope = await this.inner.read(key);
    if (envelope.length < ENVELOPE_HEADER_LENGTH + AUTH_TAG_LENGTH || !envelope.subarray(0, 2).equals(MAGIC)) {
      throw new EncryptedFileError("文件格式损坏,无法解密");
    }
    const iv = envelope.subarray(2, ENVELOPE_HEADER_LENGTH);
    const encrypted = envelope.subarray(ENVELOPE_HEADER_LENGTH, envelope.length - AUTH_TAG_LENGTH);
    const tag = envelope.subarray(envelope.length - AUTH_TAG_LENGTH);
    const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
    decipher.setAuthTag(tag);
    try {
      return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    } catch {
      throw new EncryptedFileError("文件已被篡改或密钥不匹配,无法解密");
    }
  }

  delete(key: string): Promise<void> {
    return this.inner.delete(key);
  }
}
