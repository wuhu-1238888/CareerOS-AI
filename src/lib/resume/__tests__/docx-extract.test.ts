// DOCX 文本框视觉排序提取纯函数测试(4.10 修复):
// parseDocxLayout 对 document.xml 字符串做结构解析,assembleDocxVisualText 按坐标组装视觉顺序
import { describe, expect, it } from "vitest";
import { assembleDocxVisualText, parseDocxLayout } from "../docx-extract";

// 与 build-textbox-docx.ts 同构的最小 XML 片段:一个锚点文本框
function anchorXml(id: number, yIn: number, xIn: number, text: string, extra = ""): string {
  const emu = (inch: number) => Math.round(inch * 914400);
  return `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="1" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1"><wp:simplePos x="0" y="0"/>${extra}<wp:positionH relativeFrom="column"><wp:posOffset>${emu(xIn)}</wp:posOffset></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${emu(yIn)}</wp:posOffset></wp:positionV><wp:extent cx="1000000" cy="1000000"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/><wp:docPr id="${id}" name="框 ${id}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:cNvPr id="${id}" name="框 ${id}"/><wps:spPr/><wps:txbx><w:txbxContent><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict><v:textbox><w:txbxContent><w:p><w:r><w:t>DECOY-${id}</w:t></w:r></w:p></w:txbxContent></v:textbox></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>`;
}

function docXml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:mc="http://schemas.openxmlformats.org/officeDocument/2006/markup-compatibility" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:v="urn:schemas-microsoft-com:vml"><w:body>${body}<w:sectPr/></w:body></w:document>`;
}

function order(text: string): string[] {
  return text.split("\n\n").map((p) => p.trim()).filter((p) => p !== "");
}

describe("parseDocxLayout + assembleDocxVisualText(文本框 XML 逆序 → 视觉顺序)", () => {
  it("文本框 XML 逆序写入 → 按 positionV 升序还原视觉顺序,诱饵 DECOY 被忽略", () => {
    // 视觉顺序(上→下):基本信息 → 教育背景 → 项目经历 → 荣誉证书;XML 故意逆序
    const body =
      anchorXml(1, 10.5, 0.4, "荣誉证书") +
      anchorXml(2, 3.4, 0.4, "项目经历") +
      anchorXml(3, 1.3, 0.4, "教育背景") +
      anchorXml(4, 0.34, 0.4, "基本信息");
    const layout = parseDocxLayout(docXml(body));
    expect(layout.boxes).toHaveLength(4);
    expect(order(assembleDocxVisualText(layout))).toEqual([
      "基本信息",
      "教育背景",
      "项目经历",
      "荣誉证书",
    ]);
    for (const part of order(assembleDocxVisualText(layout))) {
      expect(part).not.toContain("DECOY");
    }
  });

  it("用户反例顺序:基本信息→项目经历→教育经历→技能→实习经历", () => {
    const body =
      anchorXml(1, 5.5, 0.4, "实习经历") +
      anchorXml(2, 4.0, 0.4, "技能") +
      anchorXml(3, 2.8, 0.4, "教育经历") +
      anchorXml(4, 2.0, 0.4, "项目经历") +
      anchorXml(5, 0.5, 0.4, "基本信息");
    const layout = parseDocxLayout(docXml(body));
    expect(order(assembleDocxVisualText(layout))).toEqual([
      "基本信息",
      "项目经历",
      "教育经历",
      "技能",
      "实习经历",
    ]);
  });

  it("同 y 的两个文本框按 x 升序排列", () => {
    const body =
      anchorXml(1, 2.0, 4.0, "右侧栏") +
      anchorXml(2, 2.0, 0.4, "左侧栏");
    const layout = parseDocxLayout(docXml(body));
    expect(order(assembleDocxVisualText(layout))).toEqual(["左侧栏", "右侧栏"]);
  });

  it("align 型无 posOffset → y=null 置尾,按文档序兜底", () => {
    const body =
      anchorXml(1, 8.0, 0.4, "页面底部") +
      `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH><wp:positionV relativeFrom="paragraph"><wp:posOffset>${Math.round(0.5 * 914400)}</wp:posOffset></wp:positionV><wp:extent cx="1" cy="1"/><wp:wrapNone/><a:graphic xmlns:a="x"><a:graphicData uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"><wps:wsp><wps:txbx><w:txbxContent><w:p><w:r><w:t>顶部居中</w:t></w:r></w:p></w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice></mc:AlternateContent></w:r></w:p>`;
    const layout = parseDocxLayout(docXml(body));
    expect(order(assembleDocxVisualText(layout))).toEqual(["顶部居中", "页面底部"]);
  });

  it("文本框内多段落与 w:br 换行保留", () => {
    const body = anchorXml(
      1,
      1.0,
      0.4,
      "",
      ""
    ).replace(
      "<w:txbxContent><w:p><w:r><w:t>",
      "<w:txbxContent><w:p><w:r><w:t>第一段</w:t><w:br/><w:t>换行</w:t></w:r></w:p><w:p><w:r><w:t>第二段</w:t></w:r></w:p><w:p><w:r><w:t>"
    );
    const layout = parseDocxLayout(docXml(body));
    expect(layout.boxes[0]?.text).toContain("第一段\n换行\n第二段");
  });

  it("首个锚点之前的流式段落保持在文本框之前,之后的流式段落置后", () => {
    // 流式段 0(锚点前)→ 锚点(段 1)→ 流式段 2(锚点后)
    const body =
      `<w:p><w:r><w:t>页眉说明</w:t></w:r></w:p>` +
      anchorXml(1, 2.0, 0.4, "文本框内容") +
      `<w:p><w:r><w:t>页脚说明</w:t></w:r></w:p>`;
    const layout = parseDocxLayout(docXml(body));
    expect(order(assembleDocxVisualText(layout))).toEqual([
      "页眉说明",
      "文本框内容",
      "页脚说明",
    ]);
  });

  it("锚点段落自身的文本丢弃(视觉内容在文本框内,防重复)", () => {
    // 锚点与其自带文本同段:文本随框走,不再作为流式段落输出
    const anchor = anchorXml(1, 1.0, 0.4, "真正的标题").replace(/^<w:p>/, "").replace(/<\/w:p>$/, "");
    const body = `<w:p><w:r><w:t>重复的标题</w:t></w:r>${anchor}</w:p>`;
    const layout = parseDocxLayout(docXml(body));
    expect(order(assembleDocxVisualText(layout))).toEqual(["真正的标题"]);
  });

  it("无文本框 → boxes 为空;组装退化为流式文本(入口函数在此之前已返回 no-textboxes)", () => {
    const body = `<w:p><w:r><w:t>普通段落</w:t></w:r></w:p>`;
    const layout = parseDocxLayout(docXml(body));
    expect(layout.boxes).toHaveLength(0);
    expect(assembleDocxVisualText(layout)).toBe("普通段落");
  });
});
