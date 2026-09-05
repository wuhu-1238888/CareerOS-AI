// 简历优化结果视图测试(4.5):方向与采纳计数渲染、全部接受(成功 toast + 失效刷新 / 失败 toast)、
// 全部已采纳禁用、重新分析/修改信息回调、单条接受走 updateOptimization;
// 4.7:导出工具条接线(ResumeExport 子组件以 stub 隔离,其内部行为由 resume-export.test.tsx 覆盖);
// 4.10-layout:预览卡内复制按钮(与预览同源)+ 信息层级顺序断言(对比卡 → 最终文本预览 → ATS 评分);
// 4.13:「上传新简历」按钮触发 onReupload 回调 + 「查看全部简历」链接指向「我的简历」Tab(/resume?tab=resumes)+ 当前简历名显示。
// 6.6:版本选择器(2026-09 常显:菜单 = 版本列表 + 分隔 + 另存为新版本;多版本切换渲染旧版本,动作作用于当前行)、
// 另存为新版本(菜单项 + 确认 Dialog)、删除版本(确认 Dialog/末版禁用)。
// IA 调整 2026-09:全部接受移入 AI 建议区标题行(先确认后执行:取消零变化/确认走 acceptAll);
// 导出 PDF 移入最终文本预览区(ResumeExport stub 接线不变,props 仍透传 finalText)。
// 注意:userEvent.setup() 会安装自己的剪贴板桩,因此 clipboard/execCommand 必须在 setup 之后 stub。
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster, toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeResult, type ResultVersion } from "../resume-result";

type VersionRow = {
  id: string;
  targetDirection: string | null;
  atsScore: number | null;
  createdAt: string;
};

const mocks = vi.hoisted(() => ({
  updateMutateAsync: vi.fn(),
  acceptAllMutateAsync: vi.fn(),
  scoreAtsMutateAsync: vi.fn(),
  logExportMutate: vi.fn(),
  invalidateResume: vi.fn(),
  invalidateVersions: vi.fn(),
  invalidateGetVersion: vi.fn(),
  duplicateMutateAsync: vi.fn(),
  duplicatePending: false,
  deleteMutateAsync: vi.fn(),
  versionsData: [] as VersionRow[],
  getVersionData: undefined as ResultVersion | undefined,
  getVersionEnabled: false,
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
    useUtils: () => ({
      resume: {
        get: { invalidate: mocks.invalidateResume },
        listVersions: { invalidate: mocks.invalidateVersions },
        getVersion: { invalidate: mocks.invalidateGetVersion },
      },
    }),
    resume: {
      updateOptimization: { useMutation: () => ({ mutateAsync: mocks.updateMutateAsync }) },
      acceptAll: { useMutation: () => ({ mutateAsync: mocks.acceptAllMutateAsync }) },
      scoreAts: { useMutation: () => ({ mutateAsync: mocks.scoreAtsMutateAsync }) },
      logExport: { useMutation: () => ({ mutate: mocks.logExportMutate }) },
      listVersions: { useQuery: () => ({ data: mocks.versionsData, isLoading: false }) },
      getVersion: {
        useQuery: (_input: { versionId: string }, opts?: { enabled?: boolean }) => {
          mocks.getVersionEnabled = opts?.enabled ?? false;
          return { data: mocks.getVersionData, isLoading: false };
        },
      },
      duplicateVersion: {
        useMutation: () => ({
          mutateAsync: mocks.duplicateMutateAsync,
          isPending: mocks.duplicatePending,
        }),
      },
      deleteVersion: { useMutation: () => ({ mutateAsync: mocks.deleteMutateAsync }) },
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

// 旧版本夹具(6.6):切换后断言渲染旧版本内容,动作作用于旧版本 id
const olderVersion: ResultVersion = {
  ...version,
  id: "v0",
  targetDirection: "测试工程师",
  optimizations: [
    {
      id: "o9",
      category: "关键词",
      originalText: "旧版本原文片段",
      optimizedText: "旧版本优化片段",
      reason: "旧版理由",
      status: "pending",
      updatedAt: "2026-08-10T10:00:00Z",
    },
  ],
  createdAt: "2026-08-10T10:00:00Z",
};

// 双版本列表(6.6):最新 = 第 2 版,旧 = 第 1 版
const twoVersions: VersionRow[] = [
  { id: "v1", targetDirection: "后端开发工程师", atsScore: null, createdAt: "2026-08-20T10:00:00Z" },
  { id: "v0", targetDirection: "测试工程师", atsScore: 60, createdAt: "2026-08-10T10:00:00Z" },
];

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
        resumeId="r1"
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
  mocks.invalidateVersions.mockResolvedValue(undefined);
  mocks.invalidateGetVersion.mockResolvedValue(undefined);
  mocks.duplicateMutateAsync.mockResolvedValue({ versionId: "v2" });
  mocks.duplicatePending = false;
  mocks.deleteMutateAsync.mockResolvedValue({ ok: true });
  mocks.versionsData = [];
  mocks.getVersionData = undefined;
  mocks.getVersionEnabled = false;
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

  it("导出(预览区):渲染并透传最终文本与采纳状态(4.7)", () => {
    renderResult();
    expect(screen.getByTestId("resume-export")).toBeInTheDocument();
    expect(mocks.exportProps).toEqual({
      finalText: version.finalText,
      canExport: true,
    });
  });

  it("零采纳:导出 canExport=false(4.7)", () => {
    const noneAccepted: ResultVersion = {
      ...version,
      optimizations: version.optimizations.map((o) => ({ ...o, status: "pending" as const })),
    };
    render(
      <ResumeResult version={noneAccepted} resumeId="r1" onReanalyze={() => {}} onEdit={() => {}} onReupload={() => {}} />
    );
    expect(screen.getByTestId("resume-export")).toBeInTheDocument();
    expect(mocks.exportProps).toEqual({ finalText: version.finalText, canExport: false });
  });

  it("全部接受(确认后执行):点击仅开确认不调 mutation;确认后 acceptAll(versionId)+ 失效刷新 + 成功 toast", async () => {
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "全部接受" }));
    expect(screen.getByText("确认接受全部 AI 建议?")).toBeInTheDocument();
    expect(mocks.acceptAllMutateAsync).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认全部接受" }));
    await waitFor(() => expect(mocks.acceptAllMutateAsync).toHaveBeenCalledWith({ versionId: "v1" }));
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
    expect(await screen.findByText("已全部采纳,最终文本已更新")).toBeInTheDocument();
  });

  it("全部接受失败:错误 toast", async () => {
    mocks.acceptAllMutateAsync.mockRejectedValueOnce(new Error("优化版本不存在"));
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "全部接受" }));
    await user.click(screen.getByRole("button", { name: "确认全部接受" }));
    expect(await screen.findByText("优化版本不存在")).toBeInTheDocument();
    expect(mocks.invalidateResume).not.toHaveBeenCalled();
  });

  it("全部接受取消:不调用 mutation,不改变任何建议状态", async () => {
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "全部接受" }));
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(mocks.acceptAllMutateAsync).not.toHaveBeenCalled();
    expect(mocks.invalidateResume).not.toHaveBeenCalled();
  });

  it("全部接受确认框:正文显示尚未采纳条数", async () => {
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "全部接受" }));
    expect(
      screen.getByText("当前共有 1 条 AI 建议尚未采纳。接受后将一次性应用所有 AI 修改。")
    ).toBeInTheDocument();
  });

  it("全部已采纳:「全部接受」禁用", () => {
    const allAccepted: ResultVersion = {
      ...version,
      optimizations: version.optimizations.map((o) => ({ ...o, status: "accepted" })),
    };
    render(
      <ResumeResult version={allAccepted} resumeId="r1" onReanalyze={() => {}} onEdit={() => {}} onReupload={() => {}} />
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

  it("预览卡内复制按钮:writeText 收到与预览同源的 finalText + 成功 toast + 导出埋点(5.3)", async () => {
    const { user } = renderResult();
    stubClipboard(mocks.writeText);
    await user.click(screen.getByRole("button", { name: "复制最终文本" }));
    expect(mocks.writeText).toHaveBeenCalledWith(version.finalText);
    expect(await screen.findByText("已复制最终文本")).toBeInTheDocument();
    expect(mocks.logExportMutate).toHaveBeenCalledTimes(1);
  });

  it("剪贴板不可用:回退 execCommand 复制成功 toast + 导出埋点", async () => {
    const { user } = renderResult();
    stubClipboard(undefined);
    stubExecCommand();
    await user.click(screen.getByRole("button", { name: "复制最终文本" }));
    expect(mocks.execCommand).toHaveBeenCalledWith("copy");
    expect(await screen.findByText("已复制最终文本")).toBeInTheDocument();
    expect(mocks.logExportMutate).toHaveBeenCalledTimes(1);
  });

  it("剪贴板与 execCommand 均失败:错误 toast,不记埋点", async () => {
    const { user } = renderResult();
    stubClipboard(undefined);
    stubExecCommand();
    mocks.execCommand.mockReturnValue(false);
    await user.click(screen.getByRole("button", { name: "复制最终文本" }));
    expect(await screen.findByText("复制失败,请手动选择文本复制")).toBeInTheDocument();
    expect(mocks.logExportMutate).not.toHaveBeenCalled();
  });

  it("零采纳:复制与导出均禁用,提示仅最终文本预览区一处", () => {
    const noneAccepted: ResultVersion = {
      ...version,
      optimizations: version.optimizations.map((o) => ({ ...o, status: "pending" as const })),
    };
    render(<ResumeResult version={noneAccepted} resumeId="r1" onReanalyze={() => {}} onEdit={() => {}} onReupload={() => {}} />);
    expect(screen.getByRole("button", { name: "复制最终文本" })).toBeDisabled();
    expect(screen.getAllByText("尚未采纳任何修改").length).toBe(1);
  });

  it("finalText 为空:预览面板显示占位文案 + 复制按钮禁用", () => {
    render(
      <ResumeResult
        version={{ ...version, finalText: null }}
        resumeId="r1"
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

  it("「查看全部简历」(4.13):链接指向「我的简历」Tab /resume?tab=resumes", () => {
    renderResult();
    expect(screen.getByRole("link", { name: "查看全部简历" })).toHaveAttribute(
      "href",
      "/resume?tab=resumes"
    );
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

  it("单版本(6.6/2026-09 常显):版本选择器显示「第 1 版」,「删除版本」禁用,无「复制为新版本」入口", () => {
    mocks.versionsData = [twoVersions[0]!];
    renderResult();
    const trigger = screen.getByLabelText("查看历史版本");
    expect(trigger.textContent).toMatch(/第 1 版 ·/);
    expect(trigger.textContent).toMatch(/后端开发工程师/);
    expect(screen.getByRole("button", { name: "删除版本" })).toBeDisabled();
    // 菜单未展开:旧「复制为新版本」按钮与「另存为新版本」菜单项均不在文档
    expect(screen.queryByRole("button", { name: "复制为新版本" })).toBeNull();
    expect(screen.queryByRole("button", { name: "另存为新版本" })).toBeNull();
  });

  it("多版本(6.6/2026-09):菜单按「第 N 版 · 日期 · 方向」标注,当前版本带 Check;切换后按旧版本渲染且 trigger 文案同步", async () => {
    mocks.versionsData = [...twoVersions];
    mocks.getVersionData = olderVersion;
    const { user } = renderResult();
    expect(screen.getByLabelText("查看历史版本")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除版本" })).toBeEnabled();
    await user.click(screen.getByLabelText("查看历史版本"));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /第 1 版 · .*测试工程师/ })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /第 2 版 · .*后端开发工程师/ })).toBeInTheDocument();
    // 当前版本(最新)带 Check 指示,仅一处
    expect(within(menu).getAllByTestId("current-version-check")).toHaveLength(1);
    await user.click(within(menu).getByRole("menuitem", { name: /第 1 版 · .*测试工程师/ }));
    expect(mocks.getVersionEnabled).toBe(true);
    // 旧版本内容渲染(目标方向与优化片段)
    expect(await screen.findByText("旧版本优化片段")).toBeInTheDocument();
    expect(screen.getByText(/目标方向:测试工程师/)).toBeInTheDocument();
    // trigger 文案同步为当前查看的旧版本
    const trigger = screen.getByLabelText("查看历史版本");
    expect(trigger.textContent).toMatch(/第 1 版 ·/);
    expect(trigger.textContent).toMatch(/测试工程师/);
    // 全部接受作用于当前查看的旧版本 id,并失效 getVersion(确认后执行)
    await user.click(screen.getByRole("button", { name: "全部接受" }));
    await user.click(screen.getByRole("button", { name: "确认全部接受" }));
    await waitFor(() => expect(mocks.acceptAllMutateAsync).toHaveBeenCalledWith({ versionId: "v0" }));
    expect(mocks.invalidateGetVersion).toHaveBeenCalled();
  });

  it("另存为新版本(6.6/2026-09):菜单项 → 确认 Dialog → duplicateVersion(当前版本 id)+ 成功 toast + 三路失效", async () => {
    mocks.versionsData = [...twoVersions];
    const { user } = renderResult();
    await user.click(screen.getByLabelText("查看历史版本"));
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", { name: "另存为新版本" })
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("另存为新版本")).toBeInTheDocument();
    expect(mocks.duplicateMutateAsync).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "确认另存" }));
    await waitFor(() => expect(mocks.duplicateMutateAsync).toHaveBeenCalledWith({ versionId: "v1" }));
    expect(await screen.findByText("已另存为新版本")).toBeInTheDocument();
    expect(mocks.invalidateResume).toHaveBeenCalled();
    expect(mocks.invalidateVersions).toHaveBeenCalled();
    expect(mocks.invalidateGetVersion).toHaveBeenCalled();
  });

  it("另存失败(6.6/2026-09):错误 toast,不失效,Dialog 关闭", async () => {
    mocks.duplicateMutateAsync.mockRejectedValueOnce(new Error("优化版本不存在"));
    const { user } = renderResult();
    await user.click(screen.getByLabelText("查看历史版本"));
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", { name: "另存为新版本" })
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "确认另存" })
    );
    expect(await screen.findByText("优化版本不存在")).toBeInTheDocument();
    expect(mocks.invalidateResume).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("另存取消(2026-09):不调用 duplicateVersion,不失效", async () => {
    mocks.versionsData = [...twoVersions];
    const { user } = renderResult();
    await user.click(screen.getByLabelText("查看历史版本"));
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", { name: "另存为新版本" })
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(mocks.duplicateMutateAsync).not.toHaveBeenCalled();
    expect(mocks.invalidateResume).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("另存确认框(2026-09):正文说明独立副本且当前版本不受影响", async () => {
    const { user } = renderResult();
    await user.click(screen.getByLabelText("查看历史版本"));
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", { name: "另存为新版本" })
    );
    expect(
      await screen.findByText("将基于当前版本创建一个独立的新简历版本。当前版本不会受到影响。")
    ).toBeInTheDocument();
  });

  it("另存在途(2026-09):确认按钮禁用", async () => {
    mocks.duplicatePending = true;
    const { user } = renderResult();
    await user.click(screen.getByLabelText("查看历史版本"));
    await user.click(
      within(await screen.findByRole("menu")).getByRole("menuitem", { name: "另存为新版本" })
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "确认另存" })).toBeDisabled();
  });

  it("删除版本(6.6):确认 Dialog → deleteVersion(当前版本 id)+ 成功 toast + 三路失效", async () => {
    mocks.versionsData = [...twoVersions];
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "删除版本" }));
    expect(screen.getByText("删除该版本?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    await waitFor(() => expect(mocks.deleteMutateAsync).toHaveBeenCalledWith({ versionId: "v1" }));
    expect(await screen.findByText("版本已删除")).toBeInTheDocument();
    expect(mocks.invalidateResume).toHaveBeenCalled();
    expect(mocks.invalidateVersions).toHaveBeenCalled();
    expect(mocks.invalidateGetVersion).toHaveBeenCalled();
  });

  it("删除取消(6.6):不调用 deleteVersion", async () => {
    mocks.versionsData = [...twoVersions];
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "删除版本" }));
    await user.click(screen.getByRole("button", { name: "取消" }));
    expect(mocks.deleteMutateAsync).not.toHaveBeenCalled();
  });

  it("删除失败(6.6):错误 toast", async () => {
    mocks.versionsData = [...twoVersions];
    mocks.deleteMutateAsync.mockRejectedValueOnce(new Error("至少保留一个优化版本"));
    const { user } = renderResult();
    await user.click(screen.getByRole("button", { name: "删除版本" }));
    await user.click(screen.getByRole("button", { name: "确认删除" }));
    expect(await screen.findByText("至少保留一个优化版本")).toBeInTheDocument();
  });
});
