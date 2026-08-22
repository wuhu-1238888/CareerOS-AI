// 简历中心测试(4.13,自设置页简历文件管理迁移):空态/列表与下载链接/继续优化与查看入口/删除确认弹窗/
// 确认后调接口 + toast + 刷新/取消不调;卡片不存在「更换简历」
// 4.15:「← 返回」—— 应用内(有历史/同源)→ router.back();直接打开(无历史)或外链(跨源)→ 回工作台 /dashboard
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeCenter } from "../resume-center";

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
  // 4.15:稳定 router 对象(与生产 useRouter 一致)
  router: { back: vi.fn(), replace: vi.fn(), push: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
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

describe("ResumeCenter(简历中心,4.13)", () => {
  it("4.15:「← 返回」渲染;应用内进入(有历史、同源)→ router.back() 回上一页", async () => {
    const lengthSpy = vi.spyOn(window.history, "length", "get").mockReturnValue(2);
    mocks.listData = [];
    render(<ResumeCenter />);
    await userEvent.setup().click(screen.getByRole("button", { name: /返回/ }));
    expect(mocks.router.back).toHaveBeenCalledTimes(1);
    expect(mocks.router.replace).not.toHaveBeenCalled();
    lengthSpy.mockRestore();
  });

  it("4.15:直接打开(无应用内历史)→ 回工作台 /dashboard", async () => {
    const lengthSpy = vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    mocks.listData = [];
    render(<ResumeCenter />);
    await userEvent.setup().click(screen.getByRole("button", { name: /返回/ }));
    expect(mocks.router.back).not.toHaveBeenCalled();
    expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard");
    lengthSpy.mockRestore();
  });

  it("4.15:外链进入(跨源 referrer,首载自站外)→ 回工作台 /dashboard,不把用户带出应用", async () => {
    const lengthSpy = vi.spyOn(window.history, "length", "get").mockReturnValue(2);
    const referrerSpy = vi.spyOn(document, "referrer", "get").mockReturnValue("https://example.com/");
    mocks.listData = [];
    render(<ResumeCenter />);
    await userEvent.setup().click(screen.getByRole("button", { name: /返回/ }));
    expect(mocks.router.back).not.toHaveBeenCalled();
    expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard");
    lengthSpy.mockRestore();
    referrerSpy.mockRestore();
  });

  it("空列表:显示空态引导 + 「新增简历」入口(4.12;4.14 带 from=resumes)", async () => {
    mocks.listData = [];
    render(<ResumeCenter />);
    expect(await screen.findByText("暂无简历")).toBeInTheDocument();
    expect(screen.getByText(/点击右上角「新增简历」上传或粘贴第一份简历/)).toBeInTheDocument();
    // 4.14:from=resumes 供上传视图退出时返回简历中心
    expect(screen.getByRole("link", { name: /新增简历/ })).toHaveAttribute(
      "href",
      "/resume?upload=1&from=resumes"
    );
  });

  it("列表:渲染文件名/大小/日期,下载链接指向 /api/resume/download?id=", async () => {
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", mimeType: "application/pdf", sizeBytes: 204800, extractError: null, createdAt: "2026-08-01T00:00:00.000Z" },
      { id: "r2", fileName: null, mimeType: null, sizeBytes: null, extractError: null, createdAt: "2026-08-02T00:00:00.000Z" },
    ];
    render(<ResumeCenter />);
    expect(await screen.findByText("张伟简历.pdf")).toBeInTheDocument();
    expect(screen.getByText("粘贴的简历文本")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /下载/ });
    expect(link).toHaveAttribute("href", "/api/resume/download?id=r1");
    // 粘贴行无原文件,不显示下载按钮
    expect(screen.getAllByRole("link", { name: /下载/ })).toHaveLength(1);
  });

  it("列表(4.13):每行「继续优化」与「查看」都指向 /resume?resumeId=;无「更换简历」", async () => {
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", mimeType: "application/pdf", sizeBytes: 204800, extractError: null, createdAt: "2026-08-01T00:00:00.000Z" },
      { id: "r2", fileName: null, mimeType: null, sizeBytes: null, extractError: null, createdAt: "2026-08-02T00:00:00.000Z" },
    ];
    render(<ResumeCenter />);
    await screen.findByText("张伟简历.pdf");
    const continueLinks = screen.getAllByRole("link", { name: /继续优化/ });
    expect(continueLinks).toHaveLength(2);
    expect(continueLinks[0]).toHaveAttribute("href", "/resume?resumeId=r1");
    expect(continueLinks[1]).toHaveAttribute("href", "/resume?resumeId=r2");
    const viewLinks = screen.getAllByRole("link", { name: /查看/ });
    expect(viewLinks).toHaveLength(2);
    expect(viewLinks[0]).toHaveAttribute("href", "/resume?resumeId=r1");
    expect(viewLinks[1]).toHaveAttribute("href", "/resume?resumeId=r2");
    expect(screen.queryByRole("button", { name: "更换简历" })).not.toBeInTheDocument();
  });

  it("提取失败行:caption 标注「待补全」", async () => {
    mocks.listData = [
      { id: "r1", fileName: "图片型简历.pdf", mimeType: "application/pdf", sizeBytes: 1024, extractError: "no-text", createdAt: "2026-08-01T00:00:00.000Z" },
    ];
    render(<ResumeCenter />);
    expect(await screen.findByText(/待补全:粘贴简历文本/)).toBeInTheDocument();
  });

  it("删除:点删除弹确认框(含文件名),确认后调接口 + 成功 toast + 刷新列表", async () => {
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", mimeType: "application/pdf", sizeBytes: 204800, extractError: null, createdAt: "2026-08-01T00:00:00.000Z" },
    ];
    render(
      <>
        <ResumeCenter />
        <Toaster />
      </>
    );
    await userEvent.setup().click(await screen.findByRole("button", { name: /删除/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/「张伟简历\.pdf」及其解析与优化记录将被永久删除/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(mocks.deleteMutateAsync).toHaveBeenCalledWith({ id: "r1" }));
    expect(await screen.findByText("简历已删除")).toBeInTheDocument();
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
    // 弹窗关闭
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("删除取消:不调接口", async () => {
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", mimeType: "application/pdf", sizeBytes: 204800, extractError: null, createdAt: "2026-08-01T00:00:00.000Z" },
    ];
    render(<ResumeCenter />);
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
        <ResumeCenter />
        <Toaster />
      </>
    );
    await userEvent.setup().click(await screen.findByRole("button", { name: /删除/ }));
    await userEvent.setup().click(screen.getByRole("button", { name: "确认删除" }));
    expect(await screen.findByText("简历不存在")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
