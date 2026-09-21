// 首页路由测试(5.2):未登录渲染营销首页;已登录服务端重定向工作台。
// 2026-09 Landing 升级后:断言新信息架构(Hero / 产品闭环 / 信任行 / 真实产品截图)与双 CTA。
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
// jsdom 不加载真实图片:next/image 降级为普通 img,仅用于断言「页面含产品截图」
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...props} />,
}));

describe("首页(任务 5.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.session = null;
  });

  it("未登录:渲染营销首页(Hero + 闭环 + 信任行 + 真实截图),不重定向", async () => {
    const { container } = render(await Home());
    expect(screen.getByRole("heading", { name: /找到你的职业方向/ })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "开始免费体验" }).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByRole("button", { name: "游客预览" })).toHaveLength(2);
    expect(screen.getByRole("heading", { name: "从职业定位，到真正走到目标岗位" })).toBeInTheDocument();
    expect(screen.getByText("你的数据只用于个性化分析")).toBeInTheDocument();
    expect(container.querySelectorAll("img").length).toBeGreaterThan(0); // 真实产品截图
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("已登录:重定向到工作台,不渲染营销页", async () => {
    mocks.session = { user: { id: "u1" } };
    render(await Home());
    expect(mocks.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
