// 简历页状态枢纽测试(4.3):上传/粘贴 → 待解析 → 解析中 → 失败恢复 → 核对修正 五态切换
// + 会话内重试(重跑 parse)与刷新恢复(retryParse 重放)
// 4.4-4.5 优化阶段:开始优化触发改写(简历优化师分析中)/ 改写失败重试与返回核对 / 结果视图 / 刷新恢复
// 4.12:URL 参数活跃简历(?resumeId= 透传 get / ?upload=1 初始上传视图 / 失效护栏去参)+ 上传视图无「更换简历」
// 4.13:结果视图「上传新简历」按钮 + 当前简历名 + 「查看全部简历」;上传视图「从已有简历继续」切换活跃行
// 4.14:上传视图退出 —— 返回按来源动态(简历中心 → /resumes;简历优化且有结果视图 → 回原视图;
// 无结果视图 → /resumes)+ 面包屑父级 + 冷加载 ?upload=1 首帧守卫
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

const mocks = vi.hoisted(() => {
  const replace = vi.fn();
  const back = vi.fn();
  return {
    meData: { id: "u1", name: "甲", avatarColor: null as string | null },
    meLoading: false,
    resumeData: null as ResumeMock | null,
    resumeLoading: false,
    listData: null as { id: string; fileName: string | null; sizeBytes: number | null; extractError: string | null; createdAt: string }[] | null,
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
    // 4.12:URL 参数与导航
    replace,
    back,
    // 4.14:稳定 router 对象(与生产 useRouter 一致);对象身份每渲染变化会导致
    // ?upload=1 effect 因依赖变化反复执行、uploadMode 无法退出
    router: { replace, back },
    searchParams: {} as Record<string, string>,
    getInput: null as { resumeId?: string } | null,
  };
});

// 导出工具条 stub(4.7):避免 jsdom 加载真实 react-pdf,其行为由 resume-export.test.tsx 覆盖
vi.mock("../resume-export", () => ({
  ResumeExport: () => <div data-testid="resume-export" />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
  useSearchParams: () => ({
    get: (key: string) => mocks.searchParams[key] ?? null,
  }),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ resume: { get: { invalidate: mocks.invalidateResume } } }),
    user: { me: { useQuery: () => ({ data: mocks.meData, isLoading: mocks.meLoading }) } },
    resume: {
      get: {
        useQuery: (input?: { resumeId?: string }) => {
          mocks.getInput = input ?? null;
          return { data: mocks.resumeData, isLoading: mocks.resumeLoading };
        },
      },
      latestRun: {
        // 4.4 起按 intent 参数化:parse-resume 与 rewrite-resume 各自取数
        useQuery: (input: { intent: string }) => ({
          data: input.intent === "rewrite-resume" ? mocks.latestRewriteData : mocks.latestRunData,
          isLoading: false,
        }),
      },
      list: {
        useQuery: () => ({ data: mocks.listData, isLoading: false, isSuccess: true }),
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

// 2026-08 修复用例:权威成功 run(5 条生命周期事件,模拟后端已完成而 mutation 未返回)
const succeededRewriteRun: RunMock = {
  id: "run-rewrite-ok",
  status: "succeeded",
  stale: false,
  progress: [
    { stage: "start", message: "正在启动「resume-rewrite-agent」…" },
    { stage: "prompt", message: "正在理解你的背景与目标…" },
    { stage: "llm", message: "正在分析…" },
    { stage: "parse", message: "正在整理分析结果…" },
    { stage: "done", message: "分析完成" },
  ],
  error: null,
  createdAt: "2026-08-20T10:00:00Z",
};

const optimizedVersion = {
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
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchParams = {};
  mocks.getInput = null;
  mocks.meData = { id: "u1", name: "甲", avatarColor: null };
  mocks.meLoading = false;
  mocks.resumeData = null;
  mocks.resumeLoading = false;
  mocks.listData = [];
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

  it("刷新后遇历史失败 run:重试走服务端重放(retryParse 带 runId);上传新简历回上传视图", async () => {
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

  it("失败视图「上传新简历」(4.13):回到上传视图 = 「上传新简历」拖拽区,无「更换简历」", async () => {
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
    await userEvent.setup().click(screen.getByRole("button", { name: "上传新简历" }));
    expect(await screen.findByLabelText("上传新简历")).toBeInTheDocument();
    expect(screen.getByText(/本次上传会新增一份独立简历/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更换简历" })).not.toBeInTheDocument();
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
      version: optimizedVersion,
    };
    render(<ResumeHub />);
    expect(await screen.findByRole("button", { name: "全部接受" })).toBeInTheDocument();
    expect(screen.getByText("已采纳 0/1")).toBeInTheDocument();
    expect(screen.getByText("负责订单系统开发")).toBeInTheDocument();
    expect(screen.getByTestId("resume-export")).toBeInTheDocument();
  });

  it("结果视图「上传新简历」(4.13):回到上传视图 = 「上传新简历」拖拽区,不触发删除/上传动作", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
      version: optimizedVersion,
    };
    render(<ResumeHub />);
    expect(await screen.findByRole("button", { name: "全部接受" })).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "上传新简历" }));
    // 只切视图:上传视图 = 「上传新简历」拖拽区;无旧文件卡、无「更换简历」
    expect(await screen.findByLabelText("上传新简历")).toBeInTheDocument();
    expect(screen.getByText(/本次上传会新增一份独立简历/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "更换简历" })).not.toBeInTheDocument();
    expect(screen.queryByText("张伟简历.pdf")).not.toBeInTheDocument();
    expect(mocks.parseMutateAsync).not.toHaveBeenCalled();
  });

  it("结果视图(4.13):显示当前简历名 + 「查看全部简历」链接指向 /resumes", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
      version: optimizedVersion,
    };
    render(<ResumeHub />);
    expect(await screen.findByRole("button", { name: "全部接受" })).toBeInTheDocument();
    expect(screen.getByText("当前简历:张伟简历.pdf")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看全部简历" })).toHaveAttribute("href", "/resumes");
  });

  it("「从已有简历继续」(4.13):点其他行 → 切活跃行(?resumeId=)并退出上传视图", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
      version: optimizedVersion,
    };
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", sizeBytes: 1024, extractError: null, createdAt: "2026-08-20T10:00:00Z" },
      { id: "r-other", fileName: "产品经理简历.pdf", sizeBytes: 1024, extractError: null, createdAt: "2026-08-21T10:00:00Z" },
    ];
    render(<ResumeHub />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "上传新简历" }));
    // 上传视图:「上传新简历」拖拽区 + 「从已有简历继续」双行
    expect(await screen.findByText("从已有简历继续")).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: "继续优化" });
    expect(buttons).toHaveLength(2);
    await userEvent.setup().click(buttons[1]!);
    expect(mocks.replace).toHaveBeenCalledWith("/resume?resumeId=r-other");
    // 退出上传视图(searchParams mock 不变 → 数据仍为 r1):回到结果视图
    expect(await screen.findByRole("button", { name: "全部接受" })).toBeInTheDocument();
    expect(screen.queryByLabelText("上传新简历")).not.toBeInTheDocument();
  });

  it("「从已有简历继续」(4.13):点当前行(同 id)→ 显式退上传视图(行切换 effect 不触发)", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
      version: optimizedVersion,
    };
    mocks.listData = [
      { id: "r1", fileName: "张伟简历.pdf", sizeBytes: 1024, extractError: null, createdAt: "2026-08-20T10:00:00Z" },
    ];
    render(<ResumeHub />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "上传新简历" }));
    await userEvent.setup().click(await screen.findByRole("button", { name: "继续优化" }));
    expect(mocks.replace).toHaveBeenCalledWith("/resume?resumeId=r1");
    expect(await screen.findByRole("button", { name: "全部接受" })).toBeInTheDocument();
    expect(screen.queryByLabelText("上传新简历")).not.toBeInTheDocument();
  });

  it("URL ?resumeId=(4.12):透传给 resume.get 作为活跃简历", () => {
    mocks.searchParams = { resumeId: "r-old" };
    mocks.resumeData = {
      id: "r-old",
      fileName: "旧简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    render(<ResumeHub />);
    expect(mocks.getInput).toEqual({ resumeId: "r-old" });
    // 参数行有效:不触发去参护栏
    expect(mocks.replace).not.toHaveBeenCalledWith("/resume");
  });

  it("URL ?upload=1(4.12/4.14):初始即上传视图(上传新简历)并去参;无 from 默认回简历优化", async () => {
    mocks.searchParams = { upload: "1" };
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
    expect(await screen.findByLabelText("上传新简历")).toBeInTheDocument();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/resume"));
    // 4.14:无 from 参数 → 来源视为简历优化,面包屑「简历优化」
    expect(screen.getByText("简历优化")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "返回" }));
    // 退 uploadMode 回原视图(该行 parsedData=null → 「简历已就绪」),不跳简历中心
    expect(await screen.findByText("简历已就绪")).toBeInTheDocument();
    expect(screen.queryByLabelText("上传新简历")).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalledWith("/resumes");
  });

  it("URL ?upload=1&from=resumes(4.14):进入上传视图,面包屑「简历中心」;点返回 → 后退回简历中心(4.15:不 replace,避免相邻 /resumes 历史)", async () => {
    mocks.searchParams = { upload: "1", from: "resumes" };
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    // 4.15:来源是简历中心「新增简历」,上一历史条目即简历中心(history.length ≥ 2,同源)
    const lengthSpy = vi.spyOn(window.history, "length", "get").mockReturnValue(2);
    render(<ResumeHub />);
    expect(await screen.findByLabelText("上传新简历")).toBeInTheDocument();
    expect(screen.getByText("简历中心")).toBeInTheDocument(); // 面包屑父级
    await userEvent.setup().click(screen.getByRole("button", { name: "返回" }));
    expect(mocks.back).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalledWith("/resumes");
    lengthSpy.mockRestore();
  });

  it("结果视图进入上传视图后点返回(4.14):回结果视图,不跳简历中心", async () => {
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData,
      createdAt: "2026-08-20T10:00:00Z",
      version: optimizedVersion,
    };
    render(<ResumeHub />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "上传新简历" }));
    expect(await screen.findByLabelText("上传新简历")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "返回" }));
    expect(await screen.findByRole("button", { name: "全部接受" })).toBeInTheDocument();
    expect(screen.queryByLabelText("上传新简历")).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalledWith("/resumes");
  });

  it("解析失败视图进入上传视图后点返回(4.14):回失败视图(原视图复现)", async () => {
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
    await userEvent.setup().click(screen.getByRole("button", { name: "上传新简历" }));
    expect(await screen.findByLabelText("上传新简历")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "返回" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByLabelText("上传新简历")).not.toBeInTheDocument();
  });

  it("提取失败行自动渲染上传视图(4.14):点返回 → /resumes(无结果视图可回)", async () => {
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
    expect(screen.getByText("简历中心")).toBeInTheDocument(); // 面包屑父级 = 退出目标
    await userEvent.setup().click(screen.getByRole("button", { name: "返回" }));
    expect(mocks.replace).toHaveBeenCalledWith("/resumes");
  });

  it("无简历上传视图(4.14):点返回 → /resumes", async () => {
    render(<ResumeHub />);
    expect(await screen.findByText("拖拽简历文件到这里,或点击选择文件")).toBeInTheDocument();
    expect(screen.getByText("简历中心")).toBeInTheDocument(); // 面包屑父级 = 退出目标
    await userEvent.setup().click(screen.getByRole("button", { name: "返回" }));
    expect(mocks.replace).toHaveBeenCalledWith("/resumes");
  });

  it("冷加载 ?upload=1(4.14):行切换 effect 首帧不误复位 uploadMode", async () => {
    mocks.searchParams = { upload: "1" };
    mocks.resumeLoading = true;
    const { rerender } = render(<ResumeHub />);
    expect(screen.getByLabelText("加载中")).toBeInTheDocument();
    mocks.resumeLoading = false;
    mocks.resumeData = {
      id: "r1",
      fileName: "张伟简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    rerender(<ResumeHub />);
    // 数据加载完成后仍在上传视图(未被首帧 undefined→id 误复位)
    expect(await screen.findByLabelText("上传新简历")).toBeInTheDocument();
    expect(screen.queryByText("简历已就绪")).not.toBeInTheDocument();
  });

  it("?resumeId 失效护栏(4.12):get 已回退最新行(≠ 参数行)→ 去参", async () => {
    mocks.searchParams = { resumeId: "r-gone" };
    mocks.resumeData = {
      id: "r-latest",
      fileName: "最新简历.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      extractError: null,
      parsedData: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    render(<ResumeHub />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/resume"));
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

  // —— 2026-08 修复用例(方案 A1):完成判定以轮询权威数据(run 终态 + 落库版本)为准,
  // mutation 只作触发;被刷新中断/长期未返回的 mutation 不再把视图钉死在分析中。
  it("改写 mutation 长期不返回但权威 run 已成功 + 版本落库:直接进结果视图(不被钉死)", async () => {
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
    // 模拟「mutation 在途但后端早已完成、轮询带回终态与版本」(刷新前场景)
    mocks.rewriteMutateAsync.mockImplementation(() => new Promise(() => undefined));
    const { rerender } = render(<ResumeHub />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "开始优化" }));
    expect(await screen.findByText("简历优化师")).toBeInTheDocument();
    mocks.latestRewriteData = { ...succeededRewriteRun, resumeId: "r1" };
    mocks.resumeData = { ...mocks.resumeData, version: optimizedVersion };
    rerender(<ResumeHub />);
    expect(await screen.findByRole("button", { name: "全部接受" })).toBeInTheDocument();
    expect(screen.queryByText("简历优化师")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("改写 mutation 长期不返回但权威 run 已 failed:失败视图展示 run.error(不等 mutation 返回)", async () => {
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
    mocks.rewriteMutateAsync.mockImplementation(() => new Promise(() => undefined));
    const { rerender } = render(<ResumeHub />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "开始优化" }));
    expect(await screen.findByText("简历优化师")).toBeInTheDocument();
    mocks.latestRewriteData = { ...failedRun, resumeId: "r1" };
    rerender(<ResumeHub />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AI 返回了无法识别的结果,请稍后重试"
    );
    expect(screen.getByText("分析未完成")).toBeInTheDocument();
  });

  it("会话内改写报错但权威 run 已成功:错误被权威状态抑制,展示完成过渡并自动刷新简历", async () => {
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
    // 会话内 mutation 拒绝(如请求中断),但后端实际已完成并落终态
    mocks.rewriteMutateAsync.mockRejectedValueOnce(new Error("AI 响应超时,请重试"));
    const { rerender } = render(<ResumeHub />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "开始优化" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("AI 响应超时,请重试");
    // 权威数据显示成功:会话错误让位(不误显失败),停留完成过渡(版本未落库),恢复 effect 自动刷新
    mocks.latestRewriteData = { ...succeededRewriteRun, resumeId: "r1" };
    rerender(<ResumeHub />);
    // 第 1 次 invalidate 来自 save 成功,第 2 次来自恢复 effect(run succeeded 触发)
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("简历优化师")).toBeInTheDocument();
    expect(screen.getByText("分析完成")).toBeInTheDocument();
  });
});
