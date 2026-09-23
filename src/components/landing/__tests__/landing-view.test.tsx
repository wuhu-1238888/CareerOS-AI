// 首页组件测试(2026-09 Landing 升级,同月信息减法后):Header / Hero(双 CTA)/ 产品闭环 5 步 /
// AI 决策逻辑 / 适用人群 / Final CTA + 页脚(核心能力 Showcase 已删除,详细体验交给游客预览)。
// 禁令走查:无视频、无渐变;产品展示为 Hero 唯一 DOM Demo Mockup(虚构演示数据,无 img、无真实截图)。
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingView } from "../landing-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(async () => ({ error: null })),
}));

describe("LandingView", () => {
  it("Hero:眉标 + 两行大标题(display-lg)+ 副标题 + 双 CTA(主「开始免费体验」/ 次「游客预览」)+ 数据说明", () => {
    render(<LandingView />);
    expect(screen.getByText("AI 职业成长操作系统")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /找到你的职业方向/ })).toBeInTheDocument();
    expect(screen.getByText(/完整求职闭环/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "开始免费体验" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("button", { name: "游客预览" })).toHaveLength(2);
    // 主 CTA 指向注册
    expect(screen.getAllByRole("link", { name: "开始免费体验" })[0]).toHaveAttribute("href", "/register");
    // Hero 数据说明行(与 Final CTA 信任行同文案)
    expect(screen.getAllByText("你的数据只用于个性化分析")).toHaveLength(2);
  });

  it("Hero 产品展示:Landing 专用 DOM Demo Mockup(虚构演示数据,无真实账号信息)", () => {
    render(<LandingView />);
    const mockup = within(screen.getByRole("img", { name: /工作台界面示意/ }));
    // 顶栏:Logo + 六项导航(「职业画像」等同时是进度 tile 文案,故用 getAllByText)
    expect(mockup.getByText("CareerOS")).toBeInTheDocument();
    for (const item of ["首页", "职业画像", "岗位匹配", "成长路线", "简历优化", "模拟面试"]) {
      expect(mockup.getAllByText(item).length).toBeGreaterThanOrEqual(1);
    }
    // 问候:不带虚构人名
    expect(mockup.getByText(/你好，未来的职业人/)).toBeInTheDocument();
    // 我的职业成长进度:五格 = 五步闭环,数值全部非零(不出现空状态)
    expect(mockup.getByText("我的职业成长进度")).toBeInTheDocument();
    expect(mockup.getByText("继续完善信息 →")).toBeInTheDocument();
    for (const value of ["80%", "65%", "40%", "30%", "15%"]) {
      expect(mockup.getByText(value)).toBeInTheDocument();
    }
    expect(mockup.queryByText("0%")).toBeNull();
    // 推荐岗位
    expect(mockup.getByText("推荐岗位")).toBeInTheDocument();
    expect(mockup.getByText("查看更多 →")).toBeInTheDocument();
    expect(mockup.getByText("产品经理")).toBeInTheDocument();
    expect(mockup.getByText("互联网 | 15-30k | 本科及以上")).toBeInTheDocument();
    expect(mockup.getByText("匹配度 85%")).toBeInTheDocument();
  });

  it("产品闭环:画像 → 匹配 → 路线 → 简历 → 面试 5 步齐全", () => {
    render(<LandingView />);
    expect(screen.getByRole("heading", { name: "从职业定位，到真正拿到目标岗位" })).toBeInTheDocument();
    for (const name of ["职业画像", "岗位匹配", "成长路线", "简历优化", "模拟面试"]) {
      expect(screen.getAllByRole("heading", { name })).not.toHaveLength(0);
    }
    // 减法后每卡只有一句短描述,旧的「你：/CareerOS：」双行灰字已删除
    expect(screen.getByText("了解你的优势与发展方向")).toBeInTheDocument();
    expect(screen.queryByText(/你：/)).toBeNull();
    expect(screen.queryByText(/CareerOS：/)).toBeNull();
  });

  it("AI 决策逻辑与适用人群区块齐全", () => {
    render(<LandingView />);
    // AI 决策逻辑:四步结构(理解 → 分析 → 决策 → 行动),主张「AI 不只生成内容,更帮你做职业决策」
    expect(screen.getByRole("heading", { name: "AI 不只生成内容，更帮你做职业决策" })).toBeInTheDocument();
    // 「AI 分析」徽标:ai-badge 在「分析」列
    expect(screen.getAllByText("AI 分析").length).toBeGreaterThanOrEqual(1);
    for (const name of ["理解", "决策", "行动"]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
    for (const label of ["大学生", "应届生", "0-3 年职场新人", "转行人群"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // 人群卡减法:痛点细节灰字已删除
    expect(screen.queryByText("课程与社团都试过，还是不知道毕业该做什么。")).toBeNull();
  });

  it("Final CTA + 信任行 + 页脚:隐私政策 / 用户协议入口", () => {
    render(<LandingView />);
    expect(screen.getByRole("heading", { name: "准备好开始你的职业规划了吗？" })).toBeInTheDocument();
    // Hero 数据说明 + Final CTA 信任行同文案,共 2 处
    expect(screen.getAllByText("你的数据只用于个性化分析")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "隐私政策" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "用户协议" })).toHaveAttribute("href", "/terms");
  });

  it("禁令走查:无视频/自动播放;无 img(产品展示为 DOM Mockup);无渐变类;Mockup 内无可聚焦元素", () => {
    const { container } = render(<LandingView />);
    expect(container.querySelector("video")).toBeNull();
    expect(container.querySelectorAll("img")).toHaveLength(0); // 真实截图已由 DOM Mockup 取代
    // 全站渐变数为 0(DesignRules 最高优先级)
    expect(container.querySelectorAll('[class*="gradient"]')).toHaveLength(0);
    // Mockup 是纯展示装饰:内部不得含可聚焦元素
    const mockup = screen.getByRole("img", { name: /工作台界面示意/ });
    expect(mockup.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
  });
});
