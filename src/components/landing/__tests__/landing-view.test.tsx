// 首页组件测试(2026-09 Landing 升级):Header / Hero(双 CTA)/ 产品闭环 5 步 / 核心能力 Showcase /
// AI 决策逻辑 / 适用人群 / Final CTA + 页脚。禁令走查:无视频、无渐变、产品展示为真实截图。
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingView } from "../landing-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(async () => ({ error: null })),
}));
// jsdom 不加载真实图片:next/image 降级为普通 img,仅用于断言「页面含产品截图」
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

describe("LandingView", () => {
  it("Hero:eyebrow + display 标题 + 副标题 + 双 CTA(主「开始免费体验」/ 次「游客预览」)", () => {
    render(<LandingView />);
    expect(screen.getByText("AI 职业成长操作系统")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /找到你的职业方向/ })).toBeInTheDocument();
    expect(screen.getByText(/完整求职闭环/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "开始免费体验" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("button", { name: "游客预览" })).toHaveLength(2);
    // 主 CTA 指向注册
    expect(screen.getAllByRole("link", { name: "开始免费体验" })[0]).toHaveAttribute("href", "/register");
  });

  it("产品闭环:画像 → 匹配 → 路线 → 简历 → 面试 5 步齐全", () => {
    render(<LandingView />);
    expect(screen.getByRole("heading", { name: "从职业定位，到真正拿到目标岗位" })).toBeInTheDocument();
    for (const name of ["职业画像", "岗位匹配", "成长路线", "简历优化", "模拟面试"]) {
      expect(screen.getAllByRole("heading", { name })).not.toHaveLength(0);
    }
  });

  it("核心能力 Showcase 与 AI 决策逻辑、适用人群区块齐全", () => {
    render(<LandingView />);
    expect(screen.getByRole("heading", { name: "每个求职环节，都有对应的产品能力" })).toBeInTheDocument();
    // AI 决策逻辑:四步结构(理解 → 分析 → 决策 → 行动),主张「AI 不只生成内容,更帮你做职业决策」
    expect(screen.getByRole("heading", { name: "AI 不只生成内容，更帮你做职业决策" })).toBeInTheDocument();
    expect(screen.getByText("AI 分析")).toBeInTheDocument(); // ai-badge:AI 语义内容标记
    for (const name of ["理解", "决策", "行动"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    for (const label of ["大学生", "应届生", "0-3 年职场新人", "转行人群"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("Final CTA + 信任行 + 页脚:隐私政策 / 用户协议入口", () => {
    render(<LandingView />);
    expect(screen.getByRole("heading", { name: "准备好开始你的职业规划了吗？" })).toBeInTheDocument();
    expect(screen.getByText("你的数据只用于个性化分析")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "隐私政策" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "用户协议" })).toHaveAttribute("href", "/terms");
  });

  it("禁令走查:无视频/自动播放;产品展示为真实截图(有 img);无渐变类", () => {
    const { container } = render(<LandingView />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelectorAll("img").length).toBeGreaterThanOrEqual(6); // 6 张真实产品截图
    // 全站渐变数为 0(DesignRules 最高优先级)
    expect(container.querySelectorAll('[class*="gradient"]')).toHaveLength(0);
  });
});
