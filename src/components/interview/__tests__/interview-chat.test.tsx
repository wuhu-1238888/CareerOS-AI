// 模拟面试对话组件测试(7.2,特许对话形态):当前题打字机渲染/历史消息整段恢复/评估卡双徽章/
// 评估失败重试槽/追问(回答/跳过/历史跳过注记)/思考气泡(role=status)+ 在途禁用/键盘操作
// (Enter 发送、Shift+Enter 换行、isComposing 防误发)/STAR 提示仅行为面/全部答完完成卡 + 结束 Dialog。
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewChat } from "../interview-chat";
import type { InterviewAnswerItem, InterviewQuestion } from "@/lib/interview/analysis-schemas";

type SessionMock = {
  interviewType: string;
  questionCount: number;
  targetPosition: string;
  status: string;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  answers: InterviewAnswerItem[];
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

const EVALUATION = { contentScore: 8, expressionScore: 7, improvementSuggestion: "建议补充一个可量化的结果数据。" };

function makeSession(overrides: Partial<SessionMock> = {}): SessionMock {
  return {
    interviewType: "行为面",
    questionCount: 5,
    targetPosition: "后端开发工程师",
    status: "in_progress",
    questions: QUESTIONS,
    currentQuestionIndex: 0,
    answers: [],
    report: null,
    updatedAt: "2026-08-24T10:00:00Z",
    ...overrides,
  };
}

const mocks = vi.hoisted(() => ({
  submitAnswerMutateAsync: vi.fn(),
  evaluateMutateAsync: vi.fn(),
  submitFollowUpMutateAsync: vi.fn(),
  skipFollowUpMutateAsync: vi.fn(),
  invalidateGet: vi.fn(),
  refetchGet: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      interview: { get: { invalidate: mocks.invalidateGet, refetch: mocks.refetchGet } },
    }),
    interview: {
      submitAnswer: { useMutation: () => ({ mutateAsync: mocks.submitAnswerMutateAsync }) },
      evaluate: { useMutation: () => ({ mutateAsync: mocks.evaluateMutateAsync }) },
      submitFollowUp: { useMutation: () => ({ mutateAsync: mocks.submitFollowUpMutateAsync }) },
      skipFollowUp: { useMutation: () => ({ mutateAsync: mocks.skipFollowUpMutateAsync }) },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.submitAnswerMutateAsync.mockResolvedValue(undefined);
  mocks.evaluateMutateAsync.mockResolvedValue(undefined);
  mocks.submitFollowUpMutateAsync.mockResolvedValue(undefined);
  mocks.skipFollowUpMutateAsync.mockResolvedValue(undefined);
  mocks.invalidateGet.mockResolvedValue(undefined);
  mocks.refetchGet.mockResolvedValue(undefined);
  // 强制打字机 hook 走 setTimeout 回退(jsdom 无动画帧驱动,否则打字永不推进)
  vi.stubGlobal("requestAnimationFrame", undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InterviewChat(7.2)", () => {
  it("渲染当前题:进度、面试官提问(打字机逐字出现)、输入区、结束面试", async () => {
    render(<InterviewChat session={makeSession()} onEnd={() => undefined} />);
    expect(screen.getByText("第 1 / 5 题")).toBeInTheDocument();
    expect(screen.getByText("行为面")).toBeInTheDocument();
    expect(screen.getByText("后端开发工程师")).toBeInTheDocument();
    // 新出现的提问气泡打字机渲染,最终整段出现
    expect(await screen.findByText(QUESTIONS[0]!.question)).toBeInTheDocument();
    expect(screen.getByLabelText("你的回答")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "结束面试" })).toBeInTheDocument();
  });

  it("恢复的历史消息整段渲染(不重新打字):已答题的题干/答案/评估卡立即可见", () => {
    const session = makeSession({
      currentQuestionIndex: 1,
      answers: [
        { questionId: "q-1", answer: "我是后端实习生,负责订单服务。", evaluation: EVALUATION, followUpQuestion: null, followUpAnswer: null },
      ],
    });
    render(<InterviewChat session={session} onEnd={() => undefined} />);
    // 历史题 q-1 同步整段可见(无需 waitFor)
    expect(screen.getByText(QUESTIONS[0]!.question)).toBeInTheDocument();
    expect(screen.getByText("我是后端实习生,负责订单服务。")).toBeInTheDocument();
    // 评估卡:内容/表达双徽章(数值即文字通道)+ 改进建议
    expect(screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === "内容 8/10")).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.tagName === "SPAN" && el.textContent === "表达 7/10")).toBeInTheDocument();
    expect(screen.getByText(EVALUATION.improvementSuggestion)).toBeInTheDocument();
    expect(screen.getByText("第 2 / 5 题")).toBeInTheDocument();
  });

  it("键盘:Enter 发送(trim 后载荷)、成功后刷新场次", async () => {
    const user = userEvent.setup();
    render(<InterviewChat session={makeSession()} onEnd={() => undefined} />);
    const textarea = screen.getByLabelText("你的回答");
    await user.type(textarea, "  我的项目经历{Enter}");
    await waitFor(() =>
      expect(mocks.submitAnswerMutateAsync).toHaveBeenCalledWith({ answer: "我的项目经历" })
    );
    await waitFor(() => expect(mocks.invalidateGet).toHaveBeenCalled());
  });

  it("键盘:Shift+Enter 换行不发送;isComposing 防中文输入法确认误发;空内容不发送", async () => {
    const user = userEvent.setup();
    render(<InterviewChat session={makeSession()} onEnd={() => undefined} />);
    const textarea = screen.getByLabelText("你的回答");

    await user.type(textarea, "第一行{Shift>}{Enter}{/Shift}第二行");
    expect(mocks.submitAnswerMutateAsync).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter", isComposing: true });
    expect(mocks.submitAnswerMutateAsync).not.toHaveBeenCalled();

    // 清空后 Enter:空内容被忽略
    await user.clear(textarea);
    await user.type(textarea, "{Enter}");
    expect(mocks.submitAnswerMutateAsync).not.toHaveBeenCalled();
  });

  it("评估在途:思考气泡(role=status)+ 输入禁用;完成后气泡消失", async () => {
    let resolveSubmit!: () => void;
    mocks.submitAnswerMutateAsync.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolveSubmit = resolve))
    );
    const user = userEvent.setup();
    render(<InterviewChat session={makeSession()} onEnd={() => undefined} />);
    await user.type(screen.getByLabelText("你的回答"), "我的回答{Enter}");

    const thinking = await screen.findByRole("status");
    expect(thinking).toHaveTextContent("面试官正在思考");
    expect(screen.getByLabelText("你的回答")).toBeDisabled();

    await act(async () => resolveSubmit());
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.getByLabelText("你的回答")).toBeEnabled();
  });

  it("评估失败:答案保留 + 评估槽(role=alert)显示错误与「重试评估」→ evaluate 按当前题重跑", async () => {
    mocks.submitAnswerMutateAsync.mockRejectedValueOnce(
      new Error("AI 返回了无法识别的结果,请稍后重试")
    );
    const user = userEvent.setup();
    const session = makeSession();
    const { rerender } = render(<InterviewChat session={session} onEnd={() => undefined} />);
    await user.type(screen.getByLabelText("你的回答"), "我的回答{Enter}");

    // 失败后重读场次:答案已落库、evaluation=null → 错误提示 + 重试评估
    await waitFor(() => expect(mocks.refetchGet).toHaveBeenCalled());
    rerender(
      <InterviewChat
        session={makeSession({
          answers: [
            { questionId: "q-1", answer: "我的回答", evaluation: null, followUpQuestion: null, followUpAnswer: null },
          ],
        })}
        onEnd={() => undefined}
      />
    );
    expect(screen.getByRole("alert")).toHaveTextContent("AI 返回了无法识别的结果,请稍后重试");
    expect(screen.getByText("我的回答")).toBeInTheDocument();

    const user2 = userEvent.setup();
    await user2.click(screen.getByRole("button", { name: "重试评估" }));
    await waitFor(() => expect(mocks.evaluateMutateAsync).toHaveBeenCalledWith({ questionIndex: 0 }));
    await waitFor(() => expect(mocks.invalidateGet).toHaveBeenCalled());
  });

  it("恢复的失败态:评估槽显示兜底文案,重试评估可点", async () => {
    const session = makeSession({
      answers: [
        { questionId: "q-1", answer: "已提交的答案", evaluation: null, followUpQuestion: null, followUpAnswer: null },
      ],
    });
    render(<InterviewChat session={session} onEnd={() => undefined} />);
    expect(screen.getByRole("alert")).toHaveTextContent("评估未完成,你可以重试");
    expect(screen.getByRole("button", { name: "重试评估" })).toBeInTheDocument();
  });

  it("追问待答:追问气泡 + 追问输入行;回答提交 submitFollowUp 并刷新", async () => {
    const session = makeSession({
      answers: [
        {
          questionId: "q-1",
          answer: "我的回答",
          evaluation: EVALUATION,
          followUpQuestion: "当时最大的困难是什么?",
          followUpAnswer: null,
        },
      ],
    });
    const user = userEvent.setup();
    render(<InterviewChat session={session} onEnd={() => undefined} />);
    expect(await screen.findByText("当时最大的困难是什么?")).toBeInTheDocument();

    await user.type(screen.getByLabelText("追问回答"), "困难是并发{Enter}");
    await waitFor(() =>
      expect(mocks.submitFollowUpMutateAsync).toHaveBeenCalledWith({ followUpAnswer: "困难是并发" })
    );
    await waitFor(() => expect(mocks.invalidateGet).toHaveBeenCalled());
  });

  it("追问待答:ghost「跳过追问」调用 skipFollowUp", async () => {
    const session = makeSession({
      answers: [
        {
          questionId: "q-1",
          answer: "我的回答",
          evaluation: EVALUATION,
          followUpQuestion: "当时最大的困难是什么?",
          followUpAnswer: null,
        },
      ],
    });
    const user = userEvent.setup();
    render(<InterviewChat session={session} onEnd={() => undefined} />);
    await user.click(screen.getByRole("button", { name: "跳过追问" }));
    await waitFor(() => expect(mocks.skipFollowUpMutateAsync).toHaveBeenCalled());
  });

  it("已跳过的追问(历史题):显示「已跳过追问」注记", () => {
    const session = makeSession({
      currentQuestionIndex: 1,
      answers: [
        {
          questionId: "q-1",
          answer: "我的回答",
          evaluation: EVALUATION,
          followUpQuestion: "当时最大的困难是什么?",
          followUpAnswer: null,
        },
      ],
    });
    render(<InterviewChat session={session} onEnd={() => undefined} />);
    expect(screen.getByText("已跳过追问")).toBeInTheDocument();
  });

  it("STAR 提示:行为面当前未作答题显示,技术面不显示", async () => {
    const { unmount } = render(<InterviewChat session={makeSession()} onEnd={() => undefined} />);
    expect(await screen.findByText("面试官提示:STAR 结构")).toBeInTheDocument();
    unmount();

    render(
      <InterviewChat session={makeSession({ interviewType: "技术面" })} onEnd={() => undefined} />
    );
    await waitFor(() => expect(screen.queryByText("面试官提示:STAR 结构")).not.toBeInTheDocument());
  });

  it("全部答完:完成卡 + 结束面试 Dialog(确认后回调 onEnd)", async () => {
    const onEnd = vi.fn();
    const user = userEvent.setup();
    render(<InterviewChat session={makeSession({ currentQuestionIndex: 5 })} onEnd={onEnd} />);
    expect(screen.getByText("全部 5 题已完成")).toBeInTheDocument();
    expect(screen.queryByLabelText("你的回答")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "结束面试,查看综合报告" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("结束本次面试?")).toBeInTheDocument();
    expect(within(dialog).getByText("AI 将基于你的全部作答生成综合报告。")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "结束面试" }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("中途结束:Dialog 提示未答题数,确认后回调 onEnd", async () => {
    const onEnd = vi.fn();
    const user = userEvent.setup();
    render(<InterviewChat session={makeSession()} onEnd={onEnd} />);

    await user.click(screen.getByRole("button", { name: "结束面试" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("还有 5 题未作答,结束后未答题目不计入报告。")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "结束面试" }));
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});
