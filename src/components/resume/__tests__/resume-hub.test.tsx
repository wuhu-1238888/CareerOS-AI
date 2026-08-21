// 简历页状态枢纽测试(4.3):上传/粘贴 → 待解析 → 解析中 → 失败恢复 → 核对修正 五态切换
// + 会话内重试(重跑 parse)与刷新恢复(retryParse 重放)
// 4.4-4.5 优化阶段:开始优化触发改写(简历优化师分析中)/ 改写失败重试与返回核对 / 结果视图 / 刷新恢复
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeHub } from "../resume-hub";

type ResumeMock = {
  id: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  extractError: string | null;
  parsedData: unknown;
  createdAt: string;
  /** 4.5:最新优化版本 + 建议列表(未优化简历无此字段) */
  version?: unknown;
};

type RunMock = {
  id: string;
  status: string;
  stale: boolean;
  progress: { stage: string; message: string }[];
  error: string | null;
  createdAt: string;
  /** 本次修订:serializeRun 透出的归属与方向字段(旧 run 可为 undefined → 视为当前行) */
  resumeId?: string | null;
  targetDirection?: string | null;
};

const mocks = vi.hoisted(() => ({
  meData: { id: "u1", name: "甲", avatarColor: null as string | null },
  meLoading: false,
  resumeData: null as ResumeMock | null,
  resumeLoading: false,
  profileData: null as { careerPaths: { directionName: string }[] } | null,
  profileLoading: false,
  latestRunData: null as RunMock | null,
  latestRewriteData: null as RunMock | null,
  parseMutateAsync: vi.fn(),
  retryMutateAsync: vi.fn(),
  saveMutateAsync: vi.fn(),
  rewriteMutateAsync: vi.fn(),
  updateOptimizationMutateAsync: vi.fn(),
  acceptAllMutateAsync: vi.fn(),
  scoreAtsMutateAsync: vi.fn(),
  createMutateAsync: vi.fn(),
  pasteMutateAsync: vi.fn(),
  invalidateResume: vi.fn(),
}));

// 导出工具条 stub(4.7):避免 jsdom 加载真实 react-pdf,其行为由 resume-export.test.tsx 覆盖
vi.mock("../resume-export", () => ({
  ResumeExport: () => <div data-testid="resume-export" />,
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ resume: { get: { invalidate: mocks.invalidateResume } } }),
    user: { me: { useQuery: () => ({ data: mocks.meData, isLoading: mocks.meLoading }) } },
    resume: {
      get: { useQuery: () => ({ data: mocks.resumeData, isLoading: mocks.resumeLoading }) },
      latestRun: {
        // 4.4 起按 intent 参数化:parse-resume 与 rewrite-resume 各自取数
        useQuery: (input: { intent: string }) => ({
          data: input.intent === "rewrite-resume" ? mocks.latestRewriteData : mocks.latestRunData,
          isLoading: false,
        }),
      },
      parse: { useMutation: () => ({ mutateAsync: mocks.parseMutateAsync }) },
      retryParse: { useMutation: () => ({ mutateAsync: mocks.retryMutateAsync }) },
      saveParsedData: { useMutation: () => ({ mutateAsync: mocks.saveMutateAsync }) },
      rewrite: { useMutation: () => ({ mutateAsync: mocks.rewriteMutateAsync }) },
      updateOptimization: {
        useMutation: () => ({ mutateAsync: mocks.updateOptimizationMutateAsync }),
      },
      acceptAll: { useMutation: () => ({ mutateAsync: mocks.acceptAllMutateAsync }) },
      scoreAts: { useMutation: () => ({ mutateAsync: mocks.scoreAtsMutateAsync }) },
      createFromText: {
        useMutation: () => ({ mutateAsync: mocks.createMutateAsync, isPending: false }),
      },
      pasteText: {
        useMutation: () => ({ mutateAsync: mocks.pasteMutateAsync, isPending: false }),
      },
    },
    profile: {
      get: { useQuery: () => ({ data: mocks.profileData, isLoading: mocks.profileLoading }) },
    },
  },
}));

const parsedData = {
  basicInfo: { name: "张伟", targetPosition: "后端开发工程师", phone: "", email: "" },
  education: [],
  skills: ["Java"],
  experiences: [],
  projects: [],
};

const failedRun: RunMock = {
  id: "run-failed",
  status: "failed",
  stale: false,
  progress: [],
  error: "AI 返回了无法识别的结果,请稍后重试",
  createdAt: "2026-08-20T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.meData = { id: "u1", name: "甲", avatarColor: null };
  mocks.meLoading = false;
  mocks.resumeData = null;
  mocks.resumeLoading = false;
  mocks.profileData = null;
  mocks.profileLoading = false;
  mocks.latestRunData = null;
  mocks.latestRewriteData = null;
  mocks.invalidateResume.mockResolvedValue(undefined);
  mocks.parseMutateAsync.mockResolvedValue({ runId: "run-1" });
  mocks.retryMutateAsync.mockResolvedValue({ runId: "run-2" });
  mocks.saveMutateAsync.mockResolvedValue({ ok: true });
  mocks.rewriteMutateAsync.mockResolvedValue({ versionId: "v1", runId: "run-rewrite" });
  mocks.updateOptimizationMutateAsync.mockResolvedValue({ id: "o1", status: "accepted" });
  mocks.acceptAllMutateAsync.mockResolvedValue({ ok: true });
  mocks.scoreAtsMutateAsync.mockResolvedValue({
    versionId: "v1",
    total: 72,
    level: "良好",
    runId: "run-ats",
  });
});

describe("ResumeHub 状态机", () => {
  it("加载中:渲染骨架屏", () => {
    mocks.meLoading = true;
    render(<ResumeHub />);
    expect(screen.getByLabelText("加载中")).toBeInTheDocument();
  });

  it("无简历:渲染上传视图(拖拽区)", async () => {
    render(<ResumeHub />);
    expect(await screen.findByText("拖拽简历文件到这里,或点击选择文件")).toBeInTheDocument();
  });

  it("简历已就绪无解析结果:待解析卡,点「开始解析」走 parse", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    render(<ResumeHub />);
    expect(await screen.findByText("简历已就绪")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "开始解析" }));
    await waitFor(() => expect(mocks.parseMutateAsync).toHaveBeenCalledWith({ resumeId: "r1" }));
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
  });

  it("解析在途:展示分析过程视图(简历解析师文案)", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    let resolveParse!: (value: unknown) => void;
    mocks.parseMutateAsync.mockImplementation(() => new Promise((resolve) => (resolveParse = resolve)));
    render(<ResumeHub />);
    await userEvent.setup().click(screen.getByRole("button", { name: "开始解析" }));
    expect(await screen.findByText("简历解析师")).toBeInTheDocument();
    expect(screen.getByText("分析中")).toBeInTheDocument();
    resolveParse({ runId: "run-1" });
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
  });

  it("会话内解析失败:友好错误 + 重试直接重跑 parse", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.parseMutateAsync.mockRejectedValueOnce(new Error("AI 返回了无法识别的结果,请稍后重试"));
    render(<ResumeHub />);
    await userEvent.setup().click(screen.getByRole("button", { name: "开始解析" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AI 返回了无法识别的结果,请稍后重试"
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(mocks.parseMutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
  });

  it("刷新后遇历史失败 run:重试走服务端重放(retryParse 带 runId);重新上传回上传视图", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.latestRunData = failedRun;
    render(<ResumeHub />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(mocks.retryMutateAsync).toHaveBeenCalledWith({ runId: "run-failed" }));
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
  });

  it("失败视图「重新上传」:回到上传视图(文件状态卡 + 更换简历)", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.latestRunData = failedRun;
    render(<ResumeHub />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "重新上传" }));
    expect(await screen.findByRole("button", { name: "更换简历" })).toBeInTheDocument();
    expect(screen.getByText("张伟简历.pdf")).toBeInTheDocument();
  });

  it("提取失败行(无原文):渲染上传视图引导粘贴降级", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "扫描件.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: "no-text",
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    render(<ResumeHub />);
    expect(
      await screen.findByText("未从文件中提取到文本(可能是图片型 PDF),请粘贴简历文本继续")
    ).toBeInTheDocument();
  });

  it("刷新后 run 已成功:自动刷新简历数据(进入核对视图)", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.latestRunData = {
      id: "run-1",
      status: "succeeded",
      stale: false,
      progress: [],
      error: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    render(<ResumeHub />);
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
  });

  it("解析完成:核对视图;「开始优化」保存核对结果并触发改写(简历优化师分析中)", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.profileData = { careerPaths: [{ directionName: "后端开发" }, { directionName: "数据分析" }] };
    let resolveRewrite!: (value: unknown) => void;
    mocks.rewriteMutateAsync.mockImplementation(
      () => new Promise((resolve) => (resolveRewrite = resolve))
    );
    render(<ResumeHub />);
    expect(await screen.findByText("基本信息")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "开始优化" }));
    await waitFor(() =>
      expect(mocks.saveMutateAsync).toHaveBeenCalledWith({
        resumeId: "r1",
        parsedData: expect.objectContaining({ skills: ["Java"] }),
      })
    );
    await waitFor(() =>
      expect(mocks.rewriteMutateAsync).toHaveBeenCalledWith({
        resumeId: "r1",
        parsedData: expect.objectContaining({ skills: ["Java"] }),
        targetDirection: "后端开发",
      })
    );
    expect(await screen.findByText("简历优化师")).toBeInTheDocument();
    expect(screen.getByText("分析中")).toBeInTheDocument();
    resolveRewrite({ versionId: "v1", runId: "run-rewrite" });
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
  });

  it("改写失败:错误视图;「重试」用会话内输入重跑 rewrite(不回到表单)", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.profileData = { careerPaths: [{ directionName: "后端开发" }] };
    mocks.rewriteMutateAsync.mockRejectedValueOnce(
      new Error("改写结果与简历原文不一致,请重新分析")
    );
    render(<ResumeHub />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "开始优化" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "改写结果与简历原文不一致,请重新分析"
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(mocks.rewriteMutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
  });

  it("改写失败「返回核对」:回核对表单并回填目标方向", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.profileData = { careerPaths: [{ directionName: "后端开发" }, { directionName: "数据分析" }] };
    mocks.rewriteMutateAsync.mockRejectedValueOnce(new Error("AI 返回了无法识别的结果,请稍后重试"));
    render(<ResumeHub />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "开始优化" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "返回核对" }));
    expect(await screen.findByText("基本信息")).toBeInTheDocument();
    expect(screen.getByLabelText("目标方向(可自定义)")).toHaveValue("后端开发");
  });

  it("已有优化版本:渲染结果视图(对比卡 + 全部接受工具条)", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
      version: {
        id: "v1",
        targetDirection: "后端开发工程师",
        changes: {},
        atsScore: null,
        atsReport: null,
        atsScoredAt: null,
        finalText: "张伟\n求职意向:后端开发工程师\n\n工作经历\n负责订单系统开发",
        createdAt: "2026-08-20T11:00:00Z",
        optimizations: [
          {
            id: "o1",
            category: "量化表达",
            originalText: "负责订单系统开发",
            optimizedText: "主导订单系统研发",
            reason: null,
            order: 0,
            status: "pending",
            updatedAt: "2026-08-20T11:00:00Z",
          },
        ],
      },
    };
    render(<ResumeHub />);
    expect(await screen.findByRole("button", { name: "全部接受" })).toBeInTheDocument();
    expect(screen.getByText("已采纳 0/1")).toBeInTheDocument();
    expect(screen.getByText("负责订单系统开发")).toBeInTheDocument();
    expect(screen.getByTestId("resume-export")).toBeInTheDocument();
  });

  it("刷新后遇历史失败改写 run(无版本):失败视图;重试无会话输入 → 返回核对表单", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.latestRewriteData = failedRun;
    render(<ResumeHub />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mocks.rewriteMutateAsync).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("基本信息")).toBeInTheDocument();
    expect(mocks.rewriteMutateAsync).not.toHaveBeenCalled();
  });

  it("行归属护栏:旧简历行的失败解析 run 不驱动新行 → 显示「简历已就绪」而非失败视图", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.latestRunData = { ...failedRun, resumeId: "other-resume" };
    render(<ResumeHub />);
    expect(await screen.findByText("简历已就绪")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("行归属护栏:旧简历行的失败改写 run 不驱动新行 → 已解析无版本直接进核对表单", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.latestRewriteData = { ...failedRun, resumeId: "other-resume" };
    render(<ResumeHub />);
    expect(await screen.findByText("基本信息")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("刷新后失败改写 run(当前行):「返回核对」经 run 输入回填自定义目标方向", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.profileData = { careerPaths: [{ directionName: "后端开发" }] };
    mocks.latestRewriteData = {
      ...failedRun,
      resumeId: "r1",
      targetDirection: "AI 产品经理",
    };
    render(<ResumeHub />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "返回核对" }));
    expect(await screen.findByText("基本信息")).toBeInTheDocument();
    expect(screen.getByLabelText("目标方向(可自定义)")).toHaveValue("AI 产品经理");
  });

  it("改写失败返回核对:会话内自定义方向经 lastOptimizeInput 回填(不回落画像首选)", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.profileData = { careerPaths: [{ directionName: "后端开发" }] };
    mocks.rewriteMutateAsync.mockRejectedValueOnce(
      new Error("AI 返回了无法识别的结果,请稍后重试")
    );
    const user = userEvent.setup();
    render(<ResumeHub />);
    const directionInput = await screen.findByLabelText("目标方向(可自定义)");
    await user.clear(directionInput);
    await user.type(directionInput, "AI 产品经理");
    await user.click(screen.getByRole("button", { name: "开始优化" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "返回核对" }));
    expect(await screen.findByText("基本信息")).toBeInTheDocument();
    expect(screen.getByLabelText("目标方向(可自定义)")).toHaveValue("AI 产品经理");
  });

  it("开始优化在途:optimizing 禁用按钮,保存与改写各只执行一次(防双击并发)", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
    };
    mocks.profileData = { careerPaths: [{ directionName: "后端开发" }] };
    let resolveSave!: (value: unknown) => void;
    let resolveRewrite!: (value: unknown) => void;
    mocks.saveMutateAsync.mockImplementation(
      () => new Promise((resolve) => (resolveSave = resolve))
    );
    mocks.rewriteMutateAsync.mockImplementation(
      () => new Promise((resolve) => (resolveRewrite = resolve))
    );
    const user = userEvent.setup();
    render(<ResumeHub />);
    await user.click(await screen.findByRole("button", { name: "开始优化" }));
    // save 在途:按钮必须禁用(此前 disabled 绑定表单自身 mutation 实例,此阶段可再次点击)
    expect(screen.getByRole("button", { name: "开始优化" })).toBeDisabled();
    resolveSave({ ok: true });
    expect(await screen.findByText("简历优化师")).toBeInTheDocument();
    resolveRewrite({ versionId: "v1", runId: "run-rewrite" });
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
    expect(mocks.saveMutateAsync).toHaveBeenCalledTimes(1);
    expect(mocks.rewriteMutateAsync).toHaveBeenCalledTimes(1);
  });
});
