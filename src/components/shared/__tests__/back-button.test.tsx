// 页面级「返回」文本链接测试(4.15 先例,goBackOrFallback 三路径):
// 应用内导航 → router.back() 回上一页;直接打开(无历史)或外链进入(跨源 referrer)→ 回兜底页。
// 样式为低强调文本链接(非主 CTA);label 可定制(如个人成长报告页「返回工作台」)。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackButton } from "../back-button";

const mocks = vi.hoisted(() => ({
  // 稳定 router 对象(与生产 useRouter 一致;对象身份每渲染变化会导致重渲染)
  router: { back: vi.fn(), replace: vi.fn(), push: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => mocks.router,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BackButton(通用返回链接)", () => {
  it("渲染「← 返回」链接(默认 label)", () => {
    render(<BackButton />);
    expect(screen.getByRole("button", { name: "返回" })).toBeInTheDocument();
  });

  it("自定义 label(个人成长报告页:返回工作台)", () => {
    render(<BackButton label="返回工作台" />);
    expect(screen.getByRole("button", { name: "返回工作台" })).toBeInTheDocument();
  });

  it("应用内进入(有历史、同源)→ router.back() 回上一页", async () => {
    const lengthSpy = vi.spyOn(window.history, "length", "get").mockReturnValue(2);
    render(<BackButton />);
    await userEvent.setup().click(screen.getByRole("button", { name: /返回/ }));
    expect(mocks.router.back).toHaveBeenCalledTimes(1);
    expect(mocks.router.replace).not.toHaveBeenCalled();
    lengthSpy.mockRestore();
  });

  it("直接打开(无应用内历史)→ 回默认兜底页 /dashboard", async () => {
    const lengthSpy = vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    render(<BackButton />);
    await userEvent.setup().click(screen.getByRole("button", { name: /返回/ }));
    expect(mocks.router.back).not.toHaveBeenCalled();
    expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard");
    lengthSpy.mockRestore();
  });

  it("外链进入(跨源 referrer)→ 回兜底页,不把用户带出应用", async () => {
    const lengthSpy = vi.spyOn(window.history, "length", "get").mockReturnValue(2);
    const referrerSpy = vi.spyOn(document, "referrer", "get").mockReturnValue("https://example.com/");
    render(<BackButton />);
    await userEvent.setup().click(screen.getByRole("button", { name: /返回/ }));
    expect(mocks.router.back).not.toHaveBeenCalled();
    expect(mocks.router.replace).toHaveBeenCalledWith("/dashboard");
    lengthSpy.mockRestore();
    referrerSpy.mockRestore();
  });

  it("自定义兜底页:直接打开 → 回传入的 fallback", async () => {
    const lengthSpy = vi.spyOn(window.history, "length", "get").mockReturnValue(1);
    render(<BackButton fallback="/profile" />);
    await userEvent.setup().click(screen.getByRole("button", { name: /返回/ }));
    expect(mocks.router.replace).toHaveBeenCalledWith("/profile");
    lengthSpy.mockRestore();
  });
});
