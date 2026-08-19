// 页面头组件测试(1.7):标题/描述/右侧操作槽
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "../page-header";

describe("PageHeader", () => {
  it("渲染标题与描述", () => {
    render(<PageHeader title="职业画像" description="梳理你的技能与兴趣" />);
    expect(screen.getByRole("heading", { level: 1, name: "职业画像" })).toBeInTheDocument();
    expect(screen.getByText("梳理你的技能与兴趣")).toBeInTheDocument();
  });

  it("无描述时不渲染描述节点,操作槽按需渲染", () => {
    const { rerender } = render(<PageHeader title="工作台" />);
    expect(screen.queryByRole("heading", { level: 1, name: "工作台" })).toBeInTheDocument();

    rerender(
      <PageHeader title="工作台" actions={<button type="button">开始创建</button>} />
    );
    expect(screen.getByRole("button", { name: "开始创建" })).toBeInTheDocument();
  });
});
