// 模拟面试状态枢纽测试(7.2):无简历引导卡 / 场次设定表单(岗位预填匹配报告岗位名)/
// 出题过程 AnalysisView / 出题失败恢复(会话内重试用最近一次设定 + 修改设定回表单)/
// 进行中场次刷新恢复直接进对话 / latestRun succeeded 自动刷新场次。
import { render, screen, waitFor } from "@testing-library/react";
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

const mocks = vi.hoisted(() => ({
  sessionData: null as SessionMock | null,
  sessionLoading: false,
  resumeData: { id: "resume-1" } as object | null,
  matchingData: { jdTitle: "后端开发工程师", jdText: "JD" } as object | null,
  roadmapData: null as { targetDirection: string; weeklyHours: number | null } | null,
  latestRunData: null as RunMock | null,
  startMutateAsync: vi.fn(),
  retryMutateAsync: vi.fn(),
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
      interview: { get: { invalidate: mocks.invalidateGet, refetch: mocks.refetchGet } },
    }),
    interview: {
      get: { useQuery: () => ({ data: mocks.sessionData, isLoading: mocks.sessionLoading }) },
      latestRun: {
        useQuery: () => ({ data: mocks.latestRunData, isLoading: false }),
      },
      start: { useMutation: () => ({ mutateAsync: mocks.startMutateAsync }) },
      retry: { useMutation: () => ({ mutateAsync: mocks.retryMutateAsync }) },
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
  mocks.startMutateAsync.mockResolvedValue({ runId: "run-new" });
  mocks.retryMutateAsync.mockResolvedValue({ runId: "run-retry" });
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
