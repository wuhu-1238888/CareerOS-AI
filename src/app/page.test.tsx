// 首页路由测试(5.2):未登录渲染营销首页;已登录服务端重定向工作台。
// 2026-09 Landing 升级后:断言新信息架构(Hero / DOM Demo Mockup / 产品闭环 / 信任行)与双 CTA。
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

const mocks = vi.hoisted(() => ({
  session: null as { user?: unknown } | null,
  redirect: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => mocks.router,
}));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => mocks.session) }));
// 游客预览按钮依赖 next-auth/react;测试不触发登录,stub 即可
vi.mock("next-auth/react", () => ({
  signIn: vi.fn(async () => ({ error: null })),
}));
// jsdom 不加载真实图片:产品展示已是 DOM Mockup,无 next/image 依赖

describe("首页(任务 5.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = null;
  });

  it("未登录:渲染营销首页(Hero + Mockup + 闭环 + 信任行),不重定向", async () => {
    const { container } = render(await Home());
    expect(screen.getByRole("heading", { name: /找到你的职业方向/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "开始免费体验" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("button", { name: "游客预览" })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "从职业定位，到真正走到目标岗位" })).toBeInTheDocument();
    expect(screen.getAllByText("你的数据只用于个性化分析")).toHaveLength(2); // Hero 数据说明 + Final CTA 信任行
    expect(screen.getByRole("img", { name: /工作台界面示意/ })).toBeInTheDocument(); // DOM Demo Mockup
    expect(container.querySelectorAll("img")).toHaveLength(0); // 不再使用真实截图
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("已登录:重定向到工作台,不渲染营销页", async () => {
    mocks.session = { user: { id: "u1" } };
    render(await Home());
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
