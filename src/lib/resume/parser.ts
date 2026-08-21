// 简历文本提取(4.2):PDF(pdf-parse)/ Word(mammoth,仅 .docx)提取纯文本,上传时同步执行。
// 图片型 PDF(无文本层)返回 no-text → 前端引导粘贴而非报错(零 OCR 成本);
// .doc(旧版 Word 二进制)不支持 → doc-not-supported 明确文案引导另存为 .docx 或 PDF。
import { extname } from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

export type ExtractErrorCode = "no-text" | "unsupported" | "doc-not-supported" | "invalid";

export type ExtractTextResult =
  | { ok: true; text: string }
  | { ok: false; code: ExtractErrorCode };

// 轻量清洗:去 NUL、统一换行、逐行去首尾空白(空行保留结构)、压缩 3+ 空行为 2 空行
function cleanText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// pdf.js 版本固定 v2.0.550;pdf.js 在 Node 中存在 xref 冷启动竞态(同一文件首次解析时好时坏),
// 失败重试两次(每次退避 50ms)兜底,重试后解析稳定
async function extractPdf(buffer: Buffer): Promise<ExtractTextResult> {
  let raw: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await pdfParse(buffer, { version: "v2.0.550" });
      raw = result.text;
      break;
    } catch {
      if (attempt === 2) return { ok: false, code: "invalid" };
      await new Promise((resolve) => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  const text = cleanText(raw ?? "");
  return text.length > 0 ? { ok: true, text } : { ok: false, code: "no-text" };
}

async function extractDocx(buffer: Buffer): Promise<ExtractTextResult> {
  let raw: string;
  try {
    const result = await mammoth.extractRawText({ buffer });
    raw = result.value;
  } catch {
    return { ok: false, code: "invalid" };
  }
  const text = cleanText(raw);
  return text.length > 0 ? { ok: true, text } : { ok: false, code: "no-text" };
}

export async function extractResumeText(params: {
  fileName: string;
  buffer: Buffer;
}): Promise<ExtractTextResult> {
  const ext = extname(params.fileName).toLowerCase();
  if (ext === ".pdf") return extractPdf(params.buffer);
  if (ext === ".docx") return extractDocx(params.buffer);
  if (ext === ".doc") return { ok: false, code: "doc-not-supported" };
  return { ok: false, code: "unsupported" };
}
