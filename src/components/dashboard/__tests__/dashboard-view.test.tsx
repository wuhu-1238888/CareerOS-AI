// 工作台测试(5.1 + IA 重构):四态(加载骨架/空态引导/错误重试/内容)、KPI 增量徽章、
// AI 洞察卡(最近一次画像分析摘要;未分析 → 卡内引导)、「下一步建议」行动卡与规则链、
// 画像过期提示、无基线时不渲染徽章。IA 重构后已删:Agent 顾问区与「我的工作」模块入口区套件
// (组件已删,工作台不再渲染顾问卡/模块卡)。
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
  profileData: null as unknown,
  profileLoading: false,
  profileError: false,
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
    // AI 洞察卡数据源(画像页同款查询,aiAnalysis 原样返回)
    profile: {
      get: {
        useQuery: () => ({
          data: mocks.profileData,
          isLoading: mocks.profileLoading,
          isError: mocks.profileError,
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

// 合法画像分析(形状同 profile-hub.test.tsx validAnalysis;4 优势 + 3 建议供 top-3 截断断言,
// 截断细节在 ai-insight-card.test.tsx;此处仅需合法数据让 AI 洞察卡进入内容态)
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
    { title: "学习能力强", detail: "自学完成多个课外项目" },
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
  suggestions: [
    { gap: "缺少分布式经验", action: "完成一个分布式项目" },
    { gap: "沟通表达", action: "参与一次项目汇报" },
    { gap: "行业认知", action: "阅读行业报告" },
  ],
  confidence: { level: "高", note: "信息齐全" },
};

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
  mocks.profileData = null;
  mocks.profileLoading = false;
  mocks.profileError = false;
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

  it("内容态:问候一句话 + 3 KPI + AI 洞察摘要 + 成长趋势;不再渲染本周任务与我的工作", () => {
    mocks.statsData = contentStats();
    mocks.profileData = { aiAnalysis: validAnalysis };
    render(<DashboardView />);
    expect(screen.getByText(/你好,甲/)).toBeInTheDocument();
    expect(screen.getByText("本周完成 3 个任务,路线图进度 43%")).toBeInTheDocument();
    // KPI 眉标与数值(3 卡)
    expect(screen.getByText("岗位匹配度")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("路线图进度")).toBeInTheDocument();
    expect(screen.getByText("43%")).toBeInTheDocument();
    expect(screen.getByText("待处理建议")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument(); // 待处理建议 = 2(最近版本 2 条 pending)
    expect(screen.queryByText("本周任务")).toBeNull();
    expect(screen.queryByText("较上周")).toBeNull();
    // 增量徽章(仅岗位匹配度有基线)
    expect(screen.getByText("较上次 +16%")).toBeInTheDocument();
    // AI 洞察卡(最近一次画像分析摘要)
    expect(screen.getByText("AI 洞察")).toBeInTheDocument();
    expect(screen.getByText("来自你最近一次画像分析")).toBeInTheDocument();
    expect(screen.getByText("岗位优势")).toBeInTheDocument();
    expect(screen.getByText("当前短板")).toBeInTheDocument();
    expect(screen.getByText("推荐行动")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看完整分析" })).toHaveAttribute("href", "/profile#glance");
    // 「我的工作」区已随 IA 重构删除
    expect(screen.queryByText("我的工作")).toBeNull();
    expect(screen.queryByText("你上次做到哪里")).toBeNull();
    // 「下一步建议」行动卡(规则 5:路线图 6/14 未完成)
    expect(screen.getByText("下一步建议")).toBeInTheDocument();
    expect(screen.getByText("继续推进成长路线")).toBeInTheDocument();
    const nextStepCta = screen.getByRole("link", { name: "继续成长路线" });
    expect(nextStepCta).toHaveAttribute("href", "/navigator?focus=current");
    expect(nextStepCta.querySelector("svg")).not.toBeNull(); // P1:行动卡 CTA 尾部箭头(aria-hidden)
  });

  it("AI 洞察未分析:卡内引导「去完成画像」,无摘要条目、无查看完整分析(不造假)", () => {
    mocks.statsData = {
      ...contentStats(),
      profile: { ...contentStats().profile, analyzed: false, matchScore: null, matchScoreDelta: null, directionCount: 0 },
    };
    render(<DashboardView />);
    expect(screen.getByText("AI 洞察")).toBeInTheDocument();
    expect(
      screen.getByText("完成画像分析后,这里会展示你的岗位优势、当前短板与推荐行动")
    ).toBeInTheDocument();
    expect(screen.queryByText("岗位优势")).toBeNull();
    expect(screen.queryByRole("link", { name: "查看完整分析" })).toBeNull();
    // 「去完成画像」链接:下一步建议卡 CTA(DOM 首个)+ AI 洞察引导 + 成长区块空态引导,均指 /profile
    expect(screen.getAllByRole("link", { name: "去完成画像" })[0]).toHaveAttribute("href", "/profile");
  });

  it("无基线:岗位匹配度无徽章(较上次不渲染)", () => {
    mocks.statsData = {
      ...contentStats(),
      profile: { ...contentStats().profile, matchScore: null, matchScoreDelta: null },
    };
    render(<DashboardView />);
    expect(screen.queryByText(/较上次/)).toBeNull();
    expect(screen.getByText("—")).toBeInTheDocument(); // 岗位匹配度无数据占位
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
    // 「去完成画像」共 3 处:下一步建议卡 CTA(DOM 中先于 AI 洞察与成长区块)、AI 洞察引导、成长区块空态引导;
    // 本条断言下一步建议卡 CTA
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

  it("规则 4a:无简历且从未优化 → 上传简历 → /resume?upload=1", () => {
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
    expect(screen.getByText("上传或粘贴简历,开始针对性优化")).toBeInTheDocument();
    // 仅行动卡一处(模块卡已随 IA 重构删除)
    expect(screen.getAllByRole("link", { name: "上传简历" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "上传简历" })).toHaveAttribute("href", "/resume?upload=1");
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
