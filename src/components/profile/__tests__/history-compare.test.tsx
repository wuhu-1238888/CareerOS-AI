// 画像历史对比测试(6.5):双线雷达图例、能力变化徽章(提升/下降/新增,颜色 + 文字双通道)、
// 无变化文案、previous 解析失败整体隐藏区块。
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HistoryCompare } from "../history-compare";
import type { ProfileAnalysis } from "@/lib/profile/analysis-schemas";

const mocks = vi.hoisted(() => ({
  getVersionData: undefined as
    | { id: string; version: number; createdAt: string; aiAnalysis: unknown }
    | undefined,
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    profile: {
      getVersion: { useQuery: () => ({ data: mocks.getVersionData, isLoading: false }) },
    },
  },
}));

const current: ProfileAnalysis = {
  summary: "当前版摘要",
  abilityTags: [
    { name: "Python", level: "精通" },
    { name: "SQL", level: "基础" },
    { name: "React", level: "熟练" },
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
      strengths: ["Python 精通"],
      weaknesses: ["缺少高并发实战"],
    },
    { name: "数据分析", matchScore: 70, reason: "SQL 基础可迁移", strengths: ["SQL"], weaknesses: ["缺少建模经验"] },
  ],
  radar: { 产品: 40, 技术: 80, 数据: 68, 沟通: 50, 项目: 66, 行业: 45 },
  suggestions: [{ gap: "缺少高并发实战", action: "完成一个消息队列项目" }],
  confidence: { level: "高", note: "信息齐全" },
};

const previousAnalysis: ProfileAnalysis = {
  ...current,
  abilityTags: [
    { name: "Python", level: "熟练" },
    { name: "SQL", level: "熟练" },
    { name: "数据分析", level: "基础" },
  ],
  radar: { ...current.radar, 技术: 60, 沟通: 60 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getVersionData = undefined;
});

describe("HistoryCompare(6.5)", () => {
  it("双线雷达图例 + 三类变化徽章(提升↑/下降↓/新增+,等级变化文字)", () => {
    mocks.getVersionData = {
      id: "p1",
      version: 1,
      createdAt: "2026-08-01T10:00:00Z",
      aiAnalysis: previousAnalysis,
    };
    render(<HistoryCompare current={current} previousId="p1" />);
    expect(screen.getByText("历史对比")).toBeInTheDocument();
    expect(screen.getByText("当前画像 vs 第 1 版画像")).toBeInTheDocument();
    expect(screen.getByText("当前画像")).toBeInTheDocument();
    expect(screen.getByText("上次画像")).toBeInTheDocument();
    // 三类变化:颜色 + 文字双通道(徽章文字含方向)
    expect(screen.getByText(/提升 ↑/)).toBeInTheDocument();
    expect(screen.getByText(/下降 ↓/)).toBeInTheDocument();
    expect(screen.getByText(/新增 \+/)).toBeInTheDocument();
    expect(screen.getByText("熟练 → 精通")).toBeInTheDocument();
    expect(screen.getByText("熟练 → 基础")).toBeInTheDocument();
    expect(screen.getByText("达到 熟练")).toBeInTheDocument();
  });

  it("能力标签无变化:展示无变化文案,不渲染变化条目", () => {
    mocks.getVersionData = {
      id: "p1",
      version: 1,
      createdAt: "2026-08-01T10:00:00Z",
      aiAnalysis: current,
    };
    render(<HistoryCompare current={current} previousId="p1" />);
    expect(screen.getByText("本次更新能力标签无变化")).toBeInTheDocument();
    expect(screen.queryByLabelText("能力标签变化")).toBeNull();
  });

  it("previous aiAnalysis 解析失败:整个区块隐藏(不阻塞结果页)", () => {
    mocks.getVersionData = {
      id: "p1",
      version: 1,
      createdAt: "2026-08-01T10:00:00Z",
      aiAnalysis: { broken: true },
    };
    const { container } = render(<HistoryCompare current={current} previousId="p1" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("历史对比")).toBeNull();
  });
});
