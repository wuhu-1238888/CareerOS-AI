"use client";
// 方向冲突对比块(8.1c,agent-design 4.4 四原则:不隐藏矛盾 / 给出依据 / 选择权给用户 / 记录决策):
// 仅当 matchReport.directionVerdict.verdict === "conflict" 时由匹配报告页渲染 —— 并列呈现
// 「画像方向 + 依据」(aiAnalysis.directions/summary)与「匹配推荐 + 理由」(verdict.reason,
// 「为什么」折叠 ai-insight,复用 resume-analysis-card 视觉);三选一裁决落 DirectionResolution;
// 同一 (profileVersion, matchDirection) 已有裁决 → 展示已记录选择,不再重复询问。
import { useState } from "react";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/shared/ai-badge";
import { trpc } from "@/trpc/client";
import { cn } from "@/lib/utils";

export type DirectionChoice = "prefer_profile" | "prefer_match" | "keep_both";

const CHOICE_LABEL: Record<DirectionChoice, string> = {
  prefer_profile: "以画像方向为准",
  prefer_match: "以匹配方向为准",
  keep_both: "两者都保留考虑",
};

export function DirectionConflictCard({
  verdict,
  profileDirections,
  profileBasis,
  profileVersion,
  matchDirection,
}: {
  /** directionVerdict(verdict 已判定为 conflict) */
  verdict: { alignedDirection: string; reason: string };
  /** 画像声明方向(readProfileSummaryForMatch directions 同源) */
  profileDirections: string[];
  /** 画像分析摘要(画像方向的依据) */
  profileBasis: string | null;
  /** 最新画像版本号(裁决记录键) */
  profileVersion: number;
  /** 匹配推荐方向(报告 positionTitle;裁决记录键) */
  matchDirection: string;
}) {
  const utils = trpc.useUtils();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [pending, setPending] = useState<DirectionChoice | null>(null);
  const resolution = trpc.linkage.resolution.useQuery({ profileVersion, matchDirection });
  const resolve = trpc.linkage.resolveDirection.useMutation({
    onSuccess: () => void utils.linkage.resolution.invalidate(),
  });

  async function handleChoice(choice: DirectionChoice) {
    setPending(choice);
    try {
      await resolve.mutateAsync({
        profileVersion,
        profileDirection: verdict.alignedDirection,
        matchDirection,
        choice,
      });
    } finally {
      setPending(null);
    }
  }

  const recordedChoice = resolution.data?.choice as DirectionChoice | undefined;

  return (
    <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="size-5 shrink-0 text-warning" aria-hidden />
        <h2 className="text-h2 text-ink">方向存在差异</h2>
        <AiBadge />
      </div>
      <p className="mt-2 text-body-sm text-ink-secondary">
        这个岗位的方向与画像声明的方向不一致。AI 不替你做决定,请结合自身情况选择。
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {/* 画像方向 + 依据 */}
        <div className="rounded-r-control border-l-[3px] border-l-green-600 bg-green-50 p-4">
          <p className="text-caption font-semibold text-green-700">画像方向</p>
          {profileDirections.length > 0 ? (
            <ul className="mt-1.5 space-y-1">
              {profileDirections.map((direction) => (
                <li key={direction} className="text-body font-medium text-ink">
                  {direction}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1.5 text-body font-medium text-ink">{verdict.alignedDirection}</p>
          )}
          {profileBasis && (
            <p className="mt-2 text-body-sm text-ink-secondary">
              依据:{profileBasis.length > 120 ? `${profileBasis.slice(0, 120)}…` : profileBasis}
            </p>
          )}
        </div>

        {/* 匹配推荐 + 理由(「为什么」折叠 ai-insight) */}
        <div className="rounded-r-control border-l-[3px] border-l-violet-400 bg-violet-50 p-4">
          <p className="text-caption font-semibold text-violet-700">匹配推荐</p>
          <p className="mt-1.5 text-body font-medium text-ink">{matchDirection}</p>
          <div className="mt-2">
            <button
              type="button"
              className="flex w-full items-center gap-1.5 text-left text-caption text-ink-muted hover:text-ink-secondary"
              aria-expanded={reasonOpen}
              onClick={() => setReasonOpen((v) => !v)}
            >
              为什么是这个方向
              <ChevronDown
                className={cn("size-3.5 shrink-0 transition-transform", reasonOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            {reasonOpen && (
              <div className="mt-2 rounded-r-control border-l-[3px] border-l-violet-400 bg-violet-50 p-3">
                <AiBadge>AI 分析</AiBadge>
                <p className="mt-1.5 text-body-sm text-ink-secondary">{verdict.reason}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {recordedChoice ? (
        /* 已有裁决:展示已记录选择,不再重复询问(agent-design 4.4「记录决策」) */
        <div role="status" className="mt-4 flex items-start gap-2 rounded-control bg-sunken p-3">
          <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
          <p className="text-body-sm text-ink-secondary">
            已记录你的选择:{CHOICE_LABEL[recordedChoice]}
            <span className="ml-1 text-caption text-ink-faint">
              (后续出现相同冲突时将展示此选择,不再重复询问)
            </span>
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {(Object.keys(CHOICE_LABEL) as DirectionChoice[]).map((choice) => (
            <Button
              key={choice}
              type="button"
              size="sm"
              variant={choice === "prefer_profile" ? "default" : "ghost"}
              disabled={pending !== null}
              onClick={() => void handleChoice(choice)}
            >
              {CHOICE_LABEL[choice]}
            </Button>
          ))}
        </div>
      )}
    </section>
  );
}
