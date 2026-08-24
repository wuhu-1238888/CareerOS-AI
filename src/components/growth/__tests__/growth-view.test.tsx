// 个人成长报告页视图测试(8.2):四态(加载骨架/错误重试/空态引导/数据)、版本时间线选中相邻两版
// 双线雷达与能力变化、任务趋势与匹配曲线 sr-only 文本、聚合卡「示例」标注与样本不足引导。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GrowthView } from "../growth-view";
import type { GrowthReport, GrowthAggregateEntry } from "@/lib/growth/data";

const mocks = vi.hoisted(() => ({
  reportData: null as GrowthReport | null,
  reportLoading: false,
  reportError: false,
  aggregateData: null as GrowthAggregateEntry[] | null,
  aggregateLoading: false,
  aggregateError: false,
  refetch: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    growth: {
      report: {
        useQuery: () => ({
          data: mocks.reportData,
          isLoading: mocks.reportLoading,
          isError: mocks.reportError,
          refetch: mocks.refetch,
        }),
      },
      aggregate: {
        useQuery: () => ({
          data: mocks.aggregateData,
          isLoading: mocks.aggregateLoading,
          isError: mocks.aggregateError,
          refetch: mocks.refetch,
        }),
      },
    },
  },
}));

const zeroTrend = Array.from({ length: 12 }, (_, k) => ({
  weekStart: new Date(Date.UTC(2026, 7, 16 - (11 - k) * 7, 16)).toISOString(),
  count: 0,
}));

function reportFixture(): GrowthReport {
  return {
    profileVersions: [
      {
        version: 1,
        createdAt: "2026-08-01T08:00:00.000Z",
        radar: { 产品: 50, 技术: 40, 数据: 45, 沟通: 55, 项目: 35, 行业: 30 },
        abilityTags: [
          { name: "Python", level: "基础" },
          { name: "SQL", level: "基础" },
          { name: "Git", level: "基础" },
        ],
        diff: null,
      },
      {
        version: 2,
        createdAt: "2026-08-10T08:00:00.000Z",
        radar: { 产品: 52, 技术: 48, 数据: 45, 沟通: 55, 项目: 40, 行业: 30 },
        abilityTags: [
          { name: "Python", level: "熟练" },
          { name: "SQL", level: "基础" },
          { name: "Docker", level: "基础" },
        ],
        diff: {
          radar: [{ dimension: "技术", current: 48, previous: 40, delta: 8 }],
          abilityTags: [{ name: "Python", kind: "提升", from: "基础", to: "熟练" }],
        },
      },
    ],
    taskTrend: zeroTrend.map((bucket, k) => ({ ...bucket, count: k === 11 ? 2 : 0 })),
    matchScores: [
      { createdAt: "2026-08-01T09:00:00.000Z", overallScore: 60 },
      { createdAt: "2026-08-02T09:00:00.000Z", overallScore: 65 },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.reportData = null;
  mocks.reportLoading = false;
  mocks.reportError = false;
  mocks.aggregateData = null;
  mocks.aggregateLoading = false;
  mocks.aggregateError = false;
});

describe("GrowthView 个人成长报告页", () => {
  it("加载中:时间线骨架 + 三图骨架", () => {
    mocks.reportLoading = true;
    mocks.aggregateLoading = true;
    const { container } = render(<GrowthView />);
    expect(container.querySelectorAll(".animate-pulse").length).toBe(4);
    expect(screen.getByText("画像版本演进")).toBeInTheDocument();
  });

  it("错误:图表级 alert + 重试调用 refetch", async () => {
    mocks.reportError = true;
    mocks.aggregateError = true;
    const user = userEvent.setup();
    render(<GrowthView />);
    expect(screen.getAllByText("图表数据加载失败")).toHaveLength(4);
    await user.click(screen.getAllByRole("button", { name: "重试" })[0]!);
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("空态:各图展示引导文案而非报错", () => {
    mocks.reportData = { profileVersions: [], taskTrend: zeroTrend, matchScores: [] };
    mocks.aggregateData = [];
    render(<GrowthView />);
    expect(screen.getByText("完成第一次画像分析后,这里会展示你的画像版本演进")).toBeInTheDocument();
    expect(screen.getByText("完成任务打卡后,这里会展示你的任务完成趋势")).toBeInTheDocument();
    expect(screen.getByText("完成岗位匹配后,这里会展示你的匹配度变化曲线")).toBeInTheDocument();
    expect(screen.getByText(/样本不足时不展示,保护隐私/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("数据态:默认选中最新版对比上一版(雷达图例 + 能力变化徽章)", () => {
    mocks.reportData = reportFixture();
    mocks.aggregateData = [{ direction: "后端开发", userCount: 5, avgStageCompletion: 0.75 }];
    render(<GrowthView />);

    // 时间线两版,最新版默认选中
    expect(screen.getByRole("button", { name: /第 2 版/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /第 1 版/ })).toHaveAttribute("aria-pressed", "false");

    // 双线雷达图例:第 2 版 / 第 1 版
    const legend = screen.getByLabelText("雷达图例");
    expect(within(legend).getByText("第 2 版")).toBeInTheDocument();
    expect(within(legend).getByText("第 1 版")).toBeInTheDocument();

    // 能力标签变化(颜色 + 文字双通道)
    expect(screen.getByText("提升 ↑")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("基础 → 熟练")).toBeInTheDocument();
    expect(screen.getByText("新增 +")).toBeInTheDocument();
    expect(screen.getByText("Docker")).toBeInTheDocument();
    expect(screen.getByText("达到 基础")).toBeInTheDocument();

    // 雷达 sr-only 数据
    expect(screen.getByLabelText("雷达变化数据")).toHaveTextContent("技术:上一版 40,当前 48");

    // 任务趋势 sr-only(当前周 2 个任务)
    expect(screen.getByLabelText("任务完成趋势数据")).toHaveTextContent("当周:2 个任务");

    // 匹配度曲线 sr-only(两个时间点)
    const scoreList = screen.getByLabelText("匹配度变化数据");
    expect(scoreList).toHaveTextContent("匹配度 60 分");
    expect(scoreList).toHaveTextContent("匹配度 65 分");

    // 聚合卡:方向/样本数/达成率 + 「示例」标注
    expect(screen.getByText("后端开发")).toBeInTheDocument();
    expect(screen.getByText("5 人样本 · 平均达成 75%")).toBeInTheDocument();
    expect(screen.getByText(/示例 · 数据来自选择相同方向的用户,已匿名聚合/)).toBeInTheDocument();
  });

  it("单版本:对比区展示「第二次画像分析」引导", () => {
    const report = reportFixture();
    mocks.reportData = {
      ...report,
      profileVersions: report.profileVersions.slice(0, 1).map((v) => ({ ...v, diff: null })),
    };
    mocks.aggregateData = [];
    render(<GrowthView />);
    expect(
      screen.getByText("完成第二次画像分析后,这里可对比相邻两版的雷达与能力标签")
    ).toBeInTheDocument();
  });

  it("切换选中版本:首版无上一版本 → 对比区回退引导;再点回最新版恢复雷达", async () => {
    mocks.reportData = reportFixture();
    mocks.aggregateData = [];
    const user = userEvent.setup();
    render(<GrowthView />);
    await user.click(screen.getByRole("button", { name: /第 1 版/ }));
    expect(screen.getByRole("button", { name: /第 1 版/ })).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText("完成第二次画像分析后,这里可对比相邻两版的雷达与能力标签")
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /第 2 版/ }));
    expect(screen.getByLabelText("雷达图例")).toBeInTheDocument();
  });
});
