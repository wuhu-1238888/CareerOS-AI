// 成长路线页状态枢纽测试(3.4/3.5):四态切换(方向表单/生成过程/失败恢复/时间线)+ 会话内重试、
// 刷新恢复(retry 重放 / succeeded 自动刷新)+ 重新生成预填 + 提交载荷 + 任务三态切换/反馈重生成接线
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NavigatorHub } from "../navigator-hub";

type RunMock = {
  id: string;
  status: string;
  stale: boolean;
  progress: { stage: string; message: string }[];
  error: string | null;
  createdAt: string;
};

type RoadmapMock = {
  id: string;
  targetDirection: string;
  weeklyHours: number | null;
  currentStage: string | null;
  summary: { totalDuration: string; stageCount: number; finalGoal: string } | null;
  stages: {
    id: string;
    name: string;
    goal: string;
    order: number;
    estimatedDuration: string | null;
    content: {
      learningContent: string[];
      practiceProjects: { title: string; deliverable: string }[];
      resources: string[];
      checkpoints: string[];
    } | null;
    tasks: { id: string; description: string; type: string; status: string; order: number }[];
  }[];
};

const mocks = vi.hoisted(() => ({
  profileData: null as {
    id: string;
    version: number;
    parentVersion: number | null;
    data: unknown;
    aiAnalysis: unknown;
    careerPaths: { directionName: string; matchScore: number; strengths: string[] }[];
  } | null,
  profileLoading: false,
  roadmapData: null as RoadmapMock | null,
  roadmapLoading: false,
  latestRunData: null as RunMock | null,
  generateMutateAsync: vi.fn(),
  retryMutateAsync: vi.fn(),
  updateStatusMutateAsync: vi.fn(),
  regenerateStageMutateAsync: vi.fn(),
  invalidateRoadmap: vi.fn(),
}));

// 6.8:ShareDialog 动态 import html-to-image,jsdom 下统一 mock(下载行为在 share-dialog.test 覆盖)
vi.mock("html-to-image", () => ({ toPng: vi.fn() }));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({
      navigator: { roadmap: { get: { invalidate: mocks.invalidateRoadmap } } },
    }),
    profile: {
      get: { useQuery: () => ({ data: mocks.profileData, isLoading: mocks.profileLoading }) },
    },
    navigator: {
      roadmap: {
        get: { useQuery: () => ({ data: mocks.roadmapData, isLoading: mocks.roadmapLoading }) },
        latestRun: {
          useQuery: () => ({ data: mocks.latestRunData, isLoading: false }),
        },
        generate: { useMutation: () => ({ mutateAsync: mocks.generateMutateAsync }) },
        retry: { useMutation: () => ({ mutateAsync: mocks.retryMutateAsync }) },
      },
      stage: {
        regenerate: { useMutation: () => ({ mutateAsync: mocks.regenerateStageMutateAsync }) },
      },
      task: {
        updateStatus: { useMutation: () => ({ mutateAsync: mocks.updateStatusMutateAsync }) },
      },
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

const roadmapData: RoadmapMock = {
  id: "r1",
  targetDirection: "后端开发",
  weeklyHours: 10,
  currentStage: "有一定基础",
  summary: {
    totalDuration: "6 个月",
    stageCount: 2,
    finalGoal: "达到初级后端开发工程师水平",
  },
  stages: [
    {
      id: "s1",
      name: "夯实基础",
      goal: "掌握 Python 与 SQL 基础",
      order: 1,
      estimatedDuration: "2 个月",
      content: {
        learningContent: ["Python 语法", "SQL 查询"],
        practiceProjects: [{ title: "图书管理 API", deliverable: "可运行的 REST API" }],
        resources: ["Python 官方文档"],
        checkpoints: ["能独立完成数据清洗"],
      },
      tasks: [
        { id: "t1", description: "学习 Python 语法", type: "学习", status: "pending", order: 1 },
      ],
    },
    {
      id: "s2",
      name: "框架进阶",
      goal: "掌握 Web 框架",
      order: 2,
      estimatedDuration: "1 个月",
      content: null,
      tasks: [],
    },
  ],
};

async function fillDirectionForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("自定义方向"), "后端开发工程师");
  await user.type(screen.getByLabelText("每周可投入时间"), "10");
  await user.click(screen.getByRole("button", { name: "有一定基础" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profileData = null;
  mocks.profileLoading = false;
  mocks.roadmapData = null;
  mocks.roadmapLoading = false;
  mocks.latestRunData = null;
  mocks.invalidateRoadmap.mockResolvedValue(undefined);
  mocks.generateMutateAsync.mockResolvedValue({ roadmapId: "r1", runId: "run-1" });
  mocks.retryMutateAsync.mockResolvedValue({ roadmapId: "r2", runId: "run-2" });
  mocks.updateStatusMutateAsync.mockResolvedValue({ status: "in_progress" });
  mocks.regenerateStageMutateAsync.mockResolvedValue({ stageId: "s1" });
});

describe("NavigatorHub 状态机", () => {
  it("无路线图且无历史 run:渲染方向选择表单", async () => {
    render(<NavigatorHub />);
    expect(await screen.findByText("目标方向")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成成长路线" })).toBeInTheDocument();
  });

  it("有画像:渲染推荐方向卡(方向名 + 匹配度)", async () => {
    mocks.profileData = {
      id: "p1",
      version: 1,
      parentVersion: null,
      data: {},
      aiAnalysis: {},
      careerPaths: [
        { directionName: "后端开发", matchScore: 85, strengths: ["Python 熟练"] },
        { directionName: "数据分析", matchScore: 70, strengths: [] },
      ],
    };
    render(<NavigatorHub />);
    expect(await screen.findByText("根据你的画像推荐,点击选择")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /后端开发/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /数据分析/ })).toBeInTheDocument();
    expect(screen.getAllByText("匹配度")).toHaveLength(2);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();
  });

  it("最近 run 运行中(刷新恢复):渲染「职业规划师」分析过程视图", async () => {
    mocks.latestRunData = {
      id: "run-1",
      status: "running",
      stale: false,
      progress: [{ stage: "prompt", message: "正在理解你的目标方向…" }],
      error: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    render(<NavigatorHub />);
    expect(await screen.findByText("职业规划师")).toBeInTheDocument();
    expect(screen.getByText("分析中")).toBeInTheDocument();
    expect(screen.getByText("正在规划你的成长路线,拆解阶段与任务")).toBeInTheDocument();
    expect(screen.getByText("正在理解你的目标方向…")).toBeInTheDocument();
  });

  it("会话内提交失败:友好错误,重试用最近一次提交数据(不带 runId)", async () => {
    mocks.generateMutateAsync.mockRejectedValue(new Error("AI 返回了无法识别的结果,请稍后重试"));
    render(<NavigatorHub />);
    const user = userEvent.setup();
    await fillDirectionForm(user);
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "AI 返回了无法识别的结果,请稍后重试"
    );
    mocks.generateMutateAsync.mockResolvedValueOnce({ roadmapId: "r1", runId: "run-3" });
    await user.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(mocks.generateMutateAsync).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mocks.invalidateRoadmap).toHaveBeenCalled());
  });

  it("失败后修改信息:回到方向表单", async () => {
    mocks.latestRunData = failedRun;
    render(<NavigatorHub />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "修改信息" }));
    expect(await screen.findByText("目标方向")).toBeInTheDocument();
  });

  it("刷新后历史失败 run:重试走服务端重放(retry 带 runId)", async () => {
    mocks.latestRunData = failedRun;
    render(<NavigatorHub />);
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(mocks.retryMutateAsync).toHaveBeenCalledWith({ runId: "run-failed" }));
    await waitFor(() => expect(mocks.invalidateRoadmap).toHaveBeenCalled());
  });

  it("刷新后 run 已成功:自动 invalidate 路线图查询(进入时间线态)", async () => {
    mocks.latestRunData = {
      id: "run-1",
      status: "succeeded",
      stale: false,
      progress: [],
      error: null,
      createdAt: "2026-08-20T10:00:00Z",
    };
    render(<NavigatorHub />);
    await waitFor(() => expect(mocks.invalidateRoadmap).toHaveBeenCalled());
  });

  it("提交成功:载荷正确(方向/周时/阶段自评)并刷新路线图", async () => {
    render(<NavigatorHub />);
    const user = userEvent.setup();
    await fillDirectionForm(user);
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    await waitFor(() =>
      expect(mocks.generateMutateAsync).toHaveBeenCalledWith({
        direction: "后端开发工程师",
        weeklyHours: 10,
        currentStage: "有一定基础",
      })
    );
    await waitFor(() => expect(mocks.invalidateRoadmap).toHaveBeenCalled());
  });

  it("选择推荐卡提交:direction 取所选推荐卡", async () => {
    mocks.profileData = {
      id: "p1",
      version: 1,
      parentVersion: null,
      data: {},
      aiAnalysis: {},
      careerPaths: [{ directionName: "后端开发", matchScore: 85, strengths: ["Python 熟练"] }],
    };
    render(<NavigatorHub />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: /后端开发/ }));
    await user.type(screen.getByLabelText("每周可投入时间"), "8");
    await user.click(screen.getByRole("button", { name: "完全新手" }));
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    await waitFor(() =>
      expect(mocks.generateMutateAsync).toHaveBeenCalledWith({
        direction: "后端开发",
        weeklyHours: 8,
        currentStage: "完全新手",
      })
    );
  });

  it("有路线图:渲染时间线;「重新生成」回到预填表单", async () => {
    mocks.roadmapData = roadmapData;
    render(<NavigatorHub />);
    expect(await screen.findByText("成为「后端开发」的 6 个月 路径")).toBeInTheDocument();
    expect(screen.getByText("达到初级后端开发工程师水平")).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "重新生成" }));
    // 预填:方向落入自定义输入,周时/阶段自评预选
    expect(await screen.findByLabelText("自定义方向")).toHaveValue("后端开发");
    expect(screen.getByLabelText("每周可投入时间")).toHaveValue(10);
    expect(screen.getByRole("button", { name: /有一定基础/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // 重新生成提交后回到生成过程视图
    mocks.generateMutateAsync.mockResolvedValueOnce({ roadmapId: "r3", runId: "run-3" });
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    await waitFor(() => expect(mocks.invalidateRoadmap).toHaveBeenCalled());
  });

  it("任务三态切换(3.5):updateStatus mutation 载荷正确并刷新路线图", async () => {
    mocks.roadmapData = roadmapData;
    render(<NavigatorHub />);
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: /任务「学习 Python 语法」/ }));
    await waitFor(() =>
      expect(mocks.updateStatusMutateAsync).toHaveBeenCalledWith({
        taskId: "t1",
        status: "in_progress",
      })
    );
    await waitFor(() => expect(mocks.invalidateRoadmap).toHaveBeenCalled());
  });

  it("任务反馈(3.5):太难了 → stage.regenerate 载荷正确 + 成功 toast + 刷新", async () => {
    mocks.roadmapData = roadmapData;
    render(
      <>
        <Toaster />
        <NavigatorHub />
      </>
    );
    await userEvent.setup().click(await screen.findByRole("button", { name: "太难了" }));
    await waitFor(() =>
      expect(mocks.regenerateStageMutateAsync).toHaveBeenCalledWith({
        roadmapId: "r1",
        stageId: "s1",
        feedback: "太难了",
      })
    );
    expect(await screen.findByText("已按你的反馈调整该阶段,内容已更新")).toBeInTheDocument();
    await waitFor(() => expect(mocks.invalidateRoadmap).toHaveBeenCalled());
  });

  it("任务反馈失败(3.5):错误 toast,不刷新路线图", async () => {
    mocks.roadmapData = roadmapData;
    mocks.regenerateStageMutateAsync.mockRejectedValue(
      new Error("AI 返回了无法识别的结果,请稍后重试")
    );
    render(
      <>
        <Toaster />
        <NavigatorHub />
      </>
    );
    await userEvent.setup().click(await screen.findByRole("button", { name: "太难了" }));
    expect(await screen.findByText("AI 返回了无法识别的结果,请稍后重试")).toBeInTheDocument();
    expect(mocks.invalidateRoadmap).not.toHaveBeenCalled();
  });

  it("分享路线图(6.8):概览带按钮打开分享对话框,卡片数据与时间线同源", async () => {
    mocks.roadmapData = roadmapData;
    render(<NavigatorHub />);
    await userEvent
      .setup()
      .click(await screen.findByRole("button", { name: "分享路线图" }));
    expect(await screen.findByText("分享图片")).toBeInTheDocument();
    expect(screen.getByText("下载图片后分享到微信、朋友圈或其他渠道")).toBeInTheDocument();
    // 卡片:标题 + 路径文案(概览带也有一份 → 2 处)+ 阶段列表 + 总进度
    expect(screen.getByText("我的成长路线")).toBeInTheDocument();
    expect(screen.getAllByText("成为「后端开发」的 6 个月 路径")).toHaveLength(2);
    expect(screen.getByLabelText("成长阶段")).toHaveTextContent("夯实基础");
    expect(screen.getByLabelText("成长阶段")).toHaveTextContent("框架进阶");
    expect(screen.getByText("总进度 0% · 每周 10 小时")).toBeInTheDocument();
  });
});
