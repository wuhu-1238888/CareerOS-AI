// 联动横幅测试(8.1b):按 kinds 过滤渲染、三种规则文案、关闭调用 dismiss(kind, refVersion)、
// 空规则不渲染、同 kind 不同版本各渲染一条(版本隔离展示)。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LinkageBanners } from "../linkage-banners";
import type { LinkageRule } from "@/lib/linkage/rules";

const mocks = vi.hoisted(() => ({
  rulesData: [] as LinkageRule[],
  dismissMutate: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ linkage: { rules: { invalidate: vi.fn() } } }),
    linkage: {
      rules: { useQuery: () => ({ data: mocks.rulesData, isLoading: false }) },
      dismiss: { useMutation: () => ({ mutate: mocks.dismissMutate }) },
    },
  },
}));

const projectRule: LinkageRule = {
  kind: "resume_project",
  refVersion: "roadmap-1",
  roadmapId: "roadmap-1",
  stageName: "阶段二",
  projectTitle: "个人博客系统",
  deliverable: "可访问的博客站点",
};

const resumeOutdatedRule: LinkageRule = {
  kind: "resume_outdated",
  refVersion: "3",
  profileVersion: 3,
  profileUpdatedAt: "2026-08-20T10:00:00.000Z",
  staleUpdatedAt: "2026-08-10T10:00:00.000Z",
};

const roadmapOutdatedRule: LinkageRule = {
  kind: "roadmap_outdated",
  refVersion: "3",
  profileVersion: 3,
  profileUpdatedAt: "2026-08-20T10:00:00.000Z",
  staleUpdatedAt: "2026-08-05T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.rulesData = [];
});

describe("LinkageBanners 联动横幅", () => {
  it("无活跃规则:不渲染任何横幅", () => {
    render(<LinkageBanners kinds={["resume_project", "resume_outdated"]} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("按 kinds 过滤:只渲染页面关心的规则(roadmap_outdated 不落入简历页)", () => {
    mocks.rulesData = [projectRule, roadmapOutdatedRule];
    render(<LinkageBanners kinds={["resume_project", "resume_outdated"]} />);
    expect(screen.getByText(/个人博客系统/)).toBeInTheDocument();
    expect(screen.queryByText(/成长路线可能需重新生成/)).not.toBeInTheDocument();
  });

  it("resume_project:项目名 + 产出物 + 引导文案 + 「查看项目」入口", () => {
    mocks.rulesData = [projectRule];
    render(<LinkageBanners kinds={["resume_project"]} />);
    expect(screen.getByRole("status")).toHaveTextContent("路线图项目可加入简历");
    expect(screen.getByRole("status")).toHaveTextContent(/「个人博客系统」/);
    expect(screen.getByRole("status")).toHaveTextContent(/产出物:可访问的博客站点/);
    expect(screen.getByRole("status")).toHaveTextContent(/手动补充到简历的项目经历/);
    expect(screen.getByRole("link", { name: /查看项目/ })).toHaveAttribute(
      "href",
      "/navigator?focus=current"
    );
  });

  it("resume_outdated:画像更新日期 + 重新优化引导 + 「查看画像」入口", () => {
    mocks.rulesData = [resumeOutdatedRule];
    render(<LinkageBanners kinds={["resume_outdated"]} />);
    expect(screen.getByRole("status")).toHaveTextContent("画像已更新");
    expect(screen.getByRole("status")).toHaveTextContent(/2026-08-20/);
    expect(screen.getByRole("status")).toHaveTextContent(/简历优化内容可能已过时,建议重新优化/);
    expect(screen.getByRole("link", { name: /查看画像/ })).toHaveAttribute("href", "/profile");
  });

  it("roadmap_outdated:路线图重新生成引导", () => {
    mocks.rulesData = [roadmapOutdatedRule];
    render(<LinkageBanners kinds={["roadmap_outdated"]} />);
    expect(screen.getByRole("status")).toHaveTextContent(/当前成长路线可能需重新生成/);
  });

  it("关闭:以 (kind, refVersion) 调用 dismiss(按版本去重落库)", async () => {
    mocks.rulesData = [resumeOutdatedRule];
    const user = userEvent.setup();
    render(<LinkageBanners kinds={["resume_outdated"]} />);
    await user.click(screen.getByRole("button", { name: "关闭提示" }));
    expect(mocks.dismissMutate).toHaveBeenCalledWith({ kind: "resume_outdated", refVersion: "3" });
  });

  it("同 kind 不同 refVersion:各渲染一条(版本隔离,互不覆盖)", () => {
    mocks.rulesData = [
      resumeOutdatedRule,
      { ...resumeOutdatedRule, refVersion: "4", profileVersion: 4 },
    ];
    render(<LinkageBanners kinds={["resume_outdated"]} />);
    expect(screen.getAllByRole("status")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "关闭提示" })).toHaveLength(2);
  });
});
