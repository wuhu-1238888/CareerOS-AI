// 模拟面试状态枢纽测试(7.2/7.3):无简历引导卡 / 场次设定表单(岗位预填匹配报告岗位名)/
// 出题过程 AnalysisView / 出题失败恢复(会话内重试用最近一次设定 + 修改设定回表单)/
// 进行中场次刷新恢复直接进对话 / latestRun succeeded 自动刷新场次。
// 7.3 报告:completed 场次刷新直接进报告视图 / 结束面试确认 → finish → 报告视图 /
// 报告视图开始新面试(确认)→ 回表单 / finish 失败报告失败视图(返回对话)/
// 报告 run 失败刷新恢复 + 重试走 retry 重放 / finish 在途报告运行文案。
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewHub } from "../interview-hub";
import type { InterviewAnswerItem, InterviewQuestion } from "@/lib/interview/analysis-schemas";

type RunMock = {
  id: string;
  status: string;
  stale: boolean;
  progress: { stage: string; message: string }[];
  error: string | null;
  createdAt: string;
};

type SessionMock = {
  interviewType: string;
  questionCount: number;
  targetPosition: string;
  status: string;
  questions: InterviewQuestion[] | null;
  currentQuestionIndex: number;
  answers: InterviewAnswerItem[] | null;
  report: unknown;
  updatedAt: string;
};

const QUESTIONS: InterviewQuestion[] = [
  { id: "q-1", type: "自我介绍", question: "请先做一个简单的自我介绍。", followUpHints: ["背景", "亮点"], evidence: [] },
  { id: "q-2", type: "经历深挖", question: "介绍一下最有成就感的项目。", followUpHints: ["背景", "困难"], evidence: ["项目"] },
  { id: "q-3", type: "技术案例", question: "讲一次解决技术难题的经历。", followUpHints: ["场景", "方案"], evidence: [] },
  { id: "q-4", type: "情景假设", question: "如果需求突然变更你会怎么做?", followUpHints: ["沟通", "节奏"], evidence: [] },
  { id: "q-5", type: "反问", question: "你有什么想问面试官的问题?", followUpHints: ["方向", "团队"], evidence: [] },
];

const activeSession: SessionMock = {
  interviewType: "行为面",
  questionCount: 5,
  targetPosition: "后端开发工程师",
  status: "in_progress",
  questions: QUESTIONS,
  currentQuestionIndex: 0,
  answers: [],
  report: null,
  updatedAt: "2026-08-24T10:00:00Z",
};

const succeededRun: RunMock = {
  id: "run-ok",
  status: "succeeded",
  stale: false,
  progress: [
    { stage: "start", message: "开始分析" },
    { stage: "prompt", message: "组装提示词" },
    { stage: "llm", message: "AI 生成中" },
    { stage: "parse", message: "解析结果" },
    { stage: "done", message: "完成" },
  ],
  error: null,
  createdAt: "2026-08-24T10:00:00Z",
};

// 7.3:已完成场次(报告已落库,含 1 道已评估题)
const REPORT = {
  overallEvaluation: "整体表现扎实,对项目经历的讲解清楚可信。",
  strengths: ["项目经验丰富,细节真实"],
  weaknesses: ["量化结果偏少"],
  keyImprovements: ["用 STAR + 量化结果重写两段核心经历。"],
};

const completedSession: SessionMock = {
  ...activeSession,
  status: "completed",
  currentQuestionIndex: 5,
  answers: [
    {
      questionId: "q-1",
      answer: "我是后端实习生,负责订单服务。",
      evaluation: { contentScore: 8, expressionScore: 7, improvementSuggestion: "补充量化结果。" },
      followUpQuestion: null,
      followUpAnswer: null,
    },
  ],
  report: REPORT,
};

const mocks = vi.hoisted(() => ({
  sessionData: null as SessionMock | null,
  sessionLoading: false,
  resumeData: { id: "resume-1" } as object | null,
  matchingData: { jdTitle: "后端开发工程师", jdText: "JD" } as object | null,
  roadmapData: null as { targetDirection: string; weeklyHours: number | null } | null,
  latestRunData: null as RunMock | null,
  // 7.3:报告 run(interview.latestRun 按 intent 分发)
  reportRunData: null as RunMock | null,
  startMutateAsync: vi.fn(),
  retryMutateAsync: vi.fn(),
  finishMutateAsync: vi.fn(),
  invalidateGet: vi.fn(),
  refetchGet: vi.fn(),
  // 对话视图(InterviewChat)内的答题端点,Hub 测试仅需存在
  submitAnswerMutateAsync: vi.fn(),
  evaluateMutateAsync: vi.fn(),
  submitFollowUpMutateAsync: vi.fn(),
  skipFollowUpMutateAsync: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      interview: {
        get: {
          invalidate: mocks.invalidateGet,
          refetch: mocks.refetchGet,
          // 2026-08:复用收敛依赖 getData 判断场次是否已落库
          getData: () => mocks.sessionData,
        },
      },
    }),
    interview: {
      get: { useQuery: () => ({ data: mocks.sessionData, isLoading: mocks.sessionLoading }) },
      latestRun: {
        // 7.3:Hub 同时轮询出题与报告两个 intent 的 latestRun,按 intent 分发
        useQuery: (input: { intent: string }) => ({
          data: input.intent === "generate-interview-report" ? mocks.reportRunData : mocks.latestRunData,
          isLoading: false,
        }),
      },
      start: { useMutation: () => ({ mutateAsync: mocks.startMutateAsync }) },
      retry: { useMutation: () => ({ mutateAsync: mocks.retryMutateAsync }) },
      finish: { useMutation: () => ({ mutateAsync: mocks.finishMutateAsync }) },
      submitAnswer: { useMutation: () => ({ mutateAsync: mocks.submitAnswerMutateAsync }) },
      evaluate: { useMutation: () => ({ mutateAsync: mocks.evaluateMutateAsync }) },
      submitFollowUp: { useMutation: () => ({ mutateAsync: mocks.submitFollowUpMutateAsync }) },
      skipFollowUp: { useMutation: () => ({ mutateAsync: mocks.skipFollowUpMutateAsync }) },
    },
    resume: {
      get: { useQuery: () => ({ data: mocks.resumeData, isLoading: false }) },
    },
    matching: {
      get: { useQuery: () => ({ data: mocks.matchingData, isLoading: false }) },
    },
    navigator: {
      roadmap: { get: { useQuery: () => ({ data: mocks.roadmapData, isLoading: false }) } },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sessionData = null;
  mocks.sessionLoading = false;
  mocks.resumeData = { id: "resume-1" };
  mocks.matchingData = { jdTitle: "后端开发工程师", jdText: "JD" };
  mocks.roadmapData = null;
  mocks.latestRunData = null;
  mocks.reportRunData = null;
  mocks.startMutateAsync.mockResolvedValue({ runId: "run-new" });
  mocks.retryMutateAsync.mockResolvedValue({ runId: "run-retry" });
  // 2026-08:finish 返回 { session, runId }(复用既有 running 报告 run 时据 session.status 收敛)
  mocks.finishMutateAsync.mockResolvedValue({ session: completedSession, runId: "run-report-new" });
  mocks.invalidateGet.mockResolvedValue(undefined);
  // 强制打字机 hook 走 setTimeout 回退(jsdom 无动画帧驱动)
  vi.stubGlobal("requestAnimationFrame", undefined);
});

describe("InterviewHub(7.2)", () => {
  it("无简历 → 引导卡,不显示表单", () => {
    mocks.resumeData = null;
    render(<InterviewHub />);
    expect(screen.getByText("先上传简历")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去简历中心上传" })).toHaveAttribute("href", "/resumes");
    expect(screen.queryByText("设定面试场次")).not.toBeInTheDocument();
  });

  it("无场次(有简历)→ 设定表单,目标岗位预填匹配报告岗位名", () => {
    render(<InterviewHub />);
    expect(screen.getByText("设定面试场次")).toBeInTheDocument();
    expect(screen.getByLabelText("目标岗位")).toHaveValue("后端开发工程师");
    // 默认选择:行为面 + 短 5 题
    expect(screen.getByRole("radio", { name: /行为面/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /短 5 题/ })).toBeChecked();
  });

  it("提交设定 → start 以表单载荷调用(默认行为面/5 题/岗位)", async () => {
    const user = userEvent.setup();
    render(<InterviewHub />);
    await user.click(screen.getByRole("button", { name: "开始面试" }));
    await waitFor(() =>
      expect(mocks.startMutateAsync).toHaveBeenCalledWith({
        interviewType: "行为面",
        questionCount: 5,
        targetPosition: "后端开发工程师",
      })
    );
  });

  it("出题在途(start 未返回)→ AnalysisView「面试出题」运行文案", async () => {
    let resolveStart!: (value: { runId: string }) => void;
    mocks.startMutateAsync.mockImplementationOnce(
      () => new Promise<{ runId: string }>((resolve) => (resolveStart = resolve))
    );
    const user = userEvent.setup();
    render(<InterviewHub />);
    await user.click(screen.getByRole("button", { name: "开始面试" }));

    expect(screen.getByText("面试出题")).toBeInTheDocument();
    expect(screen.getByText("正在阅读你的简历,生成个性化面试题")).toBeInTheDocument();
    expect(screen.getByText("分析中")).toBeInTheDocument();

    resolveStart({ runId: "run-new" });
    await waitFor(() => expect(mocks.invalidateGet).toHaveBeenCalled());
  });

  it("出题失败 → AnalysisView 失败视图;「重试」用最近一次设定重跑 start", async () => {
    mocks.startMutateAsync.mockRejectedValueOnce(new Error("AI 返回了无法识别的结果,请稍后重试"));
    const user = userEvent.setup();
    render(<InterviewHub />);
    await user.click(screen.getByRole("button", { name: "开始面试" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("AI 返回了无法识别的结果,请稍后重试");
    expect(screen.getByText("分析未完成")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(mocks.startMutateAsync).toHaveBeenCalledTimes(2));
    expect(mocks.startMutateAsync).toHaveBeenLastCalledWith({
      interviewType: "行为面",
      questionCount: 5,
      targetPosition: "后端开发工程师",
    });
  });

  it("出题失败 →「修改设定」回表单并预填上次提交", async () => {
    mocks.startMutateAsync.mockRejectedValueOnce(new Error("出题失败"));
    const user = userEvent.setup();
    render(<InterviewHub />);
    await user.click(screen.getByRole("button", { name: "开始面试" }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "修改设定" }));
    expect(screen.getByText("设定面试场次")).toBeInTheDocument();
    expect(screen.getByLabelText("目标岗位")).toHaveValue("后端开发工程师");
  });

  it("刷新恢复:进行中场次直接进对话(进度、提问、输入区可见)", async () => {
    mocks.sessionData = activeSession;
    render(<InterviewHub />);
    expect(screen.getByText("第 1 / 5 题")).toBeInTheDocument();
    expect(screen.getByLabelText("你的回答")).toBeInTheDocument();
    expect(await screen.findByText(QUESTIONS[0]!.question)).toBeInTheDocument();
  });

  it("刷新恢复:latestRun succeeded(无场次)→ 自动刷新场次记录", async () => {
    mocks.latestRunData = succeededRun;
    render(<InterviewHub />);
    await waitFor(() => expect(mocks.invalidateGet).toHaveBeenCalled());
  });

  it("刷新恢复:latestRun running(无场次)→ 恢复出题过程视图", () => {
    mocks.latestRunData = { ...succeededRun, id: "run-live", status: "running", progress: succeededRun.progress.slice(0, 2) };
    render(<InterviewHub />);
    expect(screen.getByText("面试出题")).toBeInTheDocument();
    expect(screen.getByText("分析中")).toBeInTheDocument();
  });

  it("刷新恢复:latestRun failed(无场次)→ 失败视图可「重试」(服务端重放 run.input)", async () => {
    mocks.latestRunData = {
      ...succeededRun,
      id: "run-dead",
      status: "failed",
      progress: [],
      error: "AI 返回了无法识别的结果,请稍后重试",
    };
    const user = userEvent.setup();
    render(<InterviewHub />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("AI 返回了无法识别的结果,请稍后重试");

    await user.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() =>
      expect(mocks.retryMutateAsync).toHaveBeenCalledWith({ runId: "run-dead" })
    );
    await waitFor(() => expect(mocks.invalidateGet).toHaveBeenCalled());
  });
});

describe("InterviewHub 报告(7.3)", () => {
  it("completed 场次刷新恢复 → 直接渲染综合报告视图(均分/总体评价/操作按钮)", () => {
    mocks.sessionData = completedSession;
    render(<InterviewHub />);
    expect(screen.getByText("模拟面试综合报告")).toBeInTheDocument();
    expect(screen.getByText(REPORT.overallEvaluation)).toBeInTheDocument();
    // 均分:1 道已评估题(内容 8 / 表达 7)
    expect(screen.getByText("8.0")).toBeInTheDocument();
    expect(screen.getByText("7.0")).toBeInTheDocument();
    expect(screen.getByText("基于 1 道已评估题计算")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回对话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始新面试" })).toBeInTheDocument();
  });

  it("对话中结束面试(确认)→ finish 调用,成功后进入报告视图", async () => {
    mocks.sessionData = activeSession;
    mocks.finishMutateAsync.mockImplementation(async () => {
      mocks.sessionData = completedSession;
      return { session: completedSession, runId: "run-report-new" };
    });
    const user = userEvent.setup();
    render(<InterviewHub />);
    expect(screen.getByText("第 1 / 5 题")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "结束面试" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "结束面试" }));

    await waitFor(() => expect(mocks.finishMutateAsync).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("模拟面试综合报告")).toBeInTheDocument();
    expect(screen.getByText(REPORT.overallEvaluation)).toBeInTheDocument();
  });

  it("报告视图「开始新面试」→ 确认 Dialog → 回设定表单", async () => {
    mocks.sessionData = completedSession;
    const user = userEvent.setup();
    render(<InterviewHub />);
    await user.click(screen.getByRole("button", { name: "开始新面试" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("开始新面试?")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "开始新面试" }));

    await waitFor(() => expect(screen.getByText("设定面试场次")).toBeInTheDocument());
    expect(screen.getByLabelText("目标岗位")).toHaveValue("后端开发工程师");
  });

  it("finish 失败 → 报告失败视图(面试报告);「返回对话」回对话继续作答", async () => {
    mocks.sessionData = activeSession;
    mocks.finishMutateAsync.mockRejectedValueOnce(new Error("报告生成失败"));
    const user = userEvent.setup();
    render(<InterviewHub />);
    await user.click(screen.getByRole("button", { name: "结束面试" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "结束面试" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("报告生成失败");
    expect(screen.getByText("面试报告")).toBeInTheDocument();
    expect(screen.getByText("报告生成没有完成,你可以重试或返回对话继续作答")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "返回对话" }));
    expect(screen.getByText("第 1 / 5 题")).toBeInTheDocument();
    expect(screen.getByLabelText("你的回答")).toBeInTheDocument();
  });

  it("报告 run 失败(刷新恢复)+ finish 再失败 →「重试」服务端重放 run.input", async () => {
    mocks.sessionData = activeSession;
    mocks.reportRunData = {
      ...succeededRun,
      id: "run-report-dead",
      status: "failed",
      progress: [],
      error: "AI 返回了无法识别的结果,请稍后重试",
    };
    mocks.finishMutateAsync.mockRejectedValueOnce(new Error("报告生成失败"));
    const user = userEvent.setup();
    render(<InterviewHub />);
    // 进行中场次:刷新后仍进对话
    expect(screen.getByText("第 1 / 5 题")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "结束面试" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "结束面试" }));
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() =>
      expect(mocks.retryMutateAsync).toHaveBeenCalledWith({ runId: "run-report-dead" })
    );
    // retry 成功 → 报告视图(场次仍 in_progress、report null → Hero + 兜底卡)
    await waitFor(() => expect(screen.getByText("模拟面试综合报告")).toBeInTheDocument());
  });

  it("finish 在途 + 报告 run running → AnalysisView「面试报告」运行文案,完成后进报告视图", async () => {
    mocks.sessionData = activeSession;
    mocks.reportRunData = {
      ...succeededRun,
      id: "run-report-live",
      status: "running",
      progress: succeededRun.progress.slice(0, 2),
    };
    let resolveFinish!: (value: { session: SessionMock; runId: string }) => void;
    mocks.finishMutateAsync.mockImplementationOnce(
      () => new Promise<{ session: SessionMock; runId: string }>((resolve) => (resolveFinish = resolve))
    );
    const user = userEvent.setup();
    render(<InterviewHub />);
    await user.click(screen.getByRole("button", { name: "结束面试" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "结束面试" }));

    expect(screen.getByText("面试报告")).toBeInTheDocument();
    expect(screen.getByText("正在汇总你的全部作答,生成综合报告")).toBeInTheDocument();
    expect(screen.getByText("分析中")).toBeInTheDocument();

    resolveFinish({ session: completedSession, runId: "run-report-live" });
    await waitFor(() => expect(screen.getByText("模拟面试综合报告")).toBeInTheDocument());
  });
});

describe("InterviewHub 复用收敛(2026-08)", () => {
  it("start 复用:场次未落库保持出题视图;run succeeded + 场次落库后收敛进对话", async () => {
    mocks.startMutateAsync.mockResolvedValue({ runId: "run-live" });
    const user = userEvent.setup();
    const { rerender } = render(<InterviewHub />);
    await user.click(screen.getByRole("button", { name: "开始面试" }));

    // 复用路径:场次尚未落库(getData 为 null)→ 保持出题视图而非闪进表单/对话
    expect(await screen.findByText("面试出题")).toBeInTheDocument();
    expect(screen.getByText("正在阅读你的简历,生成个性化面试题")).toBeInTheDocument();

    // 被复用 run 成功 + 场次落库 → 收敛进对话
    mocks.latestRunData = { ...succeededRun, id: "run-live" };
    mocks.sessionData = activeSession;
    rerender(<InterviewHub />);
    await waitFor(() => expect(screen.getByText(QUESTIONS[0]!.question)).toBeInTheDocument());
    expect(mocks.invalidateGet).toHaveBeenCalled();
  });

  it("finish 复用既有 running 报告 run:保持生成中视图;场次 completed 后进报告", async () => {
    mocks.sessionData = activeSession;
    mocks.reportRunData = {
      ...succeededRun,
      id: "run-report-live",
      status: "running",
      progress: succeededRun.progress.slice(0, 2),
    };
    // finish 复用:场次仍 in_progress(report 未落库)
    mocks.finishMutateAsync.mockResolvedValue({ session: activeSession, runId: "run-report-live" });
    const user = userEvent.setup();
    const { rerender } = render(<InterviewHub />);
    await user.click(screen.getByRole("button", { name: "结束面试" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "结束面试" }));

    // 复用:场次仍 in_progress → 保持「生成中」而非闪兜底卡
    expect(screen.getByText("面试报告")).toBeInTheDocument();
    expect(screen.getByText("正在汇总你的全部作答,生成综合报告")).toBeInTheDocument();

    // 被复用 run 成功 + 场次 completed → 收敛进报告视图
    mocks.reportRunData = { ...succeededRun, id: "run-report-live" };
    mocks.sessionData = completedSession;
    rerender(<InterviewHub />);
    await waitFor(() => expect(screen.getByText(REPORT.overallEvaluation)).toBeInTheDocument());
  });

  it("finish 复用失败:被复用 run 失败 → 失败视图显示错误(不卡无限生成中)", async () => {
    mocks.sessionData = activeSession;
    mocks.reportRunData = {
      ...succeededRun,
      id: "run-report-live",
      status: "running",
      progress: succeededRun.progress.slice(0, 2),
    };
    mocks.finishMutateAsync.mockResolvedValue({ session: activeSession, runId: "run-report-live" });
    const user = userEvent.setup();
    const { rerender } = render(<InterviewHub />);
    await user.click(screen.getByRole("button", { name: "结束面试" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "结束面试" }));
    expect(screen.getByText("正在汇总你的全部作答,生成综合报告")).toBeInTheDocument();

    // 被复用 run 失败 → 失败透出(按 runId 匹配)
    mocks.reportRunData = {
      ...succeededRun,
      id: "run-report-live",
      status: "failed",
      progress: [],
      error: "AI 返回了无法识别的结果,请稍后重试",
    };
    rerender(<InterviewHub />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("AI 返回了无法识别的结果,请稍后重试");
    expect(screen.getByText("报告生成没有完成,你可以重试或返回对话继续作答")).toBeInTheDocument();
  });
});
