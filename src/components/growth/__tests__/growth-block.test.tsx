// 工作台成长区块测试(8.2 + 概览化):四态(加载骨架/错误重试/空态引导/数据)、
// 概览三事实行(职业画像版本 / 最新岗位匹配度 / 任务完成计数)、完整报告深链(D1:区块内入口)。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GrowthBlock } from "../growth-block";
import type { GrowthBlock as GrowthBlockData } from "@/lib/growth/data";

const mocks = vi.hoisted(() => ({
  blockData: null as GrowthBlockData | null,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    growth: {
      block: {
        useQuery: () => ({
          data: mocks.blockData,
          isLoading: mocks.isLoading,
          isError: mocks.isError,
          refetch: mocks.refetch,
        }),
      },
    },
  },
}));

function dataBlock(partial: Partial<GrowthBlockData> = {}): GrowthBlockData {
  return {
    profileVersionCount: 3,
    profileVersion: 3,
    latestMatchScore: 72,
    matchUpdatedAt: "2026-08-15T08:00:00.000Z",
    taskStats: { completed: 4, total: 21 },
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.blockData = null;
  mocks.isLoading = false;
  mocks.isError = false;
});

describe("GrowthBlock 工作台成长区块(概览)", () => {
  it("加载中:骨架屏", () => {
    mocks.isLoading = true;
    const { container } = render(<GrowthBlock />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("错误:alert + 重试调用 refetch", async () => {
    mocks.isError = true;
    const user = userEvent.setup();
    render(<GrowthBlock />);
    expect(screen.getByRole("alert")).toHaveTextContent("成长数据加载失败");
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });

  it("数据不足:区块内引导文案(不报错)", () => {
    mocks.blockData = dataBlock({
      profileVersionCount: 0,
      profileVersion: null,
      latestMatchScore: null,
      taskStats: { completed: 0, total: 0 },
    });
    render(<GrowthBlock />);
    expect(screen.getByText(/完成画像分析、匹配岗位或推进路线任务后/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去完成画像" })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("数据态:概览三事实行(版本/匹配度/任务完成)+ 完整报告深链", () => {
    mocks.blockData = dataBlock();
    render(<GrowthBlock />);
    expect(screen.getByText("成长概览")).toBeInTheDocument();
    expect(screen.getByText("第 3 版")).toBeInTheDocument();
    expect(screen.getByText("共分析 3 次")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("4 / 21")).toBeInTheDocument();
    expect(screen.getByText("职业画像")).toBeInTheDocument();
    expect(screen.getByText("最新岗位匹配度")).toBeInTheDocument();
    expect(screen.getByText("任务完成")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /查看完整报告/ })).toHaveAttribute(
      "href",
      "/dashboard/growth"
    );
  });

  it("部分数据:无匹配度时显示占位,不报错", () => {
    mocks.blockData = dataBlock({ latestMatchScore: null });
    render(<GrowthBlock />);
    expect(screen.getByText("第 3 版")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("无路线图:任务完成显示占位,不报错", () => {
    mocks.blockData = dataBlock({ taskStats: { completed: 0, total: 0 } });
    render(<GrowthBlock />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/\/ 0/)).toBeNull();
  });
});
