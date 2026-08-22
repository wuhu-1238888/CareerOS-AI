// 简历导出工具条测试(4.7;4.10-layout 修订;4.16 修订):动态 import 的 react-pdf 与 PDF 文档组件全部 mock 隔离。
// 4.16:PDFDownloadLink 改 BlobProvider + 应用内预览浮层 —— 覆盖 禁用态(零采纳/空文本,主视图零锚点)/
// 点击开浮层(BlobProvider 挂载透传 finalText)/ 加载/失败/就绪三态(iframe + 下载锚点)/ 返回关闭/
// 重新打开 = 全新挂载(核心回归:「Back 后无法再次导出」)/ Escape 关闭。
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeExport } from "../resume-export";

const mocks = vi.hoisted(() => ({
  pdfState: { url: null as string | null, loading: false, error: null as Error | null },
  docText: null as string | null,
  blobProviderMounts: 0,
  logExportMutate: vi.fn(),
}));

// 5.3:浮层内下载锚点调用导出埋点 mutation
vi.mock("@/trpc/client", () => ({
  trpc: {
    resume: {
      logExport: { useMutation: () => ({ mutate: mocks.logExportMutate }) },
    },
  },
}));

// BlobProvider 桩:捕获 document 元素的 text prop(不真正渲染 react-pdf),按 pdfState 回放
// children,并计数挂载次数(4.16 重新打开 = 全新挂载的回归依据)
vi.mock("@react-pdf/renderer", () => ({
  BlobProvider: ({
    document,
    children,
  }: {
    document: { props?: { text?: string } };
    children: (state: { url: string | null; loading: boolean; error: Error | null }) => unknown;
  }) => {
    mocks.docText = document.props?.text ?? null;
    mocks.blobProviderMounts += 1;
    return children(mocks.pdfState);
  },
}));

// 文档组件以桩隔离(真实模块顶层 Font.register 在 jsdom 不可用)
vi.mock("../resume-pdf-document", () => ({ ResumePdfDocument: () => null }));

const finalText = "张伟\n求职意向:后端开发工程师\n\n工作经历\n主导日均 50 万笔订单系统研发";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pdfState = { url: null, loading: false, error: null };
  mocks.docText = null;
  mocks.blobProviderMounts = 0;
});

/** 等动态 import 完成(按钮 enabled)后点击「导出 PDF」打开浮层 */
async function openPreview(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByRole("button", { name: "导出 PDF" })).toBeEnabled());
  await user.click(screen.getByRole("button", { name: "导出 PDF" }));
}

describe("ResumeExport(简历导出,4.7/4.16)", () => {
  it("零采纳(canExport=false):按钮禁用 + 提示;主视图零锚点、无浮层", async () => {
    render(<ResumeExport finalText={finalText} canExport={false} />);
    const btn = await screen.findByRole("button", { name: "导出 PDF" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "尚未采纳任何修改");
    expect(screen.getByText("尚未采纳任何修改")).toBeInTheDocument();
    expect(document.querySelector("a")).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("最终文本为空(finalText=null):同样禁用 + 提示,无浮层", async () => {
    render(<ResumeExport finalText={null} canExport />);
    const btn = await screen.findByRole("button", { name: "导出 PDF" });
    expect(btn).toBeDisabled();
    expect(screen.getByText("尚未采纳任何修改")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("可导出(4.16):点击打开浮层;BlobProvider 挂载透传 canonical finalText,不预生成(打开前零锚点)", async () => {
    const user = userEvent.setup();
    render(<ResumeExport finalText={finalText} canExport />);
    await waitFor(() => expect(screen.getByRole("button", { name: "导出 PDF" })).toBeEnabled());
    expect(document.querySelector("a")).toBeNull(); // 主视图不再有锚点(生成懒于打开时)
    await user.click(screen.getByRole("button", { name: "导出 PDF" }));
    expect(await screen.findByRole("dialog", { name: "PDF 预览" })).toBeInTheDocument();
    expect(mocks.docText).toBe(finalText);
    expect(mocks.blobProviderMounts).toBe(1);
  });

  it("生成中(loading):浮层内转圈「正在生成 PDF…」,无 iframe,下载按钮禁用", async () => {
    mocks.pdfState = { url: null, loading: true, error: null };
    const user = userEvent.setup();
    render(<ResumeExport finalText={finalText} canExport />);
    await openPreview(user);
    expect(await screen.findByText("正在生成 PDF…")).toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("button", { name: "下载 PDF" })).toBeDisabled();
  });

  it("生成失败(error):错误面板含原因;点「返回」可退出(错误态可退出)", async () => {
    mocks.pdfState = { url: null, loading: false, error: new Error("render boom") };
    const user = userEvent.setup();
    render(<ResumeExport finalText={finalText} canExport />);
    await openPreview(user);
    expect(await screen.findByText("PDF 生成失败,请重试。")).toBeInTheDocument();
    expect(screen.getByText("render boom")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("就绪(ready):iframe 预览 blob URL + 「下载 PDF」锚点带 download 属性", async () => {
    mocks.pdfState = { url: "blob:mock-pdf", loading: false, error: null };
    const user = userEvent.setup();
    render(<ResumeExport finalText={finalText} canExport />);
    await openPreview(user);
    expect(await screen.findByRole("dialog", { name: "PDF 预览" })).toBeInTheDocument();
    const frame = document.querySelector("iframe");
    expect(frame).not.toBeNull();
    expect(frame).toHaveAttribute("src", "blob:mock-pdf");
    expect(frame).toHaveAttribute("title", "PDF 预览");
    const link = screen.getByRole("link", { name: "下载 PDF" });
    expect(link).toHaveAttribute("href", "blob:mock-pdf");
    expect(link).toHaveAttribute("download", "简历-优化版.pdf");
  });

  it("「返回」关闭浮层:对话框/iframe/下载链接全消失,导出按钮恢复可点", async () => {
    mocks.pdfState = { url: "blob:mock-pdf", loading: false, error: null };
    const user = userEvent.setup();
    render(<ResumeExport finalText={finalText} canExport />);
    await openPreview(user);
    await screen.findByRole("dialog", { name: "PDF 预览" });
    await user.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.queryByRole("link", { name: "下载 PDF" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导出 PDF" })).toBeEnabled();
  });

  it("重新打开(4.16 核心回归):关闭后再点导出 → 浮层再现且 BlobProvider 全新挂载(新 blob)", async () => {
    mocks.pdfState = { url: "blob:mock-pdf", loading: false, error: null };
    const user = userEvent.setup();
    render(<ResumeExport finalText={finalText} canExport />);
    await openPreview(user);
    await screen.findByRole("dialog", { name: "PDF 预览" });
    await user.click(screen.getByRole("button", { name: "返回" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    mocks.pdfState = { url: "blob:mock-pdf-2", loading: false, error: null };
    await user.click(screen.getByRole("button", { name: "导出 PDF" }));
    expect(await screen.findByRole("dialog", { name: "PDF 预览" })).toBeInTheDocument();
    expect(document.querySelector("iframe")).toHaveAttribute("src", "blob:mock-pdf-2");
    expect(mocks.blobProviderMounts).toBe(2);
  });

  it("Escape 关闭浮层", async () => {
    mocks.pdfState = { url: "blob:mock-pdf", loading: false, error: null };
    const user = userEvent.setup();
    render(<ResumeExport finalText={finalText} canExport />);
    await openPreview(user);
    await screen.findByRole("dialog", { name: "PDF 预览" });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
