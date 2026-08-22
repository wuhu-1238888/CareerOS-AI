// 简历 PDF 预览浮层测试(4.16 + 5.3):三态渲染(就绪下载锚点 / 加载 / 错误)、返回按钮、
// 就绪锚点点击下载 PDF 时记录导出埋点(resume-export);未就绪占位按钮不触发埋点。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumePdfPreview } from "../resume-pdf-preview";

const mocks = vi.hoisted(() => ({
  logExportMutate: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    resume: {
      logExport: { useMutation: () => ({ mutate: mocks.logExportMutate }) },
    },
  },
}));

const state = {
  url: null as string | null,
  loading: false,
  error: null as Error | null,
};

beforeEach(() => {
  vi.clearAllMocks();
  state.url = null;
  state.loading = false;
  state.error = null;
});

describe("ResumePdfPreview", () => {
  it("就绪态:下载锚点(download 属性)存在,点击记导出埋点", async () => {
    state.url = "blob:resume-pdf";
    render(<ResumePdfPreview state={state} onClose={() => {}} />);
    const anchor = screen.getByRole("link", { name: /下载 PDF/ });
    expect(anchor).toHaveAttribute("download", "简历-优化版.pdf");
    expect(anchor).toHaveAttribute("href", "blob:resume-pdf");
    const user = userEvent.setup();
    await user.click(anchor);
    expect(mocks.logExportMutate).toHaveBeenCalledTimes(1);
  });

  it("加载态:占位禁用按钮,无链接、不记埋点", async () => {
    state.loading = true;
    render(<ResumePdfPreview state={state} onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /下载 PDF/ })).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /下载 PDF/ }));
    expect(mocks.logExportMutate).not.toHaveBeenCalled();
  });

  it("错误态:失败说明文案;返回按钮触发 onClose", async () => {
    state.error = new Error("生成超时");
    const onClose = vi.fn();
    render(<ResumePdfPreview state={state} onClose={onClose} />);
    expect(screen.getByText("PDF 生成失败,请重试。")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "返回" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
