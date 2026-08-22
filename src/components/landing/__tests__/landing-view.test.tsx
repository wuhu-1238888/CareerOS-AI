// 首页组件测试(5.2):主视觉区(标题 ≤14 字/副标题/单一 CTA)、三模块静态卡(无交互)、
// 信任行、DesignRules 首页禁令(唯一主按钮、无图片/视频/动效)
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LandingView } from "../landing-view";

describe("LandingView", () => {
  it("主视觉区:display 标题 + 副标题 + 唯一主 CTA「开始职业探索」→ /register", () => {
    const { container } = render(<LandingView />);
    expect(screen.getByRole("heading", { name: "AI 帮你找到职业方向" })).toBeInTheDocument();
    expect(screen.getByText("3 分钟生成职业画像,获得专属方向与成长建议")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "开始职业探索" })).toHaveAttribute("href", "/register");
    // 整页仅一个按钮化 CTA(无登录/注册等其他按钮)
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("三模块介绍:3 张静态卡片(图标 + 一句话价值),无任何链接/按钮", () => {
    const { container } = render(<LandingView />);
    expect(screen.getByRole("heading", { name: "职业画像" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "成长路线" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "简历优化" })).toBeInTheDocument();
    expect(screen.getByText("3 分钟完成画像,推荐匹配方向")).toBeInTheDocument();
    expect(screen.getByText("把目标拆成可执行的成长路线")).toBeInTheDocument();
    expect(screen.getByText("逐条解析优化,适配目标岗位")).toBeInTheDocument();
    // 模块卡为纯静态(无交互):整页链接仅 CTA + 页脚法律文档(隐私政策/用户协议)
    expect(container.querySelectorAll("a")).toHaveLength(3);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("页脚:隐私政策 / 用户协议入口(5.3)", () => {
    render(<LandingView />);
    expect(screen.getByRole("link", { name: "隐私政策" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "用户协议" })).toHaveAttribute("href", "/terms");
  });

  it("信任行:「你的数据只用于个性化分析」", () => {
    render(<LandingView />);
    expect(screen.getByText("你的数据只用于个性化分析")).toBeInTheDocument();
  });

  it("禁令走查:无图片/视频/机器人形象元素", () => {
    const { container } = render(<LandingView />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("size-"); // 仅图标 SVG
  });
});
