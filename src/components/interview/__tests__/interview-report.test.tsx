// 模拟面试综合报告视图测试(7.3):均分前端确定性计算(仅含已评估题,一位小数,
// 未评估题不计入分母)/评分展示(「/ 10」明示 10 分制 + 内容能力/表达能力标签 +
// 动态「已评估 X / N 题」注记:部分=阶段性参考、全部=评分已完成、0=暂无评分不渲染分数)/
// 四要素渲染(总体评价/突出优势/主要短板/重点改进方向)/
// 返回对话回调/开始新面试确认 Dialog(取消不回调,确认回调 onNewInterview)/
// report null 兜底卡(作答记录保留提示,不报错)。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { InterviewReport } from "../interview-report";
import type { InterviewAnswerItem } from "@/lib/interview/analysis-schemas";

type SessionMock = {
  interviewType: string;
  targetPosition: string;
  questionCount: number;
  answers: InterviewAnswerItem[] | null;
  report: {
    overallEvaluation: string;
    strengths: string[];
    weaknesses: string[];
    keyImprovements: string[];
  } | null;
};

const REPORT = {
  overallEvaluation: "整体表现扎实,对项目经历的讲解清楚可信。",
  strengths: ["项目经验丰富,细节真实", "沟通表达结构清晰"],
  weaknesses: ["量化结果偏少", "技术细节追问准备不足"],
  keyImprovements: ["用 STAR + 量化结果重写两段核心经历,用数据支撑每一项成果。"],
};

const EVALUATED_ANSWERS: InterviewAnswerItem[] = [
  {
    questionId: "q-1",
    answer: "我是后端实习生,负责订单服务。",
    evaluation: { contentScore: 8, expressionScore: 6, improvementSuggestion: "补充量化结果。" },
    followUpQuestion: null,
    followUpAnswer: null,
  },
  {
    questionId: "q-2",
    answer: "最有成就感的是支付网关项目。",
    evaluation: { contentScore: 9, expressionScore: 7, improvementSuggestion: "补充技术细节。" },
    followUpQuestion: null,
    followUpAnswer: null,
  },
];

function makeSession(overrides: Partial<SessionMock> = {}): SessionMock {
  return {
    interviewType: "行为面",
    targetPosition: "后端开发工程师",
    questionCount: 2,
    answers: EVALUATED_ANSWERS,
    report: REPORT,
    ...overrides,
  };
}

describe("InterviewReport(7.3)", () => {
  it("Hero:标题/场次信息/内容与表达能力均分(「/ 10」+ 标签)+ 全部评估完成注记", () => {
    render(
      <InterviewReport session={makeSession()} onBackToChat={() => undefined} onNewInterview={() => undefined} />
    );
    expect(screen.getByText("模拟面试综合报告")).toBeInTheDocument();
    expect(screen.getByText("行为面 · 后端开发工程师")).toBeInTheDocument();
    // 内容能力 (8+9)/2 = 8.5,表达能力 (6+7)/2 = 6.5
    expect(screen.getByText("8.5")).toBeInTheDocument();
    expect(screen.getByText("6.5")).toBeInTheDocument();
    expect(screen.getByText("内容能力")).toBeInTheDocument();
    expect(screen.getByText("表达能力")).toBeInTheDocument();
    expect(screen.getAllByText("/ 10")).toHaveLength(2);
    // 2 / 2 全部评估 → 完成态措辞 + 评分标准辅助文案
    expect(screen.getByText("已评估 2 / 2 题 · 本次面试评分已完成")).toBeInTheDocument();
    expect(screen.getByText("评分标准:10 分制 · 基于已完成题目的回答进行评估")).toBeInTheDocument();
  });

  it("均分仅含已评估题(未评估不计入分母)→ 部分评估阶段性注记;answers null → 0 已评估不渲染分数", () => {
    const session = makeSession({
      answers: [
        EVALUATED_ANSWERS[0]!,
        {
          questionId: "q-2",
          answer: "未评估的答案",
          evaluation: null,
          followUpQuestion: null,
          followUpAnswer: null,
        },
      ],
    });
    const { unmount } = render(
      <InterviewReport session={session} onBackToChat={() => undefined} onNewInterview={() => undefined} />
    );
    expect(screen.getByText("已评估 1 / 2 题 · 当前评分仅供阶段性参考")).toBeInTheDocument();
    expect(screen.getByText("8.0")).toBeInTheDocument();
    expect(screen.getByText("6.0")).toBeInTheDocument();
    unmount();

    render(
      <InterviewReport
        session={makeSession({ answers: null })}
        onBackToChat={() => undefined}
        onNewInterview={() => undefined}
      />
    );
    expect(screen.queryByText("内容能力")).not.toBeInTheDocument();
    expect(screen.queryByText("表达能力")).not.toBeInTheDocument();
    expect(screen.queryByText("/ 10")).not.toBeInTheDocument();
    expect(screen.getByText("已评估 0 / 2 题 · 本场暂无评分")).toBeInTheDocument();
  });

  it("四要素渲染:总体评价/突出优势/主要短板/重点改进方向(AI 建议徽章)", () => {
    render(
      <InterviewReport session={makeSession()} onBackToChat={() => undefined} onNewInterview={() => undefined} />
    );
    expect(screen.getByText("总体评价")).toBeInTheDocument();
    expect(screen.getByText(REPORT.overallEvaluation)).toBeInTheDocument();
    expect(screen.getByText("突出优势")).toBeInTheDocument();
    expect(screen.getByText(REPORT.strengths[0]!)).toBeInTheDocument();
    expect(screen.getByText(REPORT.strengths[1]!)).toBeInTheDocument();
    expect(screen.getByText("主要短板")).toBeInTheDocument();
    expect(screen.getByText(REPORT.weaknesses[0]!)).toBeInTheDocument();
    expect(screen.getByText(REPORT.weaknesses[1]!)).toBeInTheDocument();
    expect(screen.getByText("重点改进方向")).toBeInTheDocument();
    expect(screen.getByText("AI 建议")).toBeInTheDocument();
    expect(screen.getByText(REPORT.keyImprovements[0]!)).toBeInTheDocument();
  });

  it("「返回对话」触发 onBackToChat", async () => {
    const onBackToChat = vi.fn();
    const user = userEvent.setup();
    render(
      <InterviewReport session={makeSession()} onBackToChat={onBackToChat} onNewInterview={() => undefined} />
    );
    await user.click(screen.getByRole("button", { name: "返回对话" }));
    expect(onBackToChat).toHaveBeenCalledTimes(1);
  });

  it("「开始新面试」→ 确认 Dialog(覆盖提示);取消不回调,确认回调 onNewInterview", async () => {
    const onNewInterview = vi.fn();
    const user = userEvent.setup();
    render(
      <InterviewReport session={makeSession()} onBackToChat={() => undefined} onNewInterview={onNewInterview} />
    );
    await user.click(screen.getByRole("button", { name: "开始新面试" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("开始新面试?")).toBeInTheDocument();
    expect(
      within(dialog).getByText("开始新面试将覆盖本场面试的全部记录,本次综合报告将无法再查看。")
    ).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "取消" }));
    expect(onNewInterview).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "开始新面试" }));
    const dialog2 = await screen.findByRole("dialog");
    await user.click(within(dialog2).getByRole("button", { name: "开始新面试" }));
    expect(onNewInterview).toHaveBeenCalledTimes(1);
  });

  it("report null → 兜底卡「综合报告不可用」(提示作答记录保留),仍可开始新面试", () => {
    render(
      <InterviewReport
        session={makeSession({ report: null })}
        onBackToChat={() => undefined}
        onNewInterview={() => undefined}
      />
    );
    expect(screen.getByText("综合报告不可用")).toBeInTheDocument();
    expect(screen.getByText("报告数据缺失或损坏,你的作答记录仍保存在对话中。")).toBeInTheDocument();
    expect(screen.queryByText("总体评价")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回对话" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始新面试" })).toBeInTheDocument();
  });
});
