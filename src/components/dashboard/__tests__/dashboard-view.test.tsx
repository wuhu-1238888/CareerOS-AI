// 工作台测试(5.1):四态(加载骨架/空态引导/错误重试/内容)、KPI 增量徽章、Agent 卡状态与进度条、
// 两排语义(AI 洞察/我的工作)与顾问卡行动提示、「下一步建议」行动卡与规则链、
// 模块卡双链接(卡片主体 = 查看模块总览 ≠ CTA 深链定位)、画像过期提示、无基线时不渲染徽章
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
    // 8.2:成长区块在工作台内容态渲染;测试聚焦工作台语义,区块数据固定为空(引导分支,无副作用)
    growth: {
      block: {
        useQuery: () => ({
          data: {
            profileVersionCount: 0,
            profileVersion: null,
            latestMatchScore: null,
            matchUpdatedAt: null,
            sparkline: [],
          },
          isLoading: false,
          isError: false,
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
      pendingCount: null,
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
      pendingCount: 2,
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
    expect(screen.queryByText("岗位匹配度")).toBeNull();
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
    expect(screen.queryByText("岗位匹配度")).toBeNull();
    expect(screen.queryByText("待处理建议")).toBeNull();
    expect(screen.queryByText("下一步建议")).toBeNull(); // 空态走引导卡,不重复给下一步
  });

  it("内容态:问候一句话 + KPI 大数字与增量徽章(较上次/较上周)", () => {
    mocks.statsData = contentStats();
    render(<DashboardView />);
    expect(screen.getByText(/你好,甲/)).toBeInTheDocument();
    expect(screen.getByText("本周完成 3 个任务,路线图进度 43%")).toBeInTheDocument();
    // KPI 眉标与数值
    expect(screen.getByText("岗位匹配度")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("路线图进度")).toBeInTheDocument();
    expect(screen.getByText("43%")).toBeInTheDocument();
    expect(screen.getByText("待处理建议")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // 待处理建议 = 2(最近版本 2 条 pending)
    expect(screen.getByText("本周任务")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // 本周任务 = 3(简历版本数已由待处理建议替换)
    // 增量徽章
    expect(screen.getByText("较上次 +16%")).toBeInTheDocument();
    expect(screen.getByText("较上周 +1")).toBeInTheDocument();
    // 两排语义区块标题
    expect(screen.getByText("AI 洞察")).toBeInTheDocument();
    expect(screen.getByText("AI 最近帮你发现了什么")).toBeInTheDocument();
    expect(screen.getByText("我的工作")).toBeInTheDocument();
    expect(screen.getByText("你上次做到哪里")).toBeInTheDocument();
    // 「下一步建议」行动卡(规则 5:路线图 6/14 未完成)
    expect(screen.getByText("下一步建议")).toBeInTheDocument();
    expect(screen.getByText("继续推进成长路线")).toBeInTheDocument();
    const nextStepCta = screen.getByRole("link", { name: "继续成长路线" });
    expect(nextStepCta).toHaveAttribute("href", "/navigator?focus=current");
    expect(nextStepCta.querySelector("svg")).not.toBeNull(); // P1:行动卡 CTA 尾部箭头(aria-hidden)
  });

  it("无基线:岗位匹配度/本周任务均无徽章(较上次/较上周不渲染)", () => {
    mocks.statsData = {
      ...contentStats(),
      profile: { ...contentStats().profile, matchScore: null, matchScoreDelta: null },
      weekTasks: { completed: 0, delta: null },
    };
    render(<DashboardView />);
    expect(screen.queryByText(/较上次/)).toBeNull();
    expect(screen.queryByText(/较上周/)).toBeNull();
    expect(screen.getByText("—")).toBeInTheDocument(); // 岗位匹配度无数据占位
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
    // 三张卡均可点击进入模块;画像顾问深链最近分析核心结论(工作台导航优化 P0)
    expect(screen.getAllByRole("link", { name: /画像顾问/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /画像顾问/ })).toHaveAttribute("href", "/profile#glance");
    expect(screen.getByRole("link", { name: /规划顾问/ })).toHaveAttribute("href", "/navigator");
    expect(screen.getByRole("link", { name: /简历顾问/ })).toHaveAttribute(
      "href",
      "/resume?resumeId=resume-r1"
    );
    // 底部行动提示行(AI 洞察语义)
    expect(screen.getByText(/查看画像分析/)).toBeInTheDocument();
    expect(screen.getByText(/查看成长规划/)).toBeInTheDocument();
    expect(screen.getByText(/查看优化建议/)).toBeInTheDocument();
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

  it("模块入口区:卡片主体(查看模块)≠ CTA(继续工作);无路线图 →「开始规划」", () => {
    mocks.statsData = {
      ...contentStats(),
      roadmap: { exists: false, completed: 0, total: 0, progress: null, stageCount: 0, targetDirection: null },
    };
    render(<DashboardView />);
    // 卡片主体 = 查看模块总览;CTA = 继续当前工作(深链定位),两条链接目标不同
    expect(screen.getByRole("link", { name: "查看职业画像" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "继续查看" })).toHaveAttribute("href", "/profile#glance");
    expect(screen.getByRole("link", { name: "查看成长路线" })).toHaveAttribute("href", "/navigator");
    expect(screen.getByRole("link", { name: "开始规划" })).toHaveAttribute("href", "/navigator");
    expect(screen.getByRole("link", { name: "查看简历优化" })).toHaveAttribute("href", "/resumes");
    expect(screen.getByRole("link", { name: "继续优化" })).toHaveAttribute("href", "/resume?resumeId=resume-r1");
    expect(screen.getByText("本周完成 3 个任务,生成路线图后开始打卡")).toBeInTheDocument();
    // 推荐下一步规则 3(无路线图)→ 生成成长路线(行动卡)
    expect(screen.getByText("下一步建议")).toBeInTheDocument();
    expect(screen.getByText("生成成长路线", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "生成成长路线" })).toHaveAttribute("href", "/navigator");
  });

  it("模块卡真实状态文案:路线图阶段数/任务数 + 简历最近工作版本数", () => {
    mocks.statsData = contentStats();
    render(<DashboardView />);
    expect(screen.getByText("3 个阶段 · 6/14 任务完成")).toBeInTheDocument();
    expect(screen.getByText("最近:简历.docx · 3 个优化版本")).toBeInTheDocument();
  });

  it("无最近工作简历(无有效 run):简历 CTA 回退 /resume;画像/路线图深链不受影响", () => {
    mocks.statsData = {
      ...contentStats(),
      resume: { ...contentStats().resume, lastActivityId: null, lastActivityFileName: null },
    };
    render(<DashboardView />);
    expect(screen.getByRole("link", { name: /简历顾问/ })).toHaveAttribute("href", "/resume");
    // 画像/路线图 CTA 深链最近结果;简历无最近工作记录 → 回退 /resume(服务端未传参时取最新行)
    expect(screen.getByRole("link", { name: "继续查看" })).toHaveAttribute("href", "/profile#glance");
    expect(screen.getByRole("link", { name: "继续学习" })).toHaveAttribute("href", "/navigator?focus=current");
    expect(screen.getByRole("link", { name: "继续优化" })).toHaveAttribute("href", "/resume");
  });

  it("表单已填未分析:完整工作台 + 画像模块「开始分析」", () => {
    mocks.statsData = {
      ...contentStats(),
      profile: { ...contentStats().profile, analyzed: false, matchScore: null, matchScoreDelta: null, directionCount: 0 },
    };
    render(<DashboardView />);
    expect(screen.getByText("岗位匹配度")).toBeInTheDocument();
    // 卡片主体与 CTA(空态同页:模块页即创建流程)
    expect(screen.getByRole("link", { name: "查看职业画像" })).toHaveAttribute("href", "/profile");
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

describe("下一步建议(规则链,基于真实状态)", () => {
  it("规则 1:画像未分析 → 完成职业画像 → /profile", () => {
    mocks.statsData = {
      ...contentStats(),
      profile: { ...contentStats().profile, analyzed: false, matchScore: null, matchScoreDelta: null, directionCount: 0 },
    };
    render(<DashboardView />);
    expect(screen.getByText("下一步建议")).toBeInTheDocument();
    expect(screen.getByText("完成职业画像", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("获得你的专属方向与建议")).toBeInTheDocument();
    // 8.2:成长区块空态引导也有「去完成画像」链接(均指 /profile);本条断言下一步建议卡 CTA(DOM 中先于成长区块)
    expect(screen.getAllByRole("link", { name: "去完成画像" })[0]).toHaveAttribute("href", "/profile");
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
    expect(screen.getByText("完善目标岗位", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("补充目标岗位信息,生成你的推荐方向")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "完善目标岗位" })).toHaveAttribute("href", "/profile");
  });

  it("规则 3:空路线图(0 任务)并入「生成成长路线」→ /navigator", () => {
    mocks.statsData = {
      ...contentStats(),
      roadmap: { ...contentStats().roadmap, total: 0, completed: 0, progress: 0 },
    };
    render(<DashboardView />);
    expect(screen.getByText("生成成长路线", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("把目标变成看得见的阶梯")).toBeInTheDocument();
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
    expect(screen.getByText("上传简历", { selector: "p" })).toBeInTheDocument();
    // 说明文案与模块卡空态进度同文(行动卡 + 模块卡各一处)
    expect(screen.getAllByText("上传或粘贴简历,开始针对性优化")).toHaveLength(2);
    const uploadLinks = screen.getAllByRole("link", { name: "上传简历" }); // 行动卡 CTA + 模块卡 CTA
    expect(uploadLinks).toHaveLength(2);
    uploadLinks.forEach((l) => expect(l).toHaveAttribute("href", "/resume?upload=1"));
  });

  it("规则 4b:有简历但从未优化 → 优化目标简历 → 最近工作简历深链", () => {
    mocks.statsData = {
      ...contentStats(),
      resume: { ...contentStats().resume, versionCount: 0, lastActivityVersionCount: 0 },
    };
    render(<DashboardView />);
    expect(screen.getByText("优化目标简历", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("开始优化简历,适配你的目标方向")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "优化目标简历" })).toHaveAttribute(
      "href",
      "/resume?resumeId=resume-r1"
    );
  });

  it("规则 5:路线图任务未完成 → 继续成长路线 → /navigator?focus=current", () => {
    mocks.statsData = contentStats(); // 6/14 未完成,简历已优化(3 版本)
    render(<DashboardView />);
    expect(screen.getByText("继续推进成长路线", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("完成当前阶段任务,逐步提升目标岗位匹配度")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "继续成长路线" })).toHaveAttribute(
      "href",
      "/navigator?focus=current"
    );
  });

  it("规则 6:全部完成 → 中性文案,无 CTA(不造假)", () => {
    mocks.statsData = {
      ...contentStats(),
      roadmap: { ...contentStats().roadmap, completed: 14 },
    };
    render(<DashboardView />);
    expect(screen.getByText("路线图任务已全部完成,保持节奏")).toBeInTheDocument();
    expect(screen.queryByText("下一步建议")).toBeNull();
    expect(screen.queryByRole("link", { name: "继续成长路线" })).toBeNull();
  });
});
