// 画像页状态枢纽测试(2.4):四态切换(表单/分析中/失败恢复/结果占位)+ 会话内重试与刷新恢复
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileHub } from "../profile-hub";

type RunMock = {
  id: string;
  status: string;
  stale: boolean;
  progress: { stage: string; message: string }[];
  error: string | null;
  createdAt: string;
};

const mocks = vi.hoisted(() => ({
  meData: { id: "u1", name: "甲", avatarColor: null as string | null },
  meLoading: false,
  profileData: null as {
    id: string;
    version: number;
    parentVersion: number | null;
    data: unknown;
    aiAnalysis: unknown;
    careerPaths: unknown[];
  } | null,
  profileLoading: false,
  latestRunData: null as RunMock | null,
  analyzeMutateAsync: vi.fn(),
  retryMutateAsync: vi.fn(),
  invalidateProfile: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ profile: { get: { invalidate: mocks.invalidateProfile } } }),
    user: { me: { useQuery: () => ({ data: mocks.meData, isLoading: mocks.meLoading }) } },
    profile: {
      get: { useQuery: () => ({ data: mocks.profileData, isLoading: mocks.profileLoading }) },
      latestRun: {
        useQuery: () => ({ data: mocks.latestRunData, isLoading: false }),
      },
      analyze: { useMutation: () => ({ mutateAsync: mocks.analyzeMutateAsync }) },
      retry: { useMutation: () => ({ mutateAsync: mocks.retryMutateAsync }) },
    },
  },
}));

const failedRun: RunMock = {
  id: "run-failed",
  status: "failed",
  stale: false,
  progress: [],
  error: "AI 返回了无法识别的结果,请稍后重试",
  createdAt: "2026-08-20T10:00:00Z",
};

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("学历"));
  await user.click(await screen.findByRole("option", { name: "本科" }));
  await user.type(screen.getByLabelText("专业"), "计算机科学与技术");
  await user.click(screen.getByRole("button", { name: "下一步" }));
  await user.click(screen.getByRole("button", { name: "Python" }));
  await user.click(screen.getByRole("button", { name: "下一步" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.meData = { id: "u1", name: "甲", avatarColor: null };
  mocks.meLoading = false;
  mocks.profileData = null;
  mocks.profileLoading = false;
  mocks.latestRunData = null;
  mocks.invalidateProfile.mockResolvedValue(undefined);
  mocks.analyzeMutateAsync.mockResolvedValue({ profileId: "p1", version: 1, runId: "run-1" });
  mocks.retryMutateAsync.mockResolvedValue({ profileId: "p2", version: 1, runId: "run-2" });
});

describe("ProfileHub 状态机", () => {
  it("无画像且无历史 run:渲染采集表单", async () => {
    render(<ProfileHub />);
    expect(await screen.findByText("教育背景")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一步" })).toBeInTheDocument();
  });

  it("有分析结果:渲染结果视图(2.5 接入前为占位)", async () => {
    mocks.profileData = {
      id: "p1",
      version: 1,
      parentVersion: null,
      data: {},
      aiAnalysis: { summary: "画像摘要" },
      careerPaths: [],
    };
    render(<ProfileHub />);
    expect(await screen.findByText("画像分析结果即将在此展示")).toBeInTheDocument();
  });

  it("最近 run 运行中(刷新恢复):渲染分析过程视图", async () => {
    mocks.latestRunData = {
      id: "run-1",
      status: "running",
      stale: false,
      progress: [{ stage: "prompt", message: "正在理解你的背景与目标…" }],
      error: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    render(<ProfileHub />);
    expect(await screen.findByText("画像顾问")).toBeInTheDocument();
    expect(screen.getByText("分析中")).toBeInTheDocument();
    expect(screen.getByText("正在理解你的背景与目标…")).toBeInTheDocument();
  });

  it("会话内提交失败:展示友好错误,重试用最近一次提交数据(不带 runId)", async () => {
    mocks.analyzeMutateAsync.mockRejectedValue(new Error("AI 返回了无法识别的结果,请稍后重试"));
    render(<ProfileHub />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "生成我的画像" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AI 返回了无法识别的结果,请稍后重试"
    );
    mocks.analyzeMutateAsync.mockResolvedValueOnce({ profileId: "p1", version: 1, runId: "run-3" });
    await user.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(mocks.analyzeMutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.invalidateProfile).toHaveBeenCalled());
  });

  it("失败后修改信息:回到表单", async () => {
    mocks.latestRunData = failedRun;
    render(<ProfileHub />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "修改信息" }));
    expect(await screen.findByText("教育背景")).toBeInTheDocument();
  });

  it("刷新后遇到历史失败 run:重试走服务端重放(retry 带 runId)", async () => {
    mocks.latestRunData = failedRun;
    render(<ProfileHub />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(mocks.retryMutateAsync).toHaveBeenCalledWith({ runId: "run-failed" }));
    await waitFor(() => expect(mocks.invalidateProfile).toHaveBeenCalled());
  });

  it("刷新后 run 已成功:自动刷新画像数据(进入结果态)", async () => {
    mocks.latestRunData = {
      id: "run-1",
      status: "succeeded",
      stale: false,
      progress: [],
      error: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    render(<ProfileHub />);
    await waitFor(() => expect(mocks.invalidateProfile).toHaveBeenCalled());
  });
});
