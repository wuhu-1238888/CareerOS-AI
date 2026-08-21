// @vitest-environment node
// 简历文本提取测试(4.2):中文 PDF / DOCX fixture 提取一致且无乱码、图片型 PDF → no-text、
// .doc → doc-not-supported、其他类型 → unsupported、损坏文件 → invalid
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractResumeText } from "../parser";
import { SAMPLE_RESUME_TEXT } from "./fixtures/expected";

const fixturesDir = path.join(__dirname, "fixtures");

function readFixture(name: string): Buffer {
  return readFileSync(path.join(fixturesDir, name));
}

// 空白归一化:连续空白折叠为单个空格(提取器的换行/空格策略与版本无关的稳健比对)
function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

describe("extractResumeText", () => {
  it("中文 PDF:提取内容与样例文本逐行一致(无乱码/无缺字)", async () => {
    const result = await extractResumeText({
      fileName: "简历.pdf",
      buffer: readFixture("sample-resume-cn.pdf"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const extracted = result.text;
    for (const line of SAMPLE_RESUME_TEXT.split("\n")) {
      if (line.trim() === "") continue;
      expect(extracted).toContain(line);
    }
    // 与源文本整体对照(空白归一化后长度相当,防整段丢失)
    expect(normalize(extracted).length).toBeGreaterThanOrEqual(normalize(SAMPLE_RESUME_TEXT).length - 5);
  });

  it("DOCX:提取内容与样例文本一致(mammoth 逐段输出)", async () => {
    const result = await extractResumeText({
      fileName: "简历.docx",
      buffer: readFixture("sample-resume.docx"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(normalize(result.text)).toBe(normalize(SAMPLE_RESUME_TEXT));
  });

  it("图片型 PDF(无文本层)→ no-text,引导粘贴", async () => {
    const result = await extractResumeText({
      fileName: "扫描件.pdf",
      buffer: readFixture("image-only.pdf"),
    });
    expect(result).toEqual({ ok: false, code: "no-text" });
  });

  it(".doc(旧版 Word)→ doc-not-supported(提示另存为 .docx 或 PDF)", async () => {
    const result = await extractResumeText({
      fileName: "旧简历.doc",
      buffer: Buffer.from("fake-binary"),
    });
    expect(result).toEqual({ ok: false, code: "doc-not-supported" });
  });

  it("不支持的扩展名(.txt)→ unsupported", async () => {
    const result = await extractResumeText({
      fileName: "简历.txt",
      buffer: Buffer.from("文本"),
    });
    expect(result).toEqual({ ok: false, code: "unsupported" });
  });

  it("损坏的 PDF/Word 文件 → invalid(不抛异常)", async () => {
    const pdf = await extractResumeText({
      fileName: "坏文件.pdf",
      buffer: Buffer.from("this is not a pdf"),
    });
    expect(pdf).toEqual({ ok: false, code: "invalid" });
    const docx = await extractResumeText({
      fileName: "坏文件.docx",
      buffer: Buffer.from("this is not a docx"),
    });
    expect(docx).toEqual({ ok: false, code: "invalid" });
  });

  it("大写扩展名(.PDF)同样识别", async () => {
    const result = await extractResumeText({
      fileName: "RESUME.PDF",
      buffer: readFixture("sample-resume-cn.pdf"),
    });
    expect(result.ok).toBe(true);
  });
});
