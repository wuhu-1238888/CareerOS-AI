// 顶栏组件测试(1.7):4 入口与链接、当前入口高亮(aria-current)、头像首字、用户菜单退出、移动端抽屉
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Topbar } from "../topbar";

const mocks = vi.hoisted(() => ({
  session: { user: { id: "u1", name: "测试用户", email: "u1@test.local" }, expires: "2030-01-01T00:00:00.000Z" },
  status: "authenticated" as string,
  meData: { id: "u1", name: "测试用户", avatarColor: null },
  meLoading: false,
  pathname: "/dashboard",
  push: vi.fn(),
  refresh: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: mocks.session, status: mocks.status }),
  signOut: mocks.signOut,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/trpc/client", () => ({
  trpc: {
    user: {
      me: {
        useQuery: () => ({ data: mocks.meData, isLoading: mocks.meLoading }),
      },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.status = "authenticated";
  mocks.meData = { id: "u1", name: "测试用户", avatarColor: null };
  mocks.meLoading = false;
  mocks.pathname = "/dashboard";
  mocks.signOut.mockResolvedValue({});
});

describe("Topbar", () => {
  it("渲染 4 个一级入口,href 正确(抽屉关闭时不挂载,桌面导航各一条)", () => {
    render(<Topbar />);
    const items = screen.getAllByRole("link", { name: /工作台|职业画像|成长路线|简历优化/ });
    expect(items).toHaveLength(4);
    expect(screen.getByRole("link", { name: "职业画像" }).getAttribute("href")).toBe("/profile");
    expect(screen.getByRole("link", { name: "成长路线" }).getAttribute("href")).toBe("/navigator");
    expect(screen.getByRole("link", { name: "简历优化" }).getAttribute("href")).toBe("/resume");
  });

  it("当前路由对应入口 aria-current=page 高亮", () => {
    mocks.pathname = "/navigator/tasks";
    render(<Topbar />);
    const active = screen.getAllByRole("link", { name: "成长路线" });
    expect(active.every((l) => l.getAttribute("aria-current") === "page")).toBe(true);
    const inactive = screen.getAllByRole("link", { name: "职业画像" });
    expect(inactive.every((l) => l.getAttribute("aria-current") === null)).toBe(true);
  });

  it("头像展示昵称首字", () => {
    render(<Topbar />);
    expect(screen.getByText("测")).toBeInTheDocument();
  });

  it("用户菜单:含个人设置入口,点退出登录 → signOut 并跳转 /login", async () => {
    render(<Topbar />);
    await userEvent.setup().click(screen.getByRole("button", { name: "打开用户菜单" }));
    const menu = await screen.findByRole("menu");
    // asChild 使 Link 的 role 被 Radix 覆盖为 menuitem
    const settingsItem = within(menu).getByRole("menuitem", { name: /个人设置/ });
    expect(settingsItem.getAttribute("href")).toBe("/settings");
    await userEvent.setup().click(within(menu).getByText("退出登录"));
    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false });
    expect(mocks.push).toHaveBeenCalledWith("/login");
  });

  it("移动端:汉堡按钮打开抽屉,抽屉内含 4 个导航链接", async () => {
    render(<Topbar />);
    const burger = screen.getByRole("button", { name: "打开导航菜单" });
    await userEvent.setup().click(burger);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getAllByRole("link", { name: /工作台|职业画像|成长路线|简历优化/ })).toHaveLength(4);
  });

  it("资料加载中显示占位,不渲染空首字", () => {
    mocks.meLoading = true;
    mocks.meData = { id: "u1", name: "", avatarColor: null };
    render(<Topbar />);
    expect(screen.queryByText("用")).not.toBeInTheDocument();
  });
});
