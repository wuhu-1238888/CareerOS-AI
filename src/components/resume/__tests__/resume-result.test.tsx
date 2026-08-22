// 简历优化结果视图测试(4.5):方向与采纳计数渲染、全部接受(成功 toast + 失效刷新 / 失败 toast)、
// 全部已采纳禁用、重新分析/修改信息回调、单条接受走 updateOptimization;
// 4.7:导出工具条接线(ResumeExport 子组件以 stub 隔离,其内部行为由 resume-export.test.tsx 覆盖);
// 4.10-layout:预览卡内复制按钮(与预览同源)+ 信息层级顺序断言(对比卡 → 最终文本预览 → ATS 评分);
// 4.13:「上传新简历」按钮触发 onReupload 回调 + 「查看全部简历」链接指向 /resumes + 当前简历名显示。
// 注意:userEvent.setup() 会安装自己的剪贴板桩,因此 clipboard/execCommand 必须在 setup 之后 stub。
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster, toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeResult, type ResultVersion } from "../resume-result";

const mocks = vi.hoisted(() => ({
  updateMutateAsync: vi.fn(),
  acceptAllMutateAsync: vi.fn(),
  scoreAtsMutateAsync: vi.fn(),
  invalidateResume: vi.fn(),
  writeText: vi.fn(),
  execCommand: vi.fn(),
  exportProps: null as { finalText: string | null; canExport: boolean } | null,
}));

// 导出工具条 stub:捕获 props 并渲染占位(避免 jsdom 加载真实 react-pdf)
vi.mock("../resume-export", () => ({
  ResumeExport: (props: { finalText: string | null; canExport: boolean }) => {
    mocks.exportProps = props;
    return <div data-testid="resume-export" />;
  },
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ resume: { get: { invalidate: mocks.invalidateResume } } }),
    resume: {
      updateOptimization: { useMutation: () => ({ mutateAsync: mocks.updateMutateAsync }) },
      acceptAll: { useMutation: () => ({ mutateAsync: mocks.acceptAllMutateAsync }) },
      scoreAts: { useMutation: () => ({ mutateAsync: mocks.scoreAtsMutateAsync }) },
    },
  },
}));

const version: ResultVersion = {
  id: "v1",
  targetDirection: "后端开发工程师",
  changes: { modificationCount: 2 },
  finalText: "张伟\n求职意向:后端开发工程师\n\n教育经历\n某大学 计算机科学 本科\n\n工作经历\n负责订单系统开发",
  atsScore: null,
  atsReport: null,
  atsScoredAt: null,
  createdAt: "2026-08-20T10:00:00Z",
  optimizations: [
    {
      id: "o1",
      category: "量化表达",
      originalText: "负责订单系统开发",
      optimizedText: "主导日均 50 万笔订单系统研发",
      reason: "量化成果更具说服力",
      status: "pending",
      updatedAt: "2026-08-20T10:00:00Z",
    },
    {
      id: "o2",
      category: "动词开头",
      originalText: "参与了新功能",
      optimizedText: "主导新功能设计与落地",
      reason: null,
      status: "accepted",
      updatedAt: "2026-08-20T10:00:00Z",
    },
  ],
};

function renderResult(
  onReanalyze = vi.fn(),
  onEdit = vi.fn(),
  onReupload = vi.fn(),
  resumeName?: string
) {
  const user = userEvent.setup();
  render(
    <>
      <Toaster />
      <ResumeResult
        version={version}
        resumeName={resumeName}
        onReanalyze={onReanalyze}
        onEdit={onEdit}
        onReupload={onReupload}
      />
    </>
  );
  return { user, onReanalyze, onEdit, onReupload };
}

function stubClipboard(writeText: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    value: writeText === undefined ? undefined : { writeText },
    configurable: true,
    writable: true,
  });
}

function stubExecCommand() {
  Object.defineProperty(document, "execCommand", {
    value: mocks.execCommand,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exportProps = null;
  mocks.invalidateResume.mockResolvedValue(undefined);
  mocks.updateMutateAsync.mockResolvedValue({ id: "o1", status: "accepted" });
  mocks.acceptAllMutateAsync.mockResolvedValue({ ok: true });
  mocks.writeText.mockResolvedValue(undefined);
  mocks.execCommand.mockReturnValue(true);
  mocks.scoreAtsMutateAsync.mockResolvedValue({
    versionId: "v1",
    total: 72,
    level: "良好",
    runId: "run-ats",
  });
});

afterEach(() => {
  stubClipboard(undefined);
  // sonner 单例 store:同一 toast 文案跨用例存活,避免污染
  toast.dismiss();
});

describe("ResumeResult 结果视图", () => {
  it("渲染目标方向、采纳计数与对比卡列表", () => {
    renderResult();
    expect(screen.getByText(/目标方向:后端开发工程师/)).toBeInTheDocument();
    expect(screen.getByText("已采纳 1/2")).toBeInTheDocument();
    expect(screen.getByText("负责订单系统开发")).toBeInTheDocument();
    expect(screen.getByText("主导日均 50 万笔订单系统研发")).toBeInTheDocument();
    expect(screen.getByText("主导新功能设计与落地")).toBeInTheDocument();
  });

  it("导出工具条:渲染并透传最终文本与采纳状态(4.7)", () => {
    renderResult();
    expect(screen.getByTestId("resume-export")).toBeInTheDocument();
    expect(mocks.exportProps).toEqual({
      finalText: version.finalText,
      canExport: true,
    });
  });

  it("零采纳:导出工具条 canExport=false(4.7)", () => {
    const noneAccepted: ResultVersion = {
      ...version,
      optimizations: version.optimizations.map((o) => ({ ...o, status: "pending" as const })),
    };
    render(
      <ResumeResult version={noneAccepted} onReanalyze={() => {}} onEdit={() => {}} onReupload={() => {}} />
    );
    expect(screen.getByTestId("resume-export")).toBeInTheDocument();
    expect(mocks.exportProps).toEqual({ finalText: version.finalText, canExport: false });
  });

  it("全部接受:acceptAll(versionId)+ 失效刷新 + 成功 toast", async () => {
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "全部接受" }));
    await waitFor(() => expect(mocks.acceptAllMutateAsync).toHaveBeenCalledWith({ versionId: "v1" }));
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
    expect(await screen.findByText("已全部采纳,最终文本已更新")).toBeInTheDocument();
  });

  it("全部接受失败:错误 toast", async () => {
    mocks.acceptAllMutateAsync.mockRejectedValueOnce(new Error("优化版本不存在"));
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "全部接受" }));
    expect(await screen.findByText("优化版本不存在")).toBeInTheDocument();
    expect(mocks.invalidateResume).not.toHaveBeenCalled();
  });

  it("全部已采纳:「全部接受」禁用", () => {
    const allAccepted: ResultVersion = {
      ...version,
      optimizations: version.optimizations.map((o) => ({ ...o, status: "accepted" })),
    };
    render(
      <ResumeResult version={allAccepted} onReanalyze={() => {}} onEdit={() => {}} onReupload={() => {}} />
    );
    expect(screen.getByText("已采纳 2/2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部接受" })).toBeDisabled();
  });

  it("最终文本预览(4.10):渲染与复制/导出同源的 finalText 字符串", () => {
    renderResult();
    expect(screen.getByText("最终文本预览")).toBeInTheDocument();
    expect(
      screen.getByText("最终准备投递的简历全文,与复制按钮、导出 PDF 完全一致,按你原始简历的模块顺序输出")
    ).toBeInTheDocument();
    const pre = screen.getByLabelText("最终文本预览");
    expect(pre.textContent).toBe(version.finalText);
    // 与导出工具条同源
    expect(mocks.exportProps?.finalText).toBe(version.finalText);
  });

  it("信息层级(4.10-layout):预览在对比卡之后、ATS 评分之前", () => {
    renderResult();
    const preview = screen.getByLabelText("最终文本预览");
    const cardText = screen.getByText("负责订单系统开发");
    const atsHeading = screen.getByText("ATS 评分");
    expect(
      cardText.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      atsHeading.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_PRECEDING
    ).toBeTruthy();
  });

  it("预览卡内复制按钮:writeText 收到与预览同源的 finalText + 成功 toast", async () => {
    const { user } = renderResult();
    stubClipboard(mocks.writeText);
    await user.click(screen.getByRole("button", { name: "复制最终文本" }));
    expect(mocks.writeText).toHaveBeenCalledWith(version.finalText);
    expect(await screen.findByText("已复制最终文本")).toBeInTheDocument();
  });

  it("剪贴板不可用:回退 execCommand 复制成功 toast", async () => {
    const { user } = renderResult();
    stubClipboard(undefined);
    stubExecCommand();
    await user.click(screen.getByRole("button", { name: "复制最终文本" }));
    expect(mocks.execCommand).toHaveBeenCalledWith("copy");
    expect(await screen.findByText("已复制最终文本")).toBeInTheDocument();
  });

  it("剪贴板与 execCommand 均失败:错误 toast", async () => {
    const { user } = renderResult();
    stubClipboard(undefined);
    stubExecCommand();
    mocks.execCommand.mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "复制最终文本" }));
    expect(await screen.findByText("复制失败,请手动选择文本复制")).toBeInTheDocument();
  });

  it("零采纳:复制按钮禁用 + 提示(预览卡与导出工具条)", () => {
    const noneAccepted: ResultVersion = {
      ...version,
      optimizations: version.optimizations.map((o) => ({ ...o, status: "pending" as const })),
    };
    render(<ResumeResult version={noneAccepted} onReanalyze={() => {}} onEdit={() => {}} onReupload={() => {}} />);
    expect(screen.getByRole("button", { name: "复制最终文本" })).toBeDisabled();
    expect(screen.getAllByText("尚未采纳任何修改").length).toBeGreaterThan(0);
  });

  it("finalText 为空:预览面板显示占位文案 + 复制按钮禁用", () => {
    render(
      <ResumeResult
        version={{ ...version, finalText: null }}
        onReanalyze={() => {}}
        onEdit={() => {}}
        onReupload={() => {}}
      />
    );
    expect(screen.queryByLabelText("最终文本预览")).toBeNull();
    expect(screen.getByText("采纳建议后,此处将显示最终简历全文")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "复制最终文本" })).toBeDisabled();
  });

  it("重新分析 / 修改信息 / 上传新简历:触发回调(4.13)", async () => {
    const { user, onReanalyze, onEdit, onReupload } = renderResult();
    await user.click(screen.getByRole("button", { name: "重新分析" }));
    expect(onReanalyze).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "修改信息" }));
    expect(onEdit).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "上传新简历" }));
    expect(onReupload).toHaveBeenCalled();
  });

  it("「查看全部简历」(4.13):链接指向简历中心 /resumes", () => {
    renderResult();
    expect(screen.getByRole("link", { name: "查看全部简历" })).toHaveAttribute("href", "/resumes");
  });

  it("「当前简历」(4.13):resumeName 显示在 Hero 左区", () => {
    renderResult(vi.fn(), vi.fn(), vi.fn(), "产品经理简历.pdf");
    expect(screen.getByText("当前简历:产品经理简历.pdf")).toBeInTheDocument();
  });

  it("单条接受:updateOptimization(optimizationId, accepted)+ 失效刷新", async () => {
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "接受" }));
    await waitFor(() =>
      expect(mocks.updateMutateAsync).toHaveBeenCalledWith({
        optimizationId: "o1",
        status: "accepted",
      })
    );
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
  });

  it("单条状态变更失败:错误 toast,不失效刷新", async () => {
    mocks.updateMutateAsync.mockRejectedValueOnce(new Error("修改建议不存在"));
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "接受" }));
    expect(await screen.findByText("修改建议不存在")).toBeInTheDocument();
    expect(mocks.invalidateResume).not.toHaveBeenCalled();
  });
});
