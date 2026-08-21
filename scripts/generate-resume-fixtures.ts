// 简历解析测试 fixture 生成脚本(4.2,开发期一次性运行,产物提交仓库):
//   node --import tsx scripts/generate-resume-fixtures.ts
// 产物:
//   src/lib/resume/__tests__/fixtures/sample-resume-cn.pdf  中文文本简历(pdfkit 嵌入子集字体)
//   src/lib/resume/__tests__/fixtures/sample-resume.docx    同内容 Word(jszip 手工构造最小 docx)
//   src/lib/resume/__tests__/fixtures/image-only.pdf        纯图形无文本层(图片型 PDF 场景)
// 中文 PDF 字体按序探测:public/fonts/NotoSansSC(4.7 就绪后优先)→ Windows 系统黑体/雅黑。
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import JSZip from "jszip";
import { SAMPLE_RESUME_TEXT } from "../src/lib/resume/__tests__/fixtures/expected";

const OUT_DIR = path.join(process.cwd(), "src/lib/resume/__tests__/fixtures");

function findChineseFont(): string {
  const candidates = [
    path.join(process.cwd(), "public/fonts/NotoSansSC-Regular.otf"),
    "C:/Windows/Fonts/simhei.ttf",
    "C:/Windows/Fonts/msyh.ttc",
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("未找到可用中文字体,请下载 Noto Sans SC 到 public/fonts/ 或使用 Windows 系统字体");
}

async function generatePdf() {
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  doc.font(findChineseFont()).fontSize(16);
  for (const line of SAMPLE_RESUME_TEXT.split("\n")) {
    if (line.trim() === "") doc.moveDown(0.5);
    else doc.text(line, { lineGap: 2 });
  }
  doc.end();
  const buffer = await done;
  writeFileSync(path.join(OUT_DIR, "sample-resume-cn.pdf"), buffer);
  console.log("generated sample-resume-cn.pdf", buffer.length, "bytes");
}

// 最小可解析 docx:Content_Types + rels + document.xml(mammoth.extractRawText 只读正文段落)
async function generateDocx() {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );
  const paragraphs = SAMPLE_RESUME_TEXT.split("\n")
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${line === "" ? " " : escapeXml(line)}</w:t></w:r></w:p>`
    )
    .join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}</w:body>
</w:document>`
  );
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  writeFileSync(path.join(OUT_DIR, "sample-resume.docx"), buffer);
  console.log("generated sample-resume.docx", buffer.length, "bytes");
}

// 图片型 PDF(无有效文本层):色块矩形 + 单个空格字符(嵌入字体)。
// 与 sample-resume-cn.pdf 同构(含字体对象,规避 pdf.js 对无字体最小 PDF 的 xref 解析问题),
// 提取结果为纯空白 → 清洗后空文本 → no-text 场景
async function generateImageOnlyPdf() {
  const doc = new PDFDocument({ size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  doc.rect(50, 50, 200, 120).fill("#c0c0c0");
  doc.rect(300, 200, 150, 300).fill("#808080");
  doc.fillColor("black").font(findChineseFont()).fontSize(1).text(" ", 600, 760);
  doc.end();
  const buffer = await done;
  writeFileSync(path.join(OUT_DIR, "image-only.pdf"), buffer);
  console.log("generated image-only.pdf", buffer.length, "bytes");
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await generatePdf();
  await generateDocx();
  await generateImageOnlyPdf();
}

void main();
