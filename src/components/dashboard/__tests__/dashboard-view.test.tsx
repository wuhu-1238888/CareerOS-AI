// 工作台测试(5.1):四态(加载骨架/空态引导/错误重试/内容)、KPI 增量徽章、Agent 卡状态与进度条、
// 模块入口「继续上次」、画像过期提示、无基线时不渲染徽章
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DashboardStats } from "@/lib/dashboard/stats";
import { DashboardView } from "../dashboard-view";

const DAY_MS = 24 * 60 * 60 * 1000;

const mocks = vi.hoisted(() => ({
  meData: { id: "u1", name: "甲", avatarColor: null as string | null },
  meLoading: false,
  meError: false,
  statsData: null as DashboardStats | null,
  statsLoading: false,
  statsError: false,
  refetch: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    user: {
      me: {
        useQuery: () => ({
          data: mocks.meData,
          isLoading: mocks.meLoading,
          isError: mocks.meError,
          refetch: mocks.refetch,
        }),
      },
    },
    dashboard: {
      stats: {
        useQuery: () => ({
          data: mocks.statsData,
          isLoading: mocks.statsLoading,
          isError: mocks.statsError,
          refetch: mocks.refetch,
        }),
      },
    },
  },
}));

function emptyStats(): DashboardStats {
  return {
    profile: {
      version: null,
      analyzed: false,
      matchScore: null,
      matchScoreDelta: null,
      directionCount: 0,
      topDirection: null,
      updatedAt: null,
    },
    roadmap: { exists: false, completed: 0, total: 0, progress: null, stageCount: 0, targetDirection: null },
    resume: {
      fileCount: 0,
      versionCount: 0,
      latestFileName: null,
      latestAt: null,
      lastActivityId: null,
      lastActivityFileName: null,
      lastActivityVersionCount: 0,
    },
    weekTasks: { completed: 0, delta: null },
    agents: {
      profile: { status: "idle", lastRunAt: null, lastMessage: null, progressCount: 0 },
      roadmap: { status: "idle", lastRunAt: null, lastMessage: null, progressCount: 0 },
      resume: { status: "idle", lastRunAt: null, lastMessage: null, progressCount: 0 },
    },
  };
}

function contentStats(): DashboardStats {
  const now = Date.now();
  return {
    profile: {
      version: 2,
      analyzed: true,
      matchScore: 88,
      matchScoreDelta: 16,
      directionCount: 2,
      topDirection: "数据产品",
      updatedAt: new Date(now).toISOString(),
    },
    roadmap: {
      exists: true,
      completed: 6,
      total: 14,
      progress: 43,
      stageCount: 3,
      targetDirection: "数据产品",
    },
    resume: {
      fileCount: 2,
      versionCount: 3,
      latestFileName: "简历.docx",
      latestAt: new Date(now).toISOString(),
      lastActivityId: "resume-r1",
      lastActivityFileName: "简历.docx",
      lastActivityVersionCount: 3,
    },
    weekTasks: { completed: 3, delta: 1 },
    agents: {
      profile: {
        status: "succeeded",
        lastRunAt: new Date(now - 60 * 60 * 1000).toISOString(),
        lastMessage: "分析完成",
        progressCount: 5,
      },
      roadmap: { status: "idle", lastRunAt: null, lastMessage: null, progressCount: 0 },
      resume: {
        status: "running",
        lastRunAt: new Date(now).toISOString(),
        lastMessage: "正在分析…",
        progressCount: 3,
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.meData = { id: "u1", name: "甲", avatarColor: null };
  mocks.meLoading = false;
  mocks.meError = false;
  mocks.statsData = null;
  mocks.statsLoading = false;
  mocks.statsError = false;
});

describe("DashboardView", () => {
  it("加载态:骨架屏(与内容布局同尺寸),不渲染问候文案", () => {
    mocks.statsLoading = true;
    const { container } = render(<DashboardView />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText(/你好/)).toBeNull();
    expect(screen.queryByText("匹配度")).toBeNull();
  });

  it("错误态:友好错误卡 + 重试触发 refetch", async () => {
    mocks.statsError = true;
    render(<DashboardView />);
    expect(screen.getByRole("alert")).toHaveTextContent("暂时无法加载工作台数据");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("空态(新用户):引导空态 + 主 CTA「开始职业探索」→ /profile,不渲染 KPI 与推荐下一步", () => {
    mocks.statsData = emptyStats();
    render(<DashboardView />);
    expect(screen.getByText(/你好,甲/)).toBeInTheDocument();
    expect(screen.getByText("从职业画像开始你的探索")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "开始职业探索" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByText("匹配度")).toBeNull();
    expect(screen.queryByText("简历版本数")).toBeNull();
    expect(screen.queryByText(/推荐下一步/)).toBeNull(); // 空态走引导卡,不重复给下一步
  });

  it("内容态:问候一句话 + KPI 大数字与增量徽章(较上次/较上周)", () => {
    mocks.statsData = contentStats();
    render(<DashboardView />);
    expect(screen.getByText(/你好,甲/)).toBeInTheDocument();
    expect(screen.getByText("本周完成 3 个任务,路线图进度 43%")).toBeInTheDocument();
    // KPI 眉标与数值
    expect(screen.getByText("匹配度")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("路线图进度")).toBeInTheDocument();
    expect(screen.getByText("43%")).toBeInTheDocument();
    expect(screen.getByText("简历版本数")).toBeInTheDocument();
    expect(screen.getAllByText("3")).toHaveLength(2); // 简历版本数 = 3 且 本周任务 = 3
    expect(screen.getByText("本周任务")).toBeInTheDocument();
    // 增量徽章
    expect(screen.getByText("较上次 +16%")).toBeInTheDocument();
    expect(screen.getByText("较上周 +1")).toBeInTheDocument();
  });

  it("无基线:匹配度/本周任务均无徽章(较上次/较上周不渲染)", () => {
    mocks.statsData = {
      ...contentStats(),
      profile: { ...contentStats().profile, matchScore: null, matchScoreDelta: null },
      weekTasks: { completed: 0, delta: null },
    };
    render(<DashboardView />);
    expect(screen.queryByText(/较上次/)).toBeNull();
    expect(screen.queryByText(/较上周/)).toBeNull();
    expect(screen.getByText("—")).toBeInTheDocument(); // 匹配度无数据占位
  });

  it("Agent 顾问区:已完成/待命/分析中三态 badge + 运行中进度条(60%)与文案", () => {
    mocks.statsData = contentStats();
    render(<DashboardView />);
    expect(screen.getByText("已完成")).toBeInTheDocument();
    expect(screen.getByText("待命")).toBeInTheDocument();
    expect(screen.getByText("分析中")).toBeInTheDocument();
    expect(screen.getByText("正在分析…")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "简历顾问分析进度" })).toHaveAttribute(
      "aria-valuenow",
      "60"
    );
    // 最近产出与上次分析时间
    expect(screen.getByText("画像 v2 · 2 个推荐方向")).toBeInTheDocument();
    expect(screen.getAllByText(/上次分析:/)).toHaveLength(2); // 画像(已完成)与简历(分析中)各一条
    // 三张卡均可点击进入模块
    expect(screen.getAllByRole("link", { name: /画像顾问/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /规划顾问/ })).toHaveAttribute("href", "/navigator");
    expect(screen.getByRole("link", { name: /简历顾问/ })).toHaveAttribute(
      "href",
      "/resume?resumeId=resume-r1"
    );
  });

  it("Agent 失败态:失败 badge + 进入模块重试引导", () => {
    mocks.statsData = {
      ...contentStats(),
      agents: {
        ...contentStats().agents,
        resume: { status: "failed", lastRunAt: null, lastMessage: null, progressCount: 0 },
      },
    };
    render(<DashboardView />);
    expect(screen.getByText("失败")).toBeInTheDocument();
    expect(screen.getByText("最近一次分析未完成,进入模块重试")).toBeInTheDocument();
  });

  it("模块入口区:分模块动词 CTA;无路线图 →「开始规划」+ 问候行引导文案", () => {
    mocks.statsData = {
      ...contentStats(),
      roadmap: { exists: false, completed: 0, total: 0, progress: null, stageCount: 0, targetDirection: null },
    };
    render(<DashboardView />);
    // 画像 继续查看 → /profile;简历 继续优化 → 最近工作简历深链(「继续上次」语义)
    expect(screen.getByRole("link", { name: "继续查看" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "继续优化" })).toHaveAttribute("href", "/resume?resumeId=resume-r1");
    expect(screen.getByRole("link", { name: "开始规划" })).toHaveAttribute("href", "/navigator");
    expect(screen.getByText("本周完成 3 个任务,生成路线图后开始打卡")).toBeInTheDocument();
    // 推荐下一步规则 3(无路线图)→ 生成成长路线
    expect(screen.getByText(/推荐下一步:生成成长路线/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "生成成长路线" })).toHaveAttribute("href", "/navigator");
  });

  it("模块卡真实状态文案:路线图阶段数/任务数 + 简历最近工作版本数", () => {
    mocks.statsData = contentStats();
    render(<DashboardView />);
    expect(screen.getByText("3 个阶段 · 6/14 任务完成")).toBeInTheDocument();
    expect(screen.getByText("最近:简历.docx · 3 个优化版本")).toBeInTheDocument();
  });

  it("无最近工作简历(无简历/无有效 run):简历入口回退模块首页 /resume", () => {
    mocks.statsData = {
      ...contentStats(),
      resume: { ...contentStats().resume, lastActivityId: null, lastActivityFileName: null },
    };
    render(<DashboardView />);
    expect(screen.getByRole("link", { name: /简历顾问/ })).toHaveAttribute("href", "/resume");
    // 画像 / 路线图不受影响,简历入口回退 /resume(服务端未传参时取最新行)
    expect(screen.getByRole("link", { name: "继续查看" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "继续学习" })).toHaveAttribute("href", "/navigator");
    expect(screen.getByRole("link", { name: "继续优化" })).toHaveAttribute("href", "/resume");
  });

  it("表单已填未分析:完整工作台 + 画像模块「开始分析」", () => {
    mocks.statsData = {
      ...contentStats(),
      profile: { ...contentStats().profile, analyzed: false, matchScore: null, matchScoreDelta: null, directionCount: 0 },
    };
    render(<DashboardView />);
    expect(screen.getByText("匹配度")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "开始分析" })).toHaveAttribute("href", "/profile");
  });

  it("画像过期(8 天前):问候行显示建议更新提示与入口", () => {
    mocks.statsData = {
      ...contentStats(),
      profile: { ...contentStats().profile, updatedAt: new Date(Date.now() - 8 * DAY_MS).toISOString() },
    };
    render(<DashboardView />);
    expect(screen.getByText(/建议更新以获得更准确的建议/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "更新画像" })).toHaveAttribute("href", "/profile");
  });
});

describe("推荐下一步(规则链,基于真实状态)", () => {
  it("规则 1:画像未分析 → 去完成画像 → /profile", () => {
    mocks.statsData = {
      ...contentStats(),
      profile: { ...contentStats().profile, analyzed: false, matchScore: null, matchScoreDelta: null, directionCount: 0 },
    };
    render(<DashboardView />);
    expect(screen.getByText(/推荐下一步:完成职业画像/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去完成画像" })).toHaveAttribute("href", "/profile");
  });

  it("规则 2:画像已分析但无推荐方向 → 完善目标岗位 → /profile", () => {
    mocks.statsData = {
      ...contentStats(),
      profile: {
        ...contentStats().profile,
        directionCount: 0,
        topDirection: null,
        matchScore: null,
        matchScoreDelta: null,
      },
    };
    render(<DashboardView />);
    expect(screen.getByText(/推荐下一步:补充目标岗位信息/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "完善目标岗位" })).toHaveAttribute("href", "/profile");
  });

  it("规则 3:空路线图(0 任务)并入「生成成长路线」→ /navigator", () => {
    mocks.statsData = {
      ...contentStats(),
      roadmap: { ...contentStats().roadmap, total: 0, completed: 0, progress: 0 },
    };
    render(<DashboardView />);
    expect(screen.getByText(/推荐下一步:生成成长路线/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "生成成长路线" })).toHaveAttribute("href", "/navigator");
  });

  it("规则 4a:无简历且从未优化 → 上传简历 → /resume?upload=1(与模块卡同向)", () => {
    mocks.statsData = {
      ...contentStats(),
      resume: {
        ...contentStats().resume,
        fileCount: 0,
        versionCount: 0,
        latestFileName: null,
        latestAt: null,
        lastActivityId: null,
        lastActivityFileName: null,
        lastActivityVersionCount: 0,
      },
    };
    render(<DashboardView />);
    expect(screen.getByText(/推荐下一步:上传或粘贴简历/)).toBeInTheDocument();
    const uploadLinks = screen.getAllByRole("link", { name: "上传简历" }); // 下一步 CTA + 模块卡
    expect(uploadLinks).toHaveLength(2);
    uploadLinks.forEach((l) => expect(l).toHaveAttribute("href", "/resume?upload=1"));
  });

  it("规则 4b:有简历但从未优化 → 优化目标简历 → 最近工作简历深链", () => {
    mocks.statsData = {
      ...contentStats(),
      resume: { ...contentStats().resume, versionCount: 0, lastActivityVersionCount: 0 },
    };
    render(<DashboardView />);
    expect(screen.getByText(/推荐下一步:开始优化简历/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "优化目标简历" })).toHaveAttribute(
      "href",
      "/resume?resumeId=resume-r1"
    );
  });

  it("规则 5:路线图任务未完成 → 继续成长路线 → /navigator", () => {
    mocks.statsData = contentStats(); // 6/14 未完成,简历已优化(3 版本)
    render(<DashboardView />);
    expect(screen.getByText(/推荐下一步:继续推进成长路线/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "继续成长路线" })).toHaveAttribute("href", "/navigator");
  });

  it("规则 6:全部完成 → 中性文案,无 CTA(不造假)", () => {
    mocks.statsData = {
      ...contentStats(),
      roadmap: { ...contentStats().roadmap, completed: 14 },
    };
    render(<DashboardView />);
    expect(screen.getByText("路线图任务已全部完成,保持节奏")).toBeInTheDocument();
    expect(screen.queryByText(/推荐下一步/)).toBeNull();
    expect(screen.queryByRole("link", { name: "继续成长路线" })).toBeNull();
  });
});
