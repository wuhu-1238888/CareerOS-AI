// 简历文本提取(4.2):PDF(pdf-parse)/ Word(mammoth,仅 .docx)提取纯文本,上传时同步执行。
// 图片型 PDF(无文本层)返回 no-text → 前端引导粘贴而非报错(零 OCR 成本);
// .doc(旧版 Word 二进制)不支持 → doc-not-supported 明确文案引导另存为 .docx 或 PDF。
// 4.10 修复:两种格式均按视觉坐标重建阅读顺序(PDF 内容流 z-order / DOCX 文本框锚点序),见函数内注释。
import { extname } from "node:path";
import mammoth from "mammoth";
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { extractDocxVisualText } from "./docx-extract";

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

// PDF 文本条目(pdf.js getTextContent 的 item 结构子集):transform[4]=x、transform[5]=y
export type PdfTextItem = { str: string; transform: number[] };

// 同一视觉行的 y 容差(同字体基线一致、混排字号可能差 1-3pt;正常行距 ≥ 12pt,不会误并相邻行)
const LINE_Y_TOLERANCE = 3;

// CJK 字符范围(汉字/日韩扩展 + CJK 标点 + 全角符号):相邻 CJK 之间不加空格
const CJK_CHAR = /[㐀-䶿一-鿿　-〿＀-￯]/;

// 按视觉坐标重建阅读顺序(4.10 修复):pdf-parse 默认按 PDF 内容流顺序拼接文本,
// 简历生成工具常按层叠(z-order)顺序写内容流 → 提取文本乱序。
// 此处改为 y 降序(PDF 坐标 y 向上,页面顶部 y 最大)、同行按 x 升序;相邻 CJK 直接拼接,否则补空格
export function sortPdfItemsByPosition(items: PdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => {
    const ay = a.transform[5] ?? 0;
    const by = b.transform[5] ?? 0;
    if (Math.abs(ay - by) <= LINE_Y_TOLERANCE) {
      return (a.transform[4] ?? 0) - (b.transform[4] ?? 0);
    }
    return by - ay;
  });
  const lines: string[] = [];
  let currentY: number | null = null;
  let line = "";
  for (const item of sorted) {
    const str = item.str ?? "";
    if (str === "") continue;
    const y = item.transform[5] ?? 0;
    if (currentY === null || Math.abs(y - currentY) > LINE_Y_TOLERANCE) {
      if (line !== "") lines.push(line);
      line = str;
      currentY = y;
      continue;
    }
    const prev = line.slice(-1);
    const next = str[0] ?? "";
    line += prev !== "" && next !== "" && !(CJK_CHAR.test(prev) && CJK_CHAR.test(next)) ? " " : "";
    line += str;
  }
  if (line !== "") lines.push(line);
  return lines.join("\n");
}

// 自定义页渲染:getTextContent 选项与 pdf-parse 默认一致(合并同行 run、不归一化空白),仅替换排序逻辑
function pagerender(pageData: {
  getTextContent(options: {
    normalizeWhitespace: boolean;
    disableCombineTextItems: boolean;
  }): Promise<{ items: PdfTextItem[] }>;
}): Promise<string> {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false })
    .then((textContent) => sortPdfItemsByPosition(textContent.items));
}

// pdf.js 版本固定 v2.0.550;pdf.js 在 Node 中存在 xref 冷启动竞态(同一文件首次解析时好时坏),
// 失败重试两次(每次退避 50ms)兜底,重试后解析稳定
async function extractPdf(buffer: Buffer): Promise<ExtractTextResult> {
  let raw: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await pdfParse(buffer, { version: "v2.0.550", pagerender });
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
  // 4.10 修复:先按文本框视觉坐标提取(绝对定位模板的 XML 顺序与视觉顺序相反);
  // 无文本框的普通文档回退 mammoth(既有行为不变)
  const visual = await extractDocxVisualText(buffer);
  if (visual.ok) {
    const text = cleanText(visual.text);
    return text.length > 0 ? { ok: true, text } : { ok: false, code: "no-text" };
  }
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
