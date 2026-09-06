// AI 洞察卡测试(工作台 IA 重构 + 「发现 → 行动」升级):五态(未分析引导/加载骨架/错误重试/
// 降级/内容)、优势 top-3、需要关注 top-2(AI 原文逐字、不带方向来源前缀;旧「当前短板」与
// 「重点关注」合并,摘要结语句不再展示、gap 兜底已删)、底部行动区三态(X>0 主按钮深链 /
// X=0「建议已处理」完成态 / X=null 不渲染主按钮)、不渲染建议 action(职责让位「下一步建议」
// /成长路线)、AI 原始文本逐字呈现(无命令式措辞;CTA「去处理 X 条建议」为设计固定文案)。
// 数据源 profile.get 的 aiAnalysis 在客户端经 profileAnalysisSchema.safeParse 校验(先例
// profile-result.tsx);X 与深链目标走 props(stats.resume.pendingCount / lastActivityId)。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
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

// 渲染辅助:默认未分析 + 无简历数据(X=null),逐用例覆盖
const renderCard = (props: Partial<ComponentProps<typeof AiInsightCard>> = {}) =>
  render(<AiInsightCard analyzed={false} pendingCount={null} lastActivityId={null} {...props} />);

// 合法画像分析:4 优势(验证 top-3 截断)+ 2 方向(短板两条)+ 多句 summary(验证结语句不展示)+ 3 建议
const validAnalysis = {
  summary: "计算机专业应届生,技术基础扎实。整体呈现从技术向产品方向转型的潜力,需补充产品方法论。",
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
  it("未分析:卡内引导 +「去完成画像」→ /profile;无摘要条目、无行动区(不造假)", () => {
    renderCard();
    expect(screen.getByText("AI 洞察")).toBeInTheDocument();
    expect(screen.getByText("来自你最近一次画像分析")).toBeInTheDocument();
    expect(
      screen.getByText("完成画像分析后,这里会展示你的岗位优势与需要关注")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去完成画像" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByText("岗位优势")).toBeNull();
    expect(screen.queryByText("需要关注")).toBeNull();
    expect(screen.queryByText("当前短板")).toBeNull();
    expect(screen.queryByText("重点关注")).toBeNull();
    expect(screen.queryByRole("link", { name: "查看职业画像" })).toBeNull();
    expect(screen.queryByRole("link", { name: /去处理/ })).toBeNull();
    expect(screen.queryByText("建议已处理")).toBeNull();
  });

  it("已分析 + 加载中:骨架行 + 头部标题", () => {
    mocks.profileLoading = true;
    const { container } = renderCard({ analyzed: true });
    expect(screen.getByText("AI 洞察")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText("岗位优势")).toBeNull();
  });

  it("已分析 + 加载失败:错误文案 + 重试触发 refetch", async () => {
    mocks.profileError = true;
    renderCard({ analyzed: true });
    expect(screen.getByRole("alert")).toHaveTextContent("分析数据加载失败");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("已分析 + 数据为 null:降级引导「去画像页」→ /profile,不崩溃", () => {
    mocks.profileData = null;
    renderCard({ analyzed: true });
    expect(screen.getByText("分析数据暂不可用")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去画像页" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: "查看职业画像" })).toBeNull();
    expect(screen.queryByRole("link", { name: /去处理/ })).toBeNull();
  });

  it("已分析 + 脏 aiAnalysis:同降级分支(safeParse 失败,不崩溃不渲染条目)", () => {
    mocks.profileData = { aiAnalysis: { summary: "x" } };
    renderCard({ analyzed: true });
    expect(screen.getByText("分析数据暂不可用")).toBeInTheDocument();
    expect(screen.queryByText("岗位优势")).toBeNull();
  });

  it("内容态:优势 top-3 + 需要关注 top-2(无来源前缀,合并旧短板与重点关注)+ 主按钮深链 + ghost;无建议 action", () => {
    mocks.profileData = { aiAnalysis: validAnalysis };
    renderCard({ analyzed: true, pendingCount: 2, lastActivityId: "resume-r1" });
    // 两行眉标(旧「当前短板」「重点关注」已合并为「需要关注」)
    expect(screen.getByText("岗位优势")).toBeInTheDocument();
    expect(screen.getByText("需要关注")).toBeInTheDocument();
    expect(screen.queryByText("当前短板")).toBeNull();
    expect(screen.queryByText("重点关注")).toBeNull();
    expect(screen.queryByText("推荐行动")).toBeNull();
    // 优势 top-3:第 4 条「学习能力强」被截断
    expect(screen.getByText("实践经历对口")).toBeInTheDocument();
    expect(screen.getByText("目标清晰")).toBeInTheDocument();
    expect(screen.getByText("技能组合完整")).toBeInTheDocument();
    expect(screen.queryByText("学习能力强")).toBeNull();
    // 需要关注 top-2:AI 原文逐字,不带方向来源前缀(一行短句压缩)
    expect(screen.getByText("缺少分布式经验")).toBeInTheDocument();
    expect(screen.getByText("不熟悉可视化工具")).toBeInTheDocument();
    expect(screen.queryByText("后端开发:")).toBeNull();
    expect(screen.queryByText("数据分析:")).toBeNull();
    // 摘要结语句不再展示(gap 兜底已删;「缺少分布式经验」仅需要关注一处)
    expect(
      screen.queryByText("整体呈现从技术向产品方向转型的潜力,需补充产品方法论。")
    ).toBeNull();
    expect(screen.getAllByText("缺少分布式经验")).toHaveLength(1);
    // 建议 action 一律不渲染(不承担成长路线职责)
    expect(screen.queryByText("完成一个分布式项目")).toBeNull();
    expect(screen.queryByText("参与一次项目汇报")).toBeNull();
    expect(screen.queryByText("阅读行业报告")).toBeNull();
    // AI 内容标记与底部行动区
    expect(screen.getByText("AI 分析")).toBeInTheDocument(); // AiBadge 默认文案
    const primary = screen.getByRole("link", { name: "去处理 2 条建议" });
    expect(primary).toHaveAttribute("href", "/resume?resumeId=resume-r1");
    expect(primary.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("link", { name: "查看职业画像" })).toHaveAttribute(
      "href",
      "/profile#glance"
    );
  });

  it("内容态 + X=0:完成态「建议已处理」,无主按钮,ghost 仍在", () => {
    mocks.profileData = { aiAnalysis: validAnalysis };
    renderCard({ analyzed: true, pendingCount: 0, lastActivityId: "resume-r1" });
    expect(screen.getByText("建议已处理")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /去处理/ })).toBeNull();
    expect(screen.getByRole("link", { name: "查看职业画像" })).toBeInTheDocument();
  });

  it("内容态 + X=null(无简历/无版本):不渲染主按钮与完成态,仅 ghost", () => {
    mocks.profileData = { aiAnalysis: validAnalysis };
    renderCard({ analyzed: true, pendingCount: null, lastActivityId: null });
    expect(screen.queryByRole("link", { name: /去处理/ })).toBeNull();
    expect(screen.queryByText("建议已处理")).toBeNull();
    expect(screen.getByRole("link", { name: "查看职业画像" })).toBeInTheDocument();
  });

  it("内容态 + lastActivityId=null:主按钮回退 /resume(纯防御)", () => {
    mocks.profileData = { aiAnalysis: validAnalysis };
    renderCard({ analyzed: true, pendingCount: 2, lastActivityId: null });
    expect(screen.getByRole("link", { name: "去处理 2 条建议" })).toHaveAttribute(
      "href",
      "/resume"
    );
  });

  it("摘要无有效句(全标点):不再 gap 兜底,「缺少分布式经验」仅需要关注一处", () => {
    mocks.profileData = {
      aiAnalysis: { ...validAnalysis, summary: "。" },
    };
    renderCard({ analyzed: true, pendingCount: 2, lastActivityId: "resume-r1" });
    expect(screen.getAllByText("缺少分布式经验")).toHaveLength(1);
  });

  it("全部方向无短板:需要关注行整体不渲染,其余行与行动区完好", () => {
    mocks.profileData = {
      aiAnalysis: {
        ...validAnalysis,
        directions: validAnalysis.directions.map((d) => ({ ...d, weaknesses: [] })),
      },
    };
    renderCard({ analyzed: true, pendingCount: 2, lastActivityId: "resume-r1" });
    expect(screen.queryByText("需要关注")).toBeNull();
    expect(screen.getByText("岗位优势")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看职业画像" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去处理 2 条建议" })).toBeInTheDocument();
  });

  it("分析导向纪律:AI 原始文本逐字呈现,卡片不添加命令式措辞、不渲染行动", () => {
    mocks.profileData = { aiAnalysis: validAnalysis };
    renderCard({ analyzed: true, pendingCount: 2, lastActivityId: "resume-r1" });
    expect(screen.queryByText(/建议你/)).toBeNull();
    expect(screen.queryByText(/快去/)).toBeNull();
    // 建议只呈现 gap 一行,action 文本不出现;CTA「去处理 X 条建议」为设计固定文案,非 AI 输出
    expect(screen.queryByText("完成一个分布式项目")).toBeNull();
  });
});
