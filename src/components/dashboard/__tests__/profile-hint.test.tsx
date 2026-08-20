// Dashboard 问候行测试(2.7):无画像引导 / 新鲜画像状态 / 超过 7 天提示 / 加载态
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileHint } from "../profile-hint";

const DAY_MS = 24 * 60 * 60 * 1000;

const mocks = vi.hoisted(() => ({
  meData: { id: "u1", name: "甲", avatarColor: null as string | null },
  meLoading: false,
  profileData: null as {
    version: number;
    createdAt: string;
    aiAnalysis: unknown;
  } | null,
  profileLoading: false,
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    user: { me: { useQuery: () => ({ data: mocks.meData, isLoading: mocks.meLoading }) } },
    profile: {
      get: { useQuery: () => ({ data: mocks.profileData, isLoading: mocks.profileLoading }) },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.meData = { id: "u1", name: "甲", avatarColor: null };
  mocks.meLoading = false;
  mocks.profileData = null;
  mocks.profileLoading = false;
});

describe("ProfileHint", () => {
  it("无画像:问候 + 去创建引导,无过期提示", async () => {
    render(<ProfileHint />);
    expect(await screen.findByText(/你好,甲/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去创建" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByText(/建议更新/)).toBeNull();
  });

  it("新鲜画像(6 天前):显示版本与更新时间,无过期提示", async () => {
    mocks.profileData = {
      version: 2,
      createdAt: new Date(Date.now() - 6 * DAY_MS).toISOString(),
      aiAnalysis: { summary: "画像" },
    };
    render(<ProfileHint />);
    expect(await screen.findByText(/画像 v2 · 已更新于/)).toBeInTheDocument();
    expect(screen.queryByText(/建议更新/)).toBeNull();
  });

  it("画像超过 7 天(8 天前):显示建议更新提示与入口", async () => {
    mocks.profileData = {
      version: 1,
      createdAt: new Date(Date.now() - 8 * DAY_MS).toISOString(),
      aiAnalysis: { summary: "画像" },
    };
    render(<ProfileHint />);
    expect(await screen.findByText(/建议更新以获得更准确的建议/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "更新画像" })).toHaveAttribute("href", "/profile");
  });

  it("加载中:不渲染任何内容", () => {
    mocks.meLoading = true;
    const { container } = render(<ProfileHint />);
    expect(container).toBeEmptyDOMElement();
  });
});
