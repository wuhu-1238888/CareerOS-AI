// 画像结果视图测试(2.5):概要/优势展开/不足来源/雷达图例/方向卡/发展建议/版本切换/数据异常守卫/页面头动作
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileResult } from "../profile-result";
import type { ProfileAnalysis } from "@/lib/profile/analysis-schemas";

type VersionRow = { id: string; version: number; createdAt: string };

const mocks = vi.hoisted(() => ({
  versionsData: [] as VersionRow[],
  getVersionData: undefined as
    | {
        id: string;
        version: number;
        parentVersion: number | null;
        createdAt: string;
        updatedAt: string;
        data: unknown;
        aiAnalysis: unknown;
      }
    | undefined,
  getVersionEnabled: false,
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    profile: {
      listVersions: { useQuery: () => ({ data: mocks.versionsData, isLoading: false }) },
      getVersion: {
        useQuery: (_input: { id: string }, opts?: { enabled?: boolean }) => {
          mocks.getVersionEnabled = opts?.enabled ?? false;
          return { data: mocks.getVersionData, isLoading: false };
        },
      },
    },
  },
}));

const analysis: ProfileAnalysis = {
  summary: "计算机专业应届生,具备后端开发与数据处理的实践基础。",
  abilityTags: [
    { name: "Python", level: "熟练" },
    { name: "SQL", level: "熟练" },
    { name: "数据分析", level: "基础" },
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
      reason: "技术栈与实习项目经历均与后端岗位高度匹配",
      strengths: ["Python 熟练", "后端实习经历对口"],
      weaknesses: ["缺少高并发与分布式实战经验"],
    },
    {
      name: "数据分析",
      matchScore: 70,
      reason: "SQL 与数据处理基础可迁移至数据岗位",
      strengths: ["SQL 熟练"],
      weaknesses: ["缺少统计建模经验"],
    },
  ],
  radar: { 产品: 40, 技术: 80, 数据: 68, 沟通: 50, 项目: 66, 行业: 45 },
  suggestions: [
    {
      gap: "缺少高并发与分布式项目经验",
      action: "完成一个包含消息队列与缓存的工程实践项目",
    },
  ],
  confidence: { level: "高", note: "教育、技能、实习与目标信息齐全,结论可信度较高" },
};

const row = {
  id: "p1",
  version: 1,
  parentVersion: null,
  createdAt: "2026-08-01T10:00:00Z",
  updatedAt: "2026-08-01T10:00:00Z",
  data: {},
  aiAnalysis: analysis,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.versionsData = [];
  mocks.getVersionData = undefined;
  mocks.getVersionEnabled = false;
});

describe("ProfileResult", () => {
  it("概要卡:摘要、能力标签(含等级)、置信度与说明", () => {
    render(<ProfileResult initial={row} />);
    expect(screen.getByText(analysis.summary)).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getAllByText("熟练")).toHaveLength(2);
    expect(screen.getByText("基础")).toBeInTheDocument();
    expect(screen.getByText("置信度:高")).toBeInTheDocument();
    expect(screen.getByText(analysis.confidence.note)).toBeInTheDocument();
  });

  it("优势可展开:详情默认隐藏,点击后展示 AI 洞察", async () => {
    render(<ProfileResult initial={row} />);
    expect(screen.queryByText("两段开发经历均与目标岗位直接相关")).toBeNull();
    const button = screen.getByRole("button", { name: /实践经历对口/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await userEvent.setup().click(button);
    expect(screen.getByText("两段开发经历均与目标岗位直接相关")).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("不足来自推荐方向差距并标注来源方向", () => {
    render(<ProfileResult initial={row} />);
    // 同一差距在「不足」列与方向卡劣势中各出现一次
    expect(screen.getAllByText("缺少高并发与分布式实战经验")).toHaveLength(2);
    expect(screen.getByText("来自方向「后端开发」")).toBeInTheDocument();
  });

  it("雷达 HTML 图例:六维名称与数值可读", () => {
    render(<ProfileResult initial={row} />);
    for (const dimension of ["产品", "技术", "数据", "沟通", "项目", "行业"]) {
      expect(screen.getByText(dimension)).toBeInTheDocument();
    }
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
  });

  it("推荐方向卡:匹配度大数字、理由、优势/劣势", () => {
    render(<ProfileResult initial={row} />);
    expect(screen.getByText("后端开发")).toBeInTheDocument();
    // 「数据分析」同时出现在能力标签与方向卡标题中
    expect(screen.getAllByText("数据分析")).toHaveLength(2);
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getAllByText("匹配度")).toHaveLength(2);
    expect(screen.getByText(analysis.directions[0]!.reason)).toBeInTheDocument();
    expect(screen.getByLabelText("后端开发的优势")).toHaveTextContent("Python 熟练");
    expect(screen.getByLabelText("后端开发的劣势")).toHaveTextContent("缺少高并发与分布式实战经验");
  });

  it("发展建议:差距 + 行动", () => {
    render(<ProfileResult initial={row} />);
    expect(screen.getByText("缺少高并发与分布式项目经验")).toBeInTheDocument();
    expect(screen.getByText("完成一个包含消息队列与缓存的工程实践项目")).toBeInTheDocument();
  });

  it("仅一个版本:不显示版本选择器", () => {
    mocks.versionsData = [{ id: "p1", version: 1, createdAt: "2026-08-01T10:00:00Z" }];
    render(<ProfileResult initial={row} />);
    expect(screen.queryByLabelText("查看历史版本")).toBeNull();
    expect(mocks.getVersionEnabled).toBe(false);
  });

  it("多版本:切换后按版本渲染内容", async () => {
    mocks.versionsData = [
      { id: "p2", version: 2, createdAt: "2026-08-15T10:00:00Z" },
      { id: "p1", version: 1, createdAt: "2026-08-01T10:00:00Z" },
    ];
    mocks.getVersionData = {
      ...row,
      id: "p2",
      version: 2,
      parentVersion: 1,
      aiAnalysis: { ...analysis, summary: "这是第二版摘要" },
    };
    render(<ProfileResult initial={row} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("查看历史版本"));
    await user.click(await screen.findByRole("option", { name: /v2 ·/ }));
    expect(await screen.findByText("这是第二版摘要")).toBeInTheDocument();
    expect(mocks.getVersionEnabled).toBe(true);
  });

  it("aiAnalysis 非法:渲染前校验失败给出异常提示", () => {
    render(<ProfileResult initial={{ ...row, aiAnalysis: { summary: "不完整" } }} />);
    expect(screen.getByText("分析数据异常,请重新分析画像")).toBeInTheDocument();
  });

  it("页面头动作:规划成长路线/优化简历链接,这不是我未接线时禁用", () => {
    render(<ProfileResult initial={row} />);
    expect(screen.getByRole("link", { name: /规划成长路线/ })).toHaveAttribute(
      "href",
      "/navigator"
    );
    expect(screen.getByRole("link", { name: /优化简历/ })).toHaveAttribute("href", "/resume");
    expect(screen.getByRole("button", { name: "这不是我" })).toBeDisabled();
  });

  it("这不是我:接线后(2.6)可点击并触发回调", async () => {
    const onCorrect = vi.fn();
    render(<ProfileResult initial={row} onCorrect={onCorrect} />);
    const button = screen.getByRole("button", { name: "这不是我" });
    expect(button).toBeEnabled();
    await userEvent.setup().click(button);
    expect(onCorrect).toHaveBeenCalledTimes(1);
  });
});
