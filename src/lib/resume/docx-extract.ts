// DOCX 文本框视觉排序提取(4.10 修复):简历模板(超级简历/WPS 等导出 Word)常用绝对定位文本框排版,
// 文本框在 document.xml 中的书写顺序与视觉顺序相反(z-order/创建序),mammoth 按文档顺序提取 → 模块乱序。
// 本模块用 jszip 解包 + saxes 单遍解析,按 wp:anchor 的 positionV/positionH(EMU)重建自上而下、自左而右的视觉顺序;
// 无文本框的普通文档返回 no-textboxes,由调用方回退 mammoth(既有行为不变)。
import JSZip from "jszip";
import { SaxesParser } from "saxes";

export type DocxBox = {
  /** positionV 偏移(EMU,视觉 y,上小下大);null = 无坐标(align 型)→ 排序置尾按文档序兜底 */
  y: number | null;
  /** positionH 偏移(EMU,视觉 x,左小右大) */
  x: number | null;
  /** 文本框内全部文本(w:br 换行,段落间 \n) */
  text: string;
  /** 锚点所在流式段落序号(用于组装时判断文本框在文档流中的位置) */
  flowIndex: number;
};

export type DocxLayout = {
  boxes: DocxBox[];
  /** 文本框外的非空流式段落(文档顺序;含锚点的段落自身文本丢弃——视觉内容在文本框里,防重复) */
  flowParas: { index: number; text: string }[];
};

export function parseDocxLayout(xml: string): DocxLayout {
  const boxes: DocxBox[] = [];
  const flowParas: { index: number; text: string }[] = [];

  let depthAnchor = 0; // wp:anchor 嵌套深度(>0 = 在文本框绘制对象内)
  let depthTxbx = 0; // w:txbxContent 深度(>0 = 在文本框内容内)
  let depthFallback = 0; // mc:Fallback 深度(VML 兜底内容与 Choice 重复,忽略)
  let posCapture: "v" | "h" | null = null; // 正在 positionV/H 内收集偏移数字
  let posBuf = "";
  let paraIndex = -1; // 流式段落序号(文档顺序)
  let paraText = ""; // 当前流式段落的文本
  let paraHasAnchor = false; // 当前段落是否承载了锚点(其自带文本随框走,不进流)

  const currentBox = (): DocxBox => boxes[boxes.length - 1]!;

  const parser = new SaxesParser();
  parser.on("opentag", (tag) => {
    switch (tag.name) {
      case "w:p": {
        // 文本框内部的段落只做换行,不开新流式段
        if (depthAnchor === 0 && depthTxbx === 0 && depthFallback === 0) {
          paraIndex++;
          paraText = "";
          paraHasAnchor = false;
        }
        break;
      }
      case "wp:anchor": {
        if (depthFallback > 0) break;
        if (depthAnchor === 0 && depthTxbx === 0) paraHasAnchor = true;
        boxes.push({ y: null, x: null, text: "", flowIndex: paraIndex });
        depthAnchor++;
        break;
      }
      case "w:txbxContent": {
        depthTxbx++;
        break;
      }
      case "mc:Fallback": {
        depthFallback++;
        break;
      }
      case "wp:positionV": {
        posCapture = "v";
        posBuf = "";
        break;
      }
      case "wp:positionH": {
        posCapture = "h";
        posBuf = "";
        break;
      }
      case "w:br": {
        if (depthAnchor > 0 && depthTxbx > 0 && depthFallback === 0) currentBox().text += "\n";
        break;
      }
    }
  });
  parser.on("text", (t) => {
    if (posCapture) {
      posBuf += t;
      return;
    }
    if (depthAnchor > 0) {
      if (depthTxbx > 0 && depthFallback === 0) currentBox().text += t;
      return;
    }
    if (depthTxbx === 0 && depthFallback === 0) paraText += t;
  });
  parser.on("closetag", (tag) => {
    switch (tag.name) {
      case "wp:positionV":
      case "wp:positionH": {
        if (posCapture) {
          const value = Number.parseInt(posBuf, 10);
          if (Number.isFinite(value)) {
            if (posCapture === "v") currentBox().y = value;
            else currentBox().x = value;
          }
          posCapture = null;
        }
        break;
      }
      case "mc:Fallback": {
        depthFallback = Math.max(0, depthFallback - 1);
        break;
      }
      case "w:txbxContent": {
        depthTxbx = Math.max(0, depthTxbx - 1);
        break;
      }
      case "wp:anchor": {
        depthAnchor = Math.max(0, depthAnchor - 1);
        break;
      }
      case "w:p": {
        if (depthAnchor > 0 && depthTxbx > 0 && depthFallback === 0) {
          currentBox().text += "\n"; // 文本框内段落分隔
          break;
        }
        if (depthAnchor === 0 && depthTxbx === 0 && depthFallback === 0) {
          if (paraText.trim() !== "" && !paraHasAnchor) {
            flowParas.push({ index: paraIndex, text: paraText });
          }
        }
        break;
      }
    }
  });
  parser.write(xml);
  parser.close();
  return { boxes, flowParas };
}

/** 文本框按视觉坐标排序组装:首个锚点之前的流式段落 → 坐标排序后的文本框 → 其余流式段落(近似,见取舍) */
export function assembleDocxVisualText(layout: DocxLayout): string {
  const sorted = [...layout.boxes].sort((a, b) => {
    const ay = a.y ?? Number.POSITIVE_INFINITY;
    const by = b.y ?? Number.POSITIVE_INFINITY;
    if (ay !== by) return ay - by;
    return (a.x ?? 0) - (b.x ?? 0);
  });
  const firstIndex = layout.boxes.length ? Math.min(...layout.boxes.map((b) => b.flowIndex)) : 0;
  const before = layout.flowParas.filter((p) => p.index < firstIndex).map((p) => p.text);
  const after = layout.flowParas.filter((p) => p.index >= firstIndex).map((p) => p.text);
  return [...before, ...sorted.map((b) => b.text.trim()), ...after]
    .filter((part) => part.trim() !== "")
    .join("\n\n");
}

export type DocxVisualExtract =
  | { ok: true; text: string }
  | { ok: false; code: "no-textboxes" | "invalid" };

export async function extractDocxVisualText(buffer: Buffer): Promise<DocxVisualExtract> {
  let xml: string;
  try {
    const zip = await JSZip.loadAsync(buffer);
    const entry = zip.file("word/document.xml");
    if (!entry) return { ok: false, code: "invalid" };
    xml = await entry.async("string");
  } catch {
    return { ok: false, code: "invalid" };
  }
  const layout = parseDocxLayout(xml);
  if (layout.boxes.length === 0) return { ok: false, code: "no-textboxes" };
  return { ok: true, text: assembleDocxVisualText(layout) };
}
