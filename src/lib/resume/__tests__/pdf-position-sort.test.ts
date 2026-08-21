// PDF 文本条目视觉排序纯函数测试(4.10 修复):
// 输入为内容流顺序(可乱序)的 pdf.js textContent items,断言输出为视觉阅读顺序
import { describe, expect, it } from "vitest";
import { sortPdfItemsByPosition, type PdfTextItem } from "../parser";

// 工具:构造 y/x 坐标的文本条目(transform = [1,0,0,1,x,y],y 向上)
function item(str: string, x: number, y: number, transform?: number[]): PdfTextItem {
  return { str, transform: transform ?? [1, 0, 0, 1, x, y] };
}

function lines(text: string): string[] {
  return text.split("\n").filter((l) => l !== "");
}

describe("sortPdfItemsByPosition(PDF 内容流 → 视觉顺序)", () => {
  it("标准五模块:内容流逆序输入 → 按 y 降序还原视觉顺序,CJK 行内无空格", () => {
    // 视觉顺序(上→下):基本信息 → 教育经历 → 技能 → 工作经历 → 项目经历
    const input = [
      item("项目经历", 72, 100),
      item("工作经历", 72, 160),
      item("技能", 72, 220),
      item("教育经历", 72, 280),
      item("基本信息", 72, 340),
    ];
    expect(lines(sortPdfItemsByPosition(input))).toEqual([
      "基本信息",
      "教育经历",
      "技能",
      "工作经历",
      "项目经历",
    ]);
  });

  it("用户反例顺序:基本信息→项目经历→教育经历→技能→实习经历,乱序输入还原", () => {
    // 乱序内容流:技能 → 基本信息 → 教育经历 → 实习经历 → 项目经历
    const input = [
      item("技能", 72, 200),
      item("基本信息", 72, 380),
      item("教育经历", 72, 260),
      item("实习经历", 72, 160),
      item("项目经历", 72, 320),
    ];
    expect(lines(sortPdfItemsByPosition(input))).toEqual([
      "基本信息",
      "项目经历",
      "教育经历",
      "技能",
      "实习经历",
    ]);
  });

  it("实习经历标题在 工作经历 之前 + 自定义模块插在中间:均按坐标还原", () => {
    const input = [
      item("自我评价", 72, 240), // 自定义模块
      item("工作经历", 72, 120),
      item("基本信息", 72, 360),
      item("实习经历", 72, 180),
    ];
    expect(lines(sortPdfItemsByPosition(input))).toEqual([
      "基本信息",
      "自我评价",
      "实习经历",
      "工作经历",
    ]);
  });

  it("同行多条目:按 x 升序拼接;拉丁词之间补空格", () => {
    // 同一视觉行(y=340):内容流先写右侧条目再写左侧 → 输出左→右
    const input = [
      item("Engineer", 200, 340),
      item("Zhang Wei", 72, 340),
    ];
    expect(lines(sortPdfItemsByPosition(input))).toEqual(["Zhang Wei Engineer"]);
  });

  it("同行 CJK 条目直接拼接,不产生空格", () => {
    const input = [
      item("出生年月:2000年1月", 200, 340),
      item("张伟", 72, 340),
    ];
    expect(lines(sortPdfItemsByPosition(input))).toEqual(["张伟出生年月:2000年1月"]);
  });

  it("y 微小波动(≤3)归为同一视觉行;相邻行(y 差 15)正确分行", () => {
    // 混排字号场景:同行两条目基线差 2 → 同行(CJK 之间不加空格);下一行 y 差 15 → 新行
    const input = [
      item("联系电话:138-0000-0000", 200, 338), // 与姓名基线差 2 → 同行
      item("张伟", 72, 340),
      item("教育背景", 72, 325), // 差 15 → 新行
    ];
    expect(lines(sortPdfItemsByPosition(input))).toEqual([
      "张伟联系电话:138-0000-0000",
      "教育背景",
    ]);
  });

  it("空 str 条目跳过;transform 缺失兜底不抛异常", () => {
    const input = [
      { str: "", transform: [1, 0, 0, 1, 72, 100] },
      { str: "项目经历", transform: [1, 0, 0, 1, 72, 200] },
      { str: "技能", transform: [] }, // 无坐标 → 按 0 兜底
    ];
    expect(lines(sortPdfItemsByPosition(input))).toEqual(["项目经历", "技能"]);
  });
});
