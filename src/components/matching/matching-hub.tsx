"use client";
// 岗位匹配页状态枢纽(6.2):无画像引导 / JD 表单 / 匹配过程 / 匹配报告 / 失败恢复。
// 镜像 profile-hub 状态机:匹配态统一轮询 matching.latestRun({intent:"analyze-match"})(700ms,
// 进度事件已随执行落库):分析中刷新页面按最近 run 恢复;
// 失败态提供「重试」(会话内用最近一次 JD;刷新后服务端从 AgentRun.input 重放)与「修改 JD」。
// 纠偏(6.2)「这个要求我其实满足」:弹窗收集说明 → Toast → 以落库 JD 原文重新匹配。
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Crosshair } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import { MatchForm } from "./match-form";
import { MatchReport } from "./match-report";
import { GapCorrectionDialog } from "./gap-correction-dialog";
import { AnalysisView } from "@/components/profile/analysis-view";
import { matchAnalysisSchema, profileRadarSchema } from "@/lib/matching/analysis-schemas";

function friendlyError(err: unknown): string {
  return err instanceof Error ? err.message : "匹配失败,请稍后重试";
}

export function MatchingHub() {
  const utils = trpc.useUtils();
  const profile = trpc.profile.get.useQuery();
  const matching = trpc.matching.get.useQuery();
  const run = trpc.matching.run.useMutation();
  const retry = trpc.matching.retry.useMutation();
  const correct = trpc.matching.correct.useMutation();

  // 本次会话提交状态:submitted=true 表示匹配 mutation 在途;matchError 为失败文案(驱动失败视图)
  const [submitted, setSubmitted] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<null | "edit" | "redo">(null);
  const [correction, setCorrection] = useState<{ id: string; text: string } | null>(null);
  const lastInput = useRef<string | null>(null);
  const finishedRef = useRef(false);

  // 报告渲染前防御解析(DB 回读不直接信任);损坏按无报告处理
  const parsedReport = matchAnalysisSchema.safeParse(matching.data?.matchReport);
  const report = parsedReport.success ? parsedReport.data : null;
  const hasReport = !!report;
  // 用户线雷达:最新画像 aiAnalysis.radar 防御解析(画像存在但分析损坏 → 仅岗位线)
  const userRadar = profileRadarSchema.safeParse(
    (profile.data?.aiAnalysis as { radar?: unknown } | null)?.radar
  );

  // 跟踪最近一次 run:无报告(首建/恢复)或提交在途时启用;仅 running/在途时轮询 700ms
  const latestRun = trpc.matching.latestRun.useQuery(
    { intent: "analyze-match" },
    {
      enabled: !matching.isLoading && (!hasReport || submitted),
      refetchInterval: (query) =>
        submitted || query.state.data?.status === "running" ? 700 : false,
    }
  );

  // 恢复路径:刷新后 run 已 succeeded(管线已完成)→ 刷新匹配记录进入报告视图
  useEffect(() => {
    if (!hasReport && latestRun.data?.status === "succeeded" && !finishedRef.current) {
      finishedRef.current = true;
      void utils.matching.get.invalidate();
    }
  }, [hasReport, latestRun.data?.status, utils]);

  if (profile.isLoading || matching.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[640px] space-y-4 px-4 py-6" aria-label="加载中">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // 无画像引导(6.2 验收项):完整匹配对比依赖画像,完成前不提供表单
  if (!profile.data) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-6">
        <div className="rounded-card border border-hairline bg-surface p-10 text-center shadow-card">
          <h2 className="text-h2 text-ink">先完成职业画像</h2>
          <p className="mx-auto mt-2 max-w-md text-body text-ink-secondary">
            岗位匹配需要结合你的能力画像进行评估。完成画像后,AI 才能给出匹配度与逐项能力对比。
          </p>
          <Button className="mt-6" asChild>
            <Link href="/profile">去完成职业画像</Link>
          </Button>
        </div>
      </div>
    );
  }

  const recovering = !matchError && !hasReport && latestRun.data?.status === "running";
  const failedRun =
    !formMode && !matchError && latestRun.data?.status === "failed" ? latestRun.data : null;

  // 在途提交时忽略历史 run(避免把上次失败的旧 run 当作本次状态),等待轮询发现新 run
  const runForView =
    submitted && latestRun.data && latestRun.data.status !== "running"
      ? null
      : (latestRun.data ?? null);

  async function submit(jdText: string) {
    lastInput.current = jdText;
    finishedRef.current = false;
    setMatchError(null);
    setFormMode(null);
    setSubmitted(true);
    try {
      await run.mutateAsync({ jdText });
      await utils.matching.get.invalidate();
    } catch (err) {
      setMatchError(friendlyError(err));
      // 向表单抛出以保留错误提示(表单仅在提交成功时离开)
      throw err;
    } finally {
      setSubmitted(false);
    }
  }

  async function handleRetry() {
    // 会话内失败:直接用最近一次提交的 JD 重试
    if (lastInput.current) {
      await submit(lastInput.current).catch(() => undefined);
      return;
    }
    // 刷新后恢复:服务端从失败 run 的 input 重放匹配
    if (!failedRun) {
      setMatchError("匹配任务不存在,请重新粘贴岗位描述");
      return;
    }
    finishedRef.current = false;
    setMatchError(null);
    setSubmitted(true);
    try {
      await retry.mutateAsync({ runId: failedRun.id });
      await utils.matching.get.invalidate();
    } catch (err) {
      setMatchError(friendlyError(err));
    } finally {
      setSubmitted(false);
    }
  }

  // 进入 JD 表单:失败视图「修改 JD」(edit)与报告页「重新匹配」(redo)共用;预填会话内 JD 或落库原文
  function enterFormMode(mode: "edit" | "redo") {
    lastInput.current = null;
    setMatchError(null);
    setFormMode(mode);
  }

  // 纠偏(6.2):Toast 后以落库 JD 原文 + 定向反馈重新匹配;失败回到弹窗内提示
  async function handleCorrect(note: string) {
    if (!correction) return;
    toast("已记录,AI 将重新评估该项并更新匹配");
    try {
      await correct.mutateAsync({ requirementId: correction.id, note });
      await utils.matching.get.invalidate();
    } catch (err) {
      toast.error(friendlyError(err));
      throw err;
    }
  }

  let view: React.ReactNode;
  if (submitted || recovering || matchError) {
    // 匹配在途或本次会话失败(含纠偏重匹配):优先级高于报告视图
    view = (
      <AnalysisView
        run={runForView}
        error={matchError}
        onRetry={handleRetry}
        onEdit={() => enterFormMode("edit")}
        agentName="岗位匹配顾问"
        icon={Crosshair}
        runningDescription="正在拆解岗位要求,评估你的匹配度"
        failedDescription="这次匹配没有完成,你可以重试或修改 JD 后重新匹配"
        editLabel="修改 JD"
      />
    );
  } else if (formMode === "redo" || formMode === "edit" || (!hasReport && !failedRun)) {
    view = (
      <MatchForm
        initialJdText={formMode ? (lastInput.current ?? matching.data?.jdText ?? "") : ""}
        onSubmit={submit}
      />
    );
  } else if (hasReport && report) {
    view = (
      <MatchReport
        report={report}
        userRadar={userRadar.success ? userRadar.data : null}
        onCorrect={setCorrection}
        onRedo={() => enterFormMode("redo")}
      />
    );
  } else if (failedRun) {
    // 无报告时遇历史失败 run:失败恢复视图(刷新后仍可重试)
    view = (
      <AnalysisView
        run={failedRun}
        error={failedRun.error}
        onRetry={handleRetry}
        onEdit={() => enterFormMode("edit")}
        agentName="岗位匹配顾问"
        icon={Crosshair}
        runningDescription="正在拆解岗位要求,评估你的匹配度"
        failedDescription="这次匹配没有完成,你可以重试或修改 JD 后重新匹配"
        editLabel="修改 JD"
      />
    );
  } else {
    view = <MatchForm onSubmit={submit} />;
  }

  return (
    <>
      {view}
      <GapCorrectionDialog
        open={correction !== null}
        onOpenChange={(open) => {
          if (!open) setCorrection(null);
        }}
        requirementText={correction?.text ?? ""}
        onSubmit={handleCorrect}
      />
    </>
  );
}
