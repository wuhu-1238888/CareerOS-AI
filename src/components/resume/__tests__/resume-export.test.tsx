// 简历导出工具条测试(4.7;4.10-layout 修订:复制按钮已移入「最终文本预览」卡,此处仅覆盖 PDF 导出):
// 动态 import 的 react-pdf 与 PDF 文档组件全部 mock 隔离;
// 覆盖禁用态(零采纳或空文本)/ PDFDownloadLink 加载与就绪两态 / 最终文本透传给文档组件。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeExport } from "../resume-export";

const mocks = vi.hoisted(() => ({
  pdfState: { url: null as string | null, loading: false },
  docText: null as string | null,
}));

// PDFDownloadLink 桩:捕获 document 元素的 text prop(不真正渲染 react-pdf),并按 pdfState 回放 children
vi.mock("@react-pdf/renderer", () => ({
  PDFDownloadLink: ({
    document,
    children,
  }: {
    document: { props?: { text?: string } };
    fileName: string;
    children: (state: { url: string | null; loading: boolean }) => unknown;
  }) => {
    mocks.docText = document.props?.text ?? null;
    return children(mocks.pdfState);
  },
}));

// 文档组件以桩隔离(真实模块顶层 Font.register 在 jsdom 不可用)
vi.mock("../resume-pdf-document", () => ({ ResumePdfDocument: () => null }));

const finalText = "张伟\n求职意向:后端开发工程师\n\n工作经历\n主导日均 50 万笔订单系统研发";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pdfState = { url: null, loading: false };
  mocks.docText = null;
});

function renderExport(canExport = true, text: string | null = finalText) {
  const user = userEvent.setup();
  render(<ResumeExport finalText={text} canExport={canExport} />);
  return { user };
}

describe("ResumeExport 导出工具条(仅导出 PDF)", () => {
  it("零采纳(canExport=false):导出禁用 + 提示,不渲染 PDF 链接", () => {
    renderExport(false);
    expect(screen.getByRole("button", { name: "导出 PDF" })).toBeDisabled();
    expect(screen.getByText("尚未采纳任何修改")).toBeInTheDocument();
    expect(document.querySelector("a")).toBeNull();
  });

  it("最终文本为空(finalText=null):同样禁用 + 提示", () => {
    renderExport(true, null);
    expect(screen.getByRole("button", { name: "导出 PDF" })).toBeDisabled();
    expect(screen.getByText("尚未采纳任何修改")).toBeInTheDocument();
  });

  it("可导出且加载中:渲染「准备导出…」", async () => {
    mocks.pdfState = { url: null, loading: true };
    renderExport();
    expect(await screen.findByText("准备导出…")).toBeInTheDocument();
  });

  it("可导出且就绪:渲染下载链接并透传最终文本给文档组件", async () => {
    mocks.pdfState = { url: "blob:mock-pdf", loading: false };
    renderExport();
    const link = await screen.findByRole("link", { name: "导出 PDF" });
    expect(link).toHaveAttribute("href", "blob:mock-pdf");
    expect(mocks.docText).toBe(finalText);
  });
});
