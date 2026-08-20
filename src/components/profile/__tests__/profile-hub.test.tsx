// 画像页状态枢纽测试(2.4/2.6):四态切换(表单/分析中/失败恢复/结果视图)+ 会话内重试、刷新恢复与纠偏重算
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
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
      listVersions: { useQuery: () => ({ data: [], isLoading: false }) },
      getVersion: { useQuery: () => ({ data: undefined, isLoading: false }) },
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

// 合法分析结果(纠偏流程需要结果视图上的「这不是我」入口)
const validAnalysis = {
  summary: "计算机专业应届生。",
  abilityTags: [
    { name: "Python", level: "熟练" },
    { name: "SQL", level: "熟练" },
    { name: "JavaScript", level: "基础" },
  ],
  strengths: [
    { title: "实践经历对口", detail: "两段开发经历均与目标岗位直接相关" },
    { title: "目标清晰", detail: "岗位目标与能力积累方向一致" },
    { title: "技能组合完整", detail: "编程语言与数据库技能配套" },
  ],
  directions: [
    {
      name: "后端开发",
      matchScore: 85,
      reason: "技术栈匹配",
      strengths: ["Python 熟练"],
      weaknesses: ["缺少分布式经验"],
    },
    {
      name: "数据分析",
      matchScore: 70,
      reason: "SQL 基础",
      strengths: ["SQL 熟练"],
      weaknesses: [],
    },
  ],
  radar: { 产品: 40, 技术: 80, 数据: 68, 沟通: 50, 项目: 66, 行业: 45 },
  suggestions: [{ gap: "缺少分布式经验", action: "完成一个分布式项目" }],
  confidence: { level: "高", note: "信息齐全" },
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

  it("有分析结果:渲染结果视图;分析数据非法时给出异常提示(渲染前校验)", async () => {
    mocks.profileData = {
      id: "p1",
      version: 1,
      parentVersion: null,
      data: {},
      aiAnalysis: { summary: "画像摘要" },
      careerPaths: [],
    };
    render(<ProfileHub />);
    expect(await screen.findByText("分析数据异常,请重新分析画像")).toBeInTheDocument();
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

  it("纠偏(2.6):这不是我 → 弹窗提交 → Toast → 带反馈重算 → 重算期间展示分析过程", async () => {
    mocks.profileData = {
      id: "p1",
      version: 1,
      parentVersion: null,
      data: {},
      aiAnalysis: validAnalysis,
      careerPaths: [],
    };
    let resolveAnalyze!: (value: unknown) => void;
    mocks.analyzeMutateAsync.mockImplementation(
      () => new Promise((resolve) => (resolveAnalyze = resolve))
    );
    render(
      <>
        <Toaster />
        <ProfileHub />
      </>
    );
    const user = userEvent.setup();
    expect(await screen.findByText("计算机专业应届生。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "这不是我" }));
    expect(await screen.findByText("哪些部分不准确?")).toBeInTheDocument();
    await user.click(screen.getByText("推荐方向不准确"));
    await user.click(screen.getByRole("button", { name: "提交反馈" }));
    expect(await screen.findByText("已记录,AI 将重新分析")).toBeInTheDocument();
    await waitFor(() =>
      expect(mocks.analyzeMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ feedback: { areas: ["direction"], note: undefined } })
      )
    );
    // 重算期间展示分析过程视图(优先级高于旧结果)
    expect(await screen.findByText("画像顾问")).toBeInTheDocument();
    resolveAnalyze({ profileId: "p2", version: 2, runId: "run-2" });
    await waitFor(() => expect(mocks.invalidateProfile).toHaveBeenCalled());
  });

  it("纠偏重算失败:失败视图重试携带反馈(会话内重放)", async () => {
    mocks.profileData = {
      id: "p1",
      version: 1,
      parentVersion: null,
      data: {},
      aiAnalysis: validAnalysis,
      careerPaths: [],
    };
    mocks.analyzeMutateAsync.mockRejectedValueOnce(new Error("AI 返回了无法识别的结果,请稍后重试"));
    render(
      <>
        <Toaster />
        <ProfileHub />
      </>
    );
    const user = userEvent.setup();
    expect(await screen.findByText("计算机专业应届生。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "这不是我" }));
    await user.click(await screen.findByText("能力评估不准确"));
    await user.click(screen.getByRole("button", { name: "提交反馈" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AI 返回了无法识别的结果,请稍后重试"
    );
    mocks.analyzeMutateAsync.mockResolvedValueOnce({ profileId: "p2", version: 2, runId: "run-3" });
    await user.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(mocks.analyzeMutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(mocks.analyzeMutateAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({ feedback: { areas: ["ability"], note: undefined } })
      )
    );
    await waitFor(() => expect(mocks.invalidateProfile).toHaveBeenCalled());
  });

  it("更新信息(2.7):结果页进入预填表单(标题「更新画像信息」),提交走分析管线", async () => {
    mocks.profileData = {
      id: "p2",
      version: 2,
      parentVersion: 1,
      data: {
        education: [{ degree: "本科", major: "软件工程" }],
        skills: [{ name: "Python", level: "熟练" }],
        experiences: [],
        interests: [],
        targets: [],
      },
      aiAnalysis: validAnalysis,
      careerPaths: [],
    };
    render(<ProfileHub />);
    const user = userEvent.setup();
    expect(await screen.findByText("计算机专业应届生。")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "更新信息" }));
    expect(await screen.findByText("更新画像信息")).toBeInTheDocument();
    expect(screen.getByLabelText("专业")).toHaveValue("软件工程");
    await user.clear(screen.getByLabelText("专业"));
    await user.type(screen.getByLabelText("专业"), "数据科学");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "生成我的画像" }));
    await waitFor(() => expect(mocks.analyzeMutateAsync).toHaveBeenCalledTimes(1));
    const input = mocks.analyzeMutateAsync.mock.calls[0]![0] as {
      education: { major?: string }[];
      feedback?: unknown;
    };
    expect(input.education[0]?.major).toBe("数据科学");
    expect(input.feedback).toBeUndefined();
    await waitFor(() => expect(mocks.invalidateProfile).toHaveBeenCalled());
  });
});
