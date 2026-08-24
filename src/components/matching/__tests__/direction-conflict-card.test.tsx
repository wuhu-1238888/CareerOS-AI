// 方向冲突对比块测试(8.1c):并列呈现画像方向+依据与匹配推荐+理由(「为什么」折叠)、
// 三选一裁决落库调用、已有裁决展示已记录选择不重复询问。
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DirectionConflictCard } from "../direction-conflict-card";

const mocks = vi.hoisted(() => ({
  resolutionData: null as { choice: string } | null,
  resolutionInput: null as { profileVersion: number; matchDirection: string } | null,
  resolveMutateAsync: vi.fn(),
  invalidateResolution: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ linkage: { resolution: { invalidate: mocks.invalidateResolution } } }),
    linkage: {
      resolution: {
        useQuery: (input: { profileVersion: number; matchDirection: string }) => {
          mocks.resolutionInput = input;
          return { data: mocks.resolutionData, isLoading: false };
        },
      },
      // 转发 onSuccess:组件内 onSuccess 触发 resolution.invalidate(裁决后刷新裁决查询)
      resolveDirection: {
        useMutation: (opts: { onSuccess?: (result: unknown) => void }) => ({
          mutateAsync: async (...args: unknown[]) => {
            const result = await mocks.resolveMutateAsync(...args);
            opts.onSuccess?.(result);
            return result;
          },
        }),
      },
    },
  },
}));

const baseProps = {
  verdict: { alignedDirection: "后端开发", reason: "画像声明目标为后端开发,本岗位为新媒体运营,方向差异明显" },
  profileDirections: ["后端开发", "数据分析"],
  profileBasis: "计算机专业应届生,后端实习 3 个月,目标后端开发工程师。",
  profileVersion: 2,
  matchDirection: "新媒体运营实习生",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolutionData = null;
  mocks.resolutionInput = null;
  mocks.resolveMutateAsync.mockResolvedValue({ ok: true, choice: "prefer_profile" });
});

describe("DirectionConflictCard 方向冲突对比块", () => {
  it("并列呈现画像方向+依据与匹配推荐;AI 徽章与说明文案", () => {
    render(<DirectionConflictCard {...baseProps} />);
    expect(screen.getByText("方向存在差异")).toBeInTheDocument();
    expect(screen.getByText(/AI 不替你做决定/)).toBeInTheDocument();
    expect(screen.getByText("后端开发")).toBeInTheDocument();
    expect(screen.getByText("数据分析")).toBeInTheDocument();
    expect(screen.getByText(/依据:计算机专业应届生/)).toBeInTheDocument();
    expect(screen.getByText("新媒体运营实习生")).toBeInTheDocument();
    // AI 内容必带标识:卡片头默认渲染一枚 AiBadge(「AI 分析」)
    expect(screen.getAllByText("AI 分析")).toHaveLength(1);
  });

  it("「为什么是这个方向」折叠:默认隐藏理由,展开显示 ai-insight 与 reason", async () => {
    const user = userEvent.setup();
    render(<DirectionConflictCard {...baseProps} />);
    expect(screen.queryByText(/画像声明目标为后端开发/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "为什么是这个方向" }));
    expect(screen.getByText(/画像声明目标为后端开发/)).toBeInTheDocument();
  });

  it("三选一裁决:点击「以匹配方向为准」→ resolveDirection(profileVersion, profileDirection, matchDirection, choice)", async () => {
    const user = userEvent.setup();
    render(<DirectionConflictCard {...baseProps} />);
    await user.click(screen.getByRole("button", { name: "以匹配方向为准" }));
    await waitFor(() =>
      expect(mocks.resolveMutateAsync).toHaveBeenCalledWith({
        profileVersion: 2,
        profileDirection: "后端开发",
        matchDirection: "新媒体运营实习生",
        choice: "prefer_match",
      })
    );
    await waitFor(() => expect(mocks.invalidateResolution).toHaveBeenCalled());
  });

  it("resolution 查询以 (profileVersion, matchDirection) 为键", () => {
    render(<DirectionConflictCard {...baseProps} />);
    expect(mocks.resolutionInput).toEqual({ profileVersion: 2, matchDirection: "新媒体运营实习生" });
  });

  it("已有裁决:展示已记录选择,不再渲染三按钮(不重复询问)", () => {
    mocks.resolutionData = { choice: "keep_both" };
    render(<DirectionConflictCard {...baseProps} />);
    expect(screen.getByRole("status")).toHaveTextContent("已记录你的选择:两者都保留考虑");
    expect(screen.getByRole("status")).toHaveTextContent(/不再重复询问/);
    expect(screen.queryByRole("button", { name: "以画像方向为准" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "以匹配方向为准" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "两者都保留考虑" })).not.toBeInTheDocument();
  });

  it("画像方向列表为空:回退显示 verdict.alignedDirection", () => {
    render(<DirectionConflictCard {...baseProps} profileDirections={[]} />);
    expect(screen.getByText("后端开发")).toBeInTheDocument();
  });
});
