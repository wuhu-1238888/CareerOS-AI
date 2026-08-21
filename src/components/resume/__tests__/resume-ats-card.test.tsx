// ATS 评分卡测试(4.6):空态显式按钮触发评分(mutate + 失效刷新 + 成功 toast)/ 评分中进度态 /
// 报告渲染(大数字 + 等级徽章 + 规则与 LLM 分项 + 建议列表)/ stale 提示与重新评分 /
// 失败 toast 不失效刷新 / 报告损坏回退空态(防御解析)
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeAtsCard } from "../resume-ats-card";

const mocks = vi.hoisted(() => ({
  scoreAtsMutateAsync: vi.fn(),
  invalidateResume: vi.fn(),
  isPending: false,
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ resume: { get: { invalidate: mocks.invalidateResume } } }),
    resume: {
      scoreAts: {
        useMutation: () => ({
          mutateAsync: mocks.scoreAtsMutateAsync,
          isPending: mocks.isPending,
        }),
      },
    },
  },
}));

const report = {
  total: 72,
  level: "良好",
  ruleSubscores: {
    sections: 80,
    quantified: 60,
    keywords: 60,
    actionVerbs: 60,
    length: 100,
    parseability: 100,
  },
  ruleScore: 64,
  llmSubscores: { contentQuality: 4, relevance: 4 },
  suggestions: [
    { title: "补充量化成果", detail: "工作经历中仍有两条未包含可量化指标。" },
    { title: "关键词对齐", detail: "技能列表可补充岗位关键词。" },
  ],
};

function renderCard(
  props: { atsScore?: number | null; atsReport?: unknown; stale?: boolean } = {}
) {
  const user = userEvent.setup();
  render(
    <>
      <Toaster />
      <ResumeAtsCard
        versionId="v1"
        atsScore={props.atsScore ?? null}
        atsReport={props.atsReport ?? null}
        stale={props.stale ?? false}
      />
    </>
  );
  return { user };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isPending = false;
  mocks.invalidateResume.mockResolvedValue(undefined);
  mocks.scoreAtsMutateAsync.mockResolvedValue({
    versionId: "v1",
    total: 72,
    level: "良好",
    runId: "run-ats",
  });
});

describe("ResumeAtsCard ATS 评分卡", () => {
  it("空态:说明块 + 显式「生成 ATS 评分」按钮;点击触发 scoreAts(versionId)+ 失效刷新 + 成功 toast", async () => {
    const { user } = renderCard();
    expect(screen.getByText("ATS 评分")).toBeInTheDocument();
    expect(screen.getByText(/基于岗位关键词、量化表达等规则与 AI 评估/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "生成 ATS 评分" }));
    await waitFor(() => expect(mocks.scoreAtsMutateAsync).toHaveBeenCalledWith({ versionId: "v1" }));
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
    expect(await screen.findByText("ATS 评分已生成")).toBeInTheDocument();
  });

  it("评分中:卡内进度态文案,不显示报告与触发按钮", () => {
    mocks.isPending = true;
    renderCard();
    expect(screen.getByText("正在生成 ATS 评分,请稍候…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成 ATS 评分" })).not.toBeInTheDocument();
    expect(screen.queryByText(/等级:/)).not.toBeInTheDocument();
  });

  it("报告渲染:大数字 72 + 进度环 + 等级徽章 + 规则/LLM 分项说明 + 建议列表", () => {
    renderCard({ atsScore: 72, atsReport: report });
    expect(screen.getByText("72")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "ATS 评分 72 分" })).toBeInTheDocument();
    expect(screen.getByText("等级:良好")).toBeInTheDocument();
    expect(screen.getByText(/规则分 64,内容质量 4\/5,岗位相关度 4\/5/)).toBeInTheDocument();
    expect(screen.getByText("补充量化成果")).toBeInTheDocument();
    expect(screen.getByText("关键词对齐")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "生成 ATS 评分" })).not.toBeInTheDocument();
  });

  it("stale:提示「修改后需重新评分」+ 重新评分按钮触发 scoreAts", async () => {
    const { user } = renderCard({ atsScore: 72, atsReport: report, stale: true });
    expect(screen.getByRole("status")).toHaveTextContent(/修改后需重新评分/);
    await user.click(screen.getByRole("button", { name: "重新评分" }));
    await waitFor(() => expect(mocks.scoreAtsMutateAsync).toHaveBeenCalledWith({ versionId: "v1" }));
    await waitFor(() => expect(mocks.invalidateResume).toHaveBeenCalled());
  });

  it("非 stale:无提示也无重新评分按钮", () => {
    renderCard({ atsScore: 72, atsReport: report });
    expect(screen.queryByText(/修改后需重新评分/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "重新评分" })).not.toBeInTheDocument();
  });

  it("评分失败:错误 toast,不失效刷新", async () => {
    mocks.scoreAtsMutateAsync.mockRejectedValueOnce(
      new Error("简历原文缺失,请重新上传或粘贴简历内容")
    );
    const { user } = renderCard();
    await user.click(screen.getByRole("button", { name: "生成 ATS 评分" }));
    expect(
      await screen.findByText("简历原文缺失,请重新上传或粘贴简历内容")
    ).toBeInTheDocument();
    expect(mocks.invalidateResume).not.toHaveBeenCalled();
  });

  it("报告损坏(防御解析):回退空态,不渲染分数", () => {
    renderCard({ atsScore: 72, atsReport: { total: "不是数字" } });
    expect(screen.getByRole("button", { name: "生成 ATS 评分" })).toBeInTheDocument();
    expect(screen.queryByText("72")).not.toBeInTheDocument();
  });
});
