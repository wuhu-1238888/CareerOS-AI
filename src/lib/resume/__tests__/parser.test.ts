// @vitest-environment node
// 简历文本提取测试(4.2):中文 PDF / DOCX fixture 提取一致且无乱码、图片型 PDF → no-text、
// .doc → doc-not-supported、其他类型 → unsupported、损坏文件 → invalid;
// 4.10 修复:z-order 乱序 PDF / 文本框逆序 DOCX → 提取为视觉顺序
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractResumeText } from "../parser";
import { SAMPLE_RESUME_TEXT } from "./fixtures/expected";
import { buildSimplePdf } from "./fixtures/build-pdf";
import { buildTextboxDocx } from "./fixtures/build-textbox-docx";

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

  it("4.10:z-order 乱序 PDF(内容流逆序)→ 提取为视觉顺序,同行按 x 拼接", async () => {
    // 视觉顺序(上→下):Zhang Wei Engineer / Education / Skills / Experience / Projects;
    // 内容流故意整体逆序(含同行条目逆序)写入,模拟简历工具按层叠序导出
    const visualLines = [
      { x: 72, y: 740, text: "Zhang Wei" },
      { x: 180, y: 740, text: "Engineer" },
      { x: 72, y: 700, text: "Education" },
      { x: 72, y: 660, text: "Skills" },
      { x: 72, y: 620, text: "Experience" },
      { x: 72, y: 580, text: "Projects" },
    ];
    const result = await extractResumeText({
      fileName: "乱序.pdf",
      buffer: buildSimplePdf([...visualLines].reverse()),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const extracted = result.text.split("\n").map((l) => l.trim()).filter((l) => l !== "");
    expect(extracted).toEqual([
      "Zhang Wei Engineer",
      "Education",
      "Skills",
      "Experience",
      "Projects",
    ]);
  });

  it("4.10:文本框逆序 DOCX → 提取为视觉顺序,Fallback 诱饵不重复", async () => {
    // 视觉顺序(上→下):基本信息 → 项目经历 → 教育经历 → 技能 → 实习经历;XML 故意逆序
    const buffer = await buildTextboxDocx([
      { yIn: 5.5, xIn: 0.4, text: "实习经历" },
      { yIn: 4.0, xIn: 0.4, text: "技能" },
      { yIn: 2.8, xIn: 0.4, text: "教育经历" },
      { yIn: 2.0, xIn: 0.4, text: "项目经历" },
      { yIn: 0.5, xIn: 0.4, text: "基本信息" },
    ]);
    const result = await extractResumeText({ fileName: "模板简历.docx", buffer });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const order = result.text.split("\n\n").map((p) => p.trim()).filter((p) => p !== "");
    expect(order).toEqual(["基本信息", "项目经历", "教育经历", "技能", "实习经历"]);
    expect(result.text).not.toContain("DECOY");
  });

  it("4.10:无文本框的普通 DOCX → 回退 mammoth,行为不变(回归)", async () => {
    const result = await extractResumeText({
      fileName: "简历.docx",
      buffer: readFixture("sample-resume.docx"),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(normalize(result.text)).toBe(normalize(SAMPLE_RESUME_TEXT));
  });
});
