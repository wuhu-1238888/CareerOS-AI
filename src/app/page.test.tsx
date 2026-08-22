// 首页路由测试(5.2):未登录渲染营销首页;已登录服务端重定向工作台
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const mocks = vi.hoisted(() => ({
  session: null as { user?: unknown } | null,
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => mocks.session) }));

describe("首页(任务 5.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = null;
  });

  it("未登录:渲染营销首页(主视觉 + 三模块 + 信任行),不重定向", async () => {
    const { container } = render(await Home());
    expect(screen.getByRole("heading", { name: "AI 帮你找到职业方向" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "开始职业探索" })).toHaveAttribute("href", "/register");
    expect(screen.getByText("你的数据只用于个性化分析")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull(); // 禁令:无机器人形象
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("已登录:重定向到工作台,不渲染营销页", async () => {
    mocks.session = { user: { id: "u1" } };
    render(await Home());
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
