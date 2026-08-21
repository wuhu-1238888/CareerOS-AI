// 简历修改对比卡测试(4.5):三态渲染(待处理/已采纳/已拒绝)、
// ai-insight 折叠(为什么这样改)、接受/拒绝/撤销回调、AI 标记仅待处理态、全态无红色删除线(DesignSystem 禁令)
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ResumeAnalysisCard, type AnalysisCardOptimization } from "../resume-analysis-card";

const base: AnalysisCardOptimization = {
  id: "opt-1",
  category: "量化表达",
  originalText: "负责订单系统开发",
  optimizedText: "主导日均 50 万笔订单系统研发",
  reason: "动词开头更抓人,量化成果更具说服力",
  status: "pending",
  updatedAt: "2026-08-20T10:00:00Z",
};

function renderCard(
  overrides: Partial<AnalysisCardOptimization> = {},
  onStatusChange: (id: string, status: string) => void = vi.fn()
) {
  const user = userEvent.setup();
  render(
    <ResumeAnalysisCard
      optimization={{ ...base, ...overrides }}
      pending={false}
      onStatusChange={onStatusChange}
    />
  );
  return { user, onStatusChange };
}

describe("ResumeAnalysisCard 三态与操作", () => {
  it("待处理态:修改前引用块 + 修改后绿块 + AI 标记 + 接受/拒绝按钮", () => {
    renderCard();
    expect(screen.getByText("量化表达")).toBeInTheDocument();
    expect(screen.getByText("AI 建议")).toBeInTheDocument();
    expect(screen.getByText("待处理")).toBeInTheDocument();
    expect(screen.getByText("修改前")).toBeInTheDocument();
    expect(screen.getByText("负责订单系统开发")).toBeInTheDocument();
    expect(screen.getByText("修改后")).toBeInTheDocument();
    // 修改后块:green-50 底 + 绿边(DesignSystem 绿边 = 建议采纳视觉语言)
    expect(screen.getByText("主导日均 50 万笔订单系统研发").parentElement).toHaveClass(
      "bg-green-50",
      "border-l-green-600"
    );
    expect(screen.getByRole("button", { name: "接受" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "拒绝" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "撤销" })).not.toBeInTheDocument();
  });

  it("「为什么这样改」折叠:默认隐藏,展开显示 ai-insight(紫底 + AI 分析)", async () => {
    const { user } = renderCard();
    expect(screen.queryByText("动词开头更抓人,量化成果更具说服力")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "为什么这样改" }));
    expect(screen.getByText("动词开头更抓人,量化成果更具说服力")).toBeInTheDocument();
    expect(screen.getByText("AI 分析")).toBeInTheDocument();
    expect(screen.getByText("动词开头更抓人,量化成果更具说服力").parentElement).toHaveClass(
      "bg-violet-50",
      "border-l-violet-400"
    );
  });

  it("点击接受:onStatusChange(id, accepted)", async () => {
    const { user, onStatusChange } = renderCard();
    await user.click(screen.getByRole("button", { name: "接受" }));
    expect(onStatusChange).toHaveBeenCalledWith("opt-1", "accepted");
  });

  it("点击拒绝:onStatusChange(id, rejected)", async () => {
    const { user, onStatusChange } = renderCard();
    await user.click(screen.getByRole("button", { name: "拒绝" }));
    expect(onStatusChange).toHaveBeenCalledWith("opt-1", "rejected");
  });

  it("已采纳态:徽章「已采纳」+ 撤销按钮,无接受/拒绝,不再显示 AI 标记", () => {
    renderCard({ status: "accepted" });
    expect(screen.getByText("已采纳")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "撤销" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "接受" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "拒绝" })).not.toBeInTheDocument();
    expect(screen.queryByText("AI 建议")).not.toBeInTheDocument();
    // 修改后块保持绿底绿边(绿 = 已采纳)
    expect(screen.getByText("主导日均 50 万笔订单系统研发").parentElement).toHaveClass(
      "bg-green-50",
      "border-l-green-600"
    );
  });

  it("已拒绝态:灰原文态(修改后块回灰底灰边)+ 撤销按钮,无 AI 标记", () => {
    renderCard({ status: "rejected" });
    expect(screen.getByText("已拒绝")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "撤销" })).toBeInTheDocument();
    expect(screen.queryByText("AI 建议")).not.toBeInTheDocument();
    // 拒绝 = 恢复原文:修改后块去强调(灰底灰边)
    expect(screen.getByText("主导日均 50 万笔订单系统研发").parentElement).toHaveClass(
      "bg-sunken",
      "border-l-hairline-strong"
    );
  });

  it("点击撤销:onStatusChange(id, pending)", async () => {
    const { user, onStatusChange } = renderCard({ status: "accepted" });
    await user.click(screen.getByRole("button", { name: "撤销" }));
    expect(onStatusChange).toHaveBeenCalledWith("opt-1", "pending");
  });

  it("全态无红色删除线(设计禁令:拒绝不用 danger 色/删除线)", () => {
    const { container } = render(
      <>
        {(["pending", "accepted", "rejected"] as const).map((status) => (
          <ResumeAnalysisCard
            key={status}
            optimization={{ ...base, status }}
            pending={false}
            onStatusChange={() => {}}
          />
        ))}
      </>
    );
    expect(container.querySelector(".line-through")).toBeNull();
    expect(container.querySelector(".text-danger")).toBeNull();
    expect(container.querySelector(".bg-danger-bg")).toBeNull();
  });
});
