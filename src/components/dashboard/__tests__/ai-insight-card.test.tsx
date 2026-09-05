// AI 洞察卡测试(工作台 IA 重构 + 摘要化):五态(未分析引导/加载骨架/错误重试/降级/内容)、
// 优势 top-3、短板 top-2 且与重点关注同文去重、重点关注 = 首个建议 gap 一行、
// 不渲染建议 action(职责让位「下一步建议」/成长路线)、AI 原始文本逐字呈现(无命令式措辞)。
// 数据源 profile.get 的 aiAnalysis 在客户端经 profileAnalysisSchema.safeParse 校验(先例 profile-result.tsx)。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AiInsightCard } from "../ai-insight-card";

const mocks = vi.hoisted(() => ({
  profileData: null as unknown,
  profileLoading: false,
  profileError: false,
  refetch: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
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
  },
}));

// 合法画像分析:4 优势(验证 top-3 截断)+ 2 方向(短板含与首个建议 gap 同文项,验证去重)+ 3 建议
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
      weaknesses: ["不熟悉可视化工具"],
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.profileData = null;
  mocks.profileLoading = false;
  mocks.profileError = false;
});

describe("AiInsightCard", () => {
  it("未分析:卡内引导 +「去完成画像」→ /profile;无摘要条目、无查看完整分析(不造假)", () => {
    render(<AiInsightCard analyzed={false} />);
    expect(screen.getByText("AI 洞察")).toBeInTheDocument();
    expect(screen.getByText("来自你最近一次画像分析")).toBeInTheDocument();
    expect(
      screen.getByText("完成画像分析后,这里会展示你的岗位优势、当前短板与重点关注")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去完成画像" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByText("岗位优势")).toBeNull();
    expect(screen.queryByText("当前短板")).toBeNull();
    expect(screen.queryByText("重点关注")).toBeNull();
    expect(screen.queryByRole("link", { name: "查看完整分析" })).toBeNull();
  });

  it("已分析 + 加载中:骨架行 + 头部标题", () => {
    mocks.profileLoading = true;
    const { container } = render(<AiInsightCard analyzed />);
    expect(screen.getByText("AI 洞察")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText("岗位优势")).toBeNull();
  });

  it("已分析 + 加载失败:错误文案 + 重试触发 refetch", async () => {
    mocks.profileError = true;
    render(<AiInsightCard analyzed />);
    expect(screen.getByRole("alert")).toHaveTextContent("分析数据加载失败");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("已分析 + 数据为 null:降级引导「去画像页」→ /profile,不崩溃", () => {
    mocks.profileData = null;
    render(<AiInsightCard analyzed />);
    expect(screen.getByText("分析数据暂不可用")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去画像页" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: "查看完整分析" })).toBeNull();
  });

  it("已分析 + 脏 aiAnalysis:同降级分支(safeParse 失败,不崩溃不渲染条目)", () => {
    mocks.profileData = { aiAnalysis: { summary: "x" } };
    render(<AiInsightCard analyzed />);
    expect(screen.getByText("分析数据暂不可用")).toBeInTheDocument();
    expect(screen.queryByText("岗位优势")).toBeNull();
  });

  it("内容态:优势 top-3 + 短板 top-2 去重 + 重点关注一行 + AiBadge + 查看完整分析深链;无建议 action", () => {
    mocks.profileData = { aiAnalysis: validAnalysis };
    render(<AiInsightCard analyzed />);
    // 三行眉标(推荐行动已删)
    expect(screen.getByText("岗位优势")).toBeInTheDocument();
    expect(screen.getByText("当前短板")).toBeInTheDocument();
    expect(screen.getByText("重点关注")).toBeInTheDocument();
    expect(screen.queryByText("推荐行动")).toBeNull();
    // 优势 top-3:第 4 条「学习能力强」被截断
    expect(screen.getByText("实践经历对口")).toBeInTheDocument();
    expect(screen.getByText("目标清晰")).toBeInTheDocument();
    expect(screen.getByText("技能组合完整")).toBeInTheDocument();
    expect(screen.queryByText("学习能力强")).toBeNull();
    // 短板 top-2:「后端开发:缺少分布式经验」与重点关注同文被去重,只剩「数据分析」一条
    expect(screen.queryByText("后端开发:")).toBeNull();
    expect(screen.getByText("数据分析:")).toBeInTheDocument();
    expect(screen.getByText("不熟悉可视化工具")).toBeInTheDocument();
    // 重点关注 = 首个建议 gap 一行(同文仅此一处,短板不再重复)
    expect(screen.getAllByText("缺少分布式经验")).toHaveLength(1);
    // 建议 action 一律不渲染(不承担成长路线职责)
    expect(screen.queryByText("完成一个分布式项目")).toBeNull();
    expect(screen.queryByText("参与一次项目汇报")).toBeNull();
    expect(screen.queryByText("阅读行业报告")).toBeNull();
    // AI 内容标记与底部深链
    expect(screen.getByText("AI 分析")).toBeInTheDocument(); // AiBadge 默认文案
    expect(screen.getByRole("link", { name: "查看完整分析" })).toHaveAttribute("href", "/profile#glance");
  });

  it("短板与重点关注不同文:两者并存,短板保留来源前缀", () => {
    mocks.profileData = {
      aiAnalysis: {
        ...validAnalysis,
        suggestions: [{ gap: "沟通表达", action: "参与一次项目汇报" }],
      },
    };
    render(<AiInsightCard analyzed />);
    // 无同文去重 → 两条短板均显示
    expect(screen.getByText("后端开发:")).toBeInTheDocument();
    expect(screen.getByText("数据分析:")).toBeInTheDocument();
    expect(screen.getByText("缺少分布式经验")).toBeInTheDocument();
    // 重点关注 = 「沟通表达」
    expect(screen.getByText("沟通表达")).toBeInTheDocument();
  });

  it("全部方向无短板:当前短板行整体不渲染,其余行完好", () => {
    mocks.profileData = {
      aiAnalysis: {
        ...validAnalysis,
        directions: validAnalysis.directions.map((d) => ({ ...d, weaknesses: [] })),
      },
    };
    render(<AiInsightCard analyzed />);
    expect(screen.queryByText("当前短板")).toBeNull();
    expect(screen.getByText("岗位优势")).toBeInTheDocument();
    expect(screen.getByText("重点关注")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看完整分析" })).toBeInTheDocument();
  });

  it("分析导向纪律:AI 原始文本逐字呈现,卡片不添加命令式措辞、不渲染行动", () => {
    mocks.profileData = { aiAnalysis: validAnalysis };
    render(<AiInsightCard analyzed />);
    expect(screen.queryByText(/建议你/)).toBeNull();
    expect(screen.queryByText(/快去/)).toBeNull();
    // 摘要只呈现 gap 一行,action 文本不出现
    expect(screen.queryByText("完成一个分布式项目")).toBeNull();
  });
});
