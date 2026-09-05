// ResumeTabs 测试(IA 调整 2026-09):tab 由 ?tab=resumes 驱动、切换保留其他参数、回默认 tab 删参数、未知值回落、a11y
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeTabs } from "../resume-tabs";

const mocks = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  replace: vi.fn(),
}));

vi.mock("../resume-hub", () => ({
  ResumeHub: () => <div data-testid="resume-hub" />,
}));
vi.mock("../resume-center", () => ({
  ResumeCenter: () => <div data-testid="resume-center" />,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => ({
    get: (key: string) => mocks.params[key] ?? null,
    toString: () => new URLSearchParams(mocks.params).toString(),
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = {};
});

describe("ResumeTabs", () => {
  it("无 tab 参数:默认选中「简历优化」并渲染 ResumeHub", () => {
    render(<ResumeTabs />);
    const tablist = screen.getByRole("tablist", { name: "简历模块" });
    expect(within(tablist).getByRole("tab", { name: "简历优化" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(tablist).getByRole("tab", { name: "我的简历" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByTestId("resume-hub")).toBeInTheDocument();
    expect(screen.queryByTestId("resume-center")).not.toBeInTheDocument();
  });

  it("tab=resumes:选中「我的简历」并渲染 ResumeCenter", () => {
    mocks.params = { tab: "resumes" };
    render(<ResumeTabs />);
    expect(screen.getByRole("tab", { name: "我的简历" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByTestId("resume-center")).toBeInTheDocument();
    expect(screen.queryByTestId("resume-hub")).not.toBeInTheDocument();
  });

  it("切到「我的简历」:replace 保留其他参数并追加 tab", async () => {
    mocks.params = { resumeId: "r1" };
    render(<ResumeTabs />);
    await userEvent.setup().click(screen.getByRole("tab", { name: "我的简历" }));
    expect(mocks.replace).toHaveBeenCalledWith("/resume?resumeId=r1&tab=resumes");
  });

  it("从「我的简历」切回:删除 tab 参数但保留其余参数", async () => {
    mocks.params = { tab: "resumes", resumeId: "r1" };
    render(<ResumeTabs />);
    await userEvent.setup().click(screen.getByRole("tab", { name: "简历优化" }));
    expect(mocks.replace).toHaveBeenCalledWith("/resume?resumeId=r1");
  });

  it("未知 tab 值回落「简历优化」", () => {
    mocks.params = { tab: "unknown" };
    render(<ResumeTabs />);
    expect(screen.getByRole("tab", { name: "简历优化" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByTestId("resume-hub")).toBeInTheDocument();
  });

  it("tab 面板带 role=tabpanel 且 aria-labelledby 指向选中 tab", () => {
    render(<ResumeTabs />);
    const panel = screen.getByRole("tabpanel");
    const selected = screen.getByRole("tab", { name: "简历优化" });
    expect(panel.getAttribute("aria-labelledby")).toBe(selected.getAttribute("id"));
  });
});
