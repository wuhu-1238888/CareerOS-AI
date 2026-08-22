// 简历文件管理测试(4.1):空态/列表与下载链接/删除确认弹窗/确认后调接口 + toast + 刷新/取消不调
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeFiles } from "../resume-files";

type ResumeMeta = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  extractError: string | null;
  createdAt: string;
};

const mocks = vi.hoisted(() => ({
  listData: null as ResumeMeta[] | null,
  listLoading: false,
  deleteMutateAsync: vi.fn(),
  deletePending: false,
  invalidate: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ resume: { list: { invalidate: mocks.invalidate } } }),
    resume: {
      list: {
        useQuery: () => ({
          data: mocks.listData,
          isLoading: mocks.listLoading,
          isSuccess: !mocks.listLoading,
        }),
      },
      delete: {
        useMutation: (opts?: { onSuccess?: () => void | Promise<void> }) => ({
          mutateAsync: async (input: unknown) => {
            const result = await mocks.deleteMutateAsync(input);
            await opts?.onSuccess?.();
            return result;
          },
          isPending: mocks.deletePending,
        }),
      },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listLoading = false;
  mocks.deletePending = false;
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.deleteMutateAsync.mockResolvedValue({ ok: true });
});

describe("ResumeFiles(设置页简历文件管理)", () => {
  it("空列表:显示空态引导 + 「新增简历」入口(4.12)", async () => {
    mocks.listData = [];
    render(<ResumeFiles />);
    expect(await screen.findByText("暂无简历文件")).toBeInTheDocument();
    expect(screen.getByText(/前往「简历优化」页上传简历后/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /新增简历/ })).toHaveAttribute(
      "href",
      "/resume?upload=1"
    );
  });

  it("列表:渲染文件名/大小/日期,下载链接指向 /api/resume/download?id=", async () => {
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", mimeType: "application/pdf", sizeBytes: 204800, extractError: null, createdAt: "2026-08-01T00:00:00.000Z" },
      { id: "r2", fileName: null, mimeType: null, sizeBytes: null, extractError: null, createdAt: "2026-08-02T00:00:00.000Z" },
    ];
    render(<ResumeFiles />);
    expect(await screen.findByText("张伟简历.pdf")).toBeInTheDocument();
    expect(screen.getByText("粘贴的简历文本")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /下载/ });
    expect(link).toHaveAttribute("href", "/api/resume/download?id=r1");
    // 粘贴行无原文件,不显示下载按钮
    expect(screen.getAllByRole("link", { name: /下载/ })).toHaveLength(1);
  });

  it("列表(4.12):每行「查看」指向 /resume?resumeId=;无「更换简历」", async () => {
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", mimeType: "application/pdf", sizeBytes: 204800, extractError: null, createdAt: "2026-08-01T00:00:00.000Z" },
      { id: "r2", fileName: null, mimeType: null, sizeBytes: null, extractError: null, createdAt: "2026-08-02T00:00:00.000Z" },
    ];
    render(<ResumeFiles />);
    await screen.findByText("张伟简历.pdf");
    expect(screen.getAllByRole("link", { name: /查看/ })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: /查看/ })[0]).toHaveAttribute(
      "href",
      "/resume?resumeId=r1"
    );
    expect(screen.getAllByRole("link", { name: /查看/ })[1]).toHaveAttribute(
      "href",
      "/resume?resumeId=r2"
    );
    expect(screen.queryByRole("button", { name: "更换简历" })).not.toBeInTheDocument();
  });

  it("删除:点删除弹确认框(含文件名),确认后调接口 + 成功 toast + 刷新列表", async () => {
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", mimeType: "application/pdf", sizeBytes: 204800, extractError: null, createdAt: "2026-08-01T00:00:00.000Z" },
    ];
    render(
      <>
        <ResumeFiles />
        <Toaster />
      </>
    );
    await userEvent.setup().click(await screen.findByRole("button", { name: /删除/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/「张伟简历\.pdf」及其解析记录将被永久删除/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(mocks.deleteMutateAsync).toHaveBeenCalledWith({ id: "r1" }));
    expect(await screen.findByText("简历文件已删除")).toBeInTheDocument();
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
    // 弹窗关闭
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("删除取消:不调接口", async () => {
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", mimeType: "application/pdf", sizeBytes: 204800, extractError: null, createdAt: "2026-08-01T00:00:00.000Z" },
    ];
    render(<ResumeFiles />);
    await userEvent.setup().click(await screen.findByRole("button", { name: /删除/ }));
    await userEvent.setup().click(screen.getByRole("button", { name: "取消" }));
    expect(mocks.deleteMutateAsync).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("删除失败:错误 toast,弹窗保留", async () => {
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", mimeType: "application/pdf", sizeBytes: 204800, extractError: null, createdAt: "2026-08-01T00:00:00.000Z" },
    ];
    mocks.deleteMutateAsync.mockRejectedValue(new Error("简历不存在"));
    render(
      <>
        <ResumeFiles />
        <Toaster />
      </>
    );
    await userEvent.setup().click(await screen.findByRole("button", { name: /删除/ }));
    await userEvent.setup().click(screen.getByRole("button", { name: "确认删除" }));
    expect(await screen.findByText("简历不存在")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
