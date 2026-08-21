// 简历优化结果视图测试(4.5):方向与采纳计数渲染、全部接受(成功 toast + 失效刷新 / 失败 toast)、
// 全部已采纳禁用、重新分析/修改信息回调、单条接受走 updateOptimization;
// 4.7:导出工具条接线(ResumeExport 子组件以 stub 隔离,其内部行为由 resume-export.test.tsx 覆盖)
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeResult, type ResultVersion } from "../resume-result";

const mocks = vi.hoisted(() => ({
  updateMutateAsync: vi.fn(),
  acceptAllMutateAsync: vi.fn(),
  scoreAtsMutateAsync: vi.fn(),
  invalidateResume: vi.fn(),
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

function renderResult(onReanalyze = vi.fn(), onEdit = vi.fn()) {
  const user = userEvent.setup();
  render(
    <>
      <Toaster />
      <ResumeResult version={version} onReanalyze={onReanalyze} onEdit={onEdit} />
    </>
  );
  return { user, onReanalyze, onEdit };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.exportProps = null;
  mocks.invalidateResume.mockResolvedValue(undefined);
  mocks.updateMutateAsync.mockResolvedValue({ id: "o1", status: "accepted" });
  mocks.acceptAllMutateAsync.mockResolvedValue({ ok: true });
  mocks.scoreAtsMutateAsync.mockResolvedValue({
    versionId: "v1",
    total: 72,
    level: "良好",
    runId: "run-ats",
  });
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
      <ResumeResult version={noneAccepted} onReanalyze={() => {}} onEdit={() => {}} />
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
      <ResumeResult version={allAccepted} onReanalyze={() => {}} onEdit={() => {}} />
    );
    expect(screen.getByText("已采纳 2/2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部接受" })).toBeDisabled();
  });

  it("重新分析 / 修改信息:触发回调", async () => {
    const { user, onReanalyze, onEdit } = renderResult();
    await user.click(screen.getByRole("button", { name: "重新分析" }));
    expect(onReanalyze).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "修改信息" }));
    expect(onEdit).toHaveBeenCalled();
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
