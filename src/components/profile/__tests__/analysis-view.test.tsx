// 分析过程视图测试(2.4):运行中进度条与阶段文案、失败态错误与操作回调、error 优先级
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AnalysisView } from "../analysis-view";
import type { RunView } from "../analysis-view";

const baseRun: RunView = {
  id: "run-1",
  status: "running",
  stale: false,
  progress: [],
  error: null,
  createdAt: "2026-08-20T10:00:00Z",
};

describe("AnalysisView", () => {
  it("分析中:Agent 卡 + 进度条按事件数推进 + 已完成阶段打勾、当前阶段高亮", () => {
    const run: RunView = {
      ...baseRun,
      progress: [
        { stage: "start", message: "正在启动「career-profile-analyzer」…" },
        { stage: "prompt", message: "正在理解你的背景与目标…" },
        { stage: "llm", message: "正在分析…" },
      ],
    };
    render(<AnalysisView run={run} error={null} onRetry={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByText("画像顾问")).toBeInTheDocument();
    expect(screen.getByText("AI 分析")).toBeInTheDocument();
    expect(screen.getByText("分析中")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "分析进度" })).toHaveAttribute(
      "aria-valuenow",
      "60"
    );
    expect(screen.getByText("正在理解你的背景与目标…")).toBeInTheDocument();
    // 已完成 2 项打勾,当前项为加载指示
    expect(screen.getAllByText("✓")).toHaveLength(2);
  });

  it("无进度数据:显示启动占位文案与空进度条", () => {
    render(<AnalysisView run={null} error={null} onRetry={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByText("正在启动分析…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "分析进度" })).toHaveAttribute(
      "aria-valuenow",
      "0"
    );
  });

  it("失败态:友好错误 + 重试/修改信息,回调正确", async () => {
    const onRetry = vi.fn();
    const onEdit = vi.fn();
    const run: RunView = {
      ...baseRun,
      status: "failed",
      error: "AI 返回了无法识别的结果,请稍后重试",
    };
    render(<AnalysisView run={run} error={null} onRetry={onRetry} onEdit={onEdit} />);
    expect(screen.getByRole("alert")).toHaveTextContent("AI 返回了无法识别的结果,请稍后重试");
    expect(screen.getByText("分析未完成")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "修改信息" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("error 优先于 run.error(会话内失败文案覆盖历史错误)", () => {
    const run: RunView = { ...baseRun, status: "failed", error: "旧错误" };
    render(<AnalysisView run={run} error="会话内失败" onRetry={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("会话内失败");
  });

  it("succeeded 态(结果页就绪前瞬时):无错误面板,进度条满格", () => {
    const run: RunView = {
      ...baseRun,
      status: "succeeded",
      progress: ["start", "prompt", "llm", "parse", "done"].map((stage, i) => ({
        stage,
        message: `阶段 ${i}`,
      })),
    };
    render(<AnalysisView run={run} error={null} onRetry={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "分析进度" })).toHaveAttribute(
      "aria-valuenow",
      "100"
    );
  });
});
