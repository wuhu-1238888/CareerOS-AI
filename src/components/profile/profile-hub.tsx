"use client";
// 职业画像页状态枢纽(2.2 起,2.4 接入分析管线,2.5 接入结果视图,2.6 接入纠偏):
// 加载骨架 / 采集表单 / 分析过程 / 结果视图。
// 分析态统一轮询 profile.latestRun(700ms,进度事件已随执行落库):分析中刷新页面按最近 run 恢复;
// 失败态提供「重试」(会话内用最近一次提交数据;刷新后服务端从 AgentRun.input 重放)与「修改信息」(草稿保留)。
// 纠偏(2.6):弹窗收集反馈 → Toast → 全量重算(分析与纠偏共用同一管线,产生新版本)。
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";
import { ProfileForm } from "./profile-form";
import { AnalysisView } from "./analysis-view";
import { ProfileResult } from "./profile-result";
import { CorrectionDialog } from "./correction-dialog";
import type { ProfileData } from "@/lib/profile/schemas";
import type { CorrectionFeedback } from "@/lib/profile/pipeline";

function friendlyError(err: unknown): string {
  return err instanceof Error ? err.message : "分析失败,请稍后重试";
}

export function ProfileHub() {
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const profile = trpc.profile.get.useQuery();
  const analyze = trpc.profile.analyze.useMutation();
  const retry = trpc.profile.retry.useMutation();

  // 本次会话提交状态:submitted=true 表示分析 mutation 在途;analyzeError 为失败文案(驱动失败视图);
  // formMode:用户主动进入表单(失败视图「修改信息」/ 结果页「更新信息」),忽略历史 failed run(刷新后仍按失败恢复)
  const [submitted, setSubmitted] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<null | "edit" | "update">(null);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const lastInput = useRef<{ data: ProfileData; feedback?: CorrectionFeedback } | null>(null);
  const finishedRef = useRef(false);

  const hasResult = !!profile.data?.aiAnalysis;

  // 跟踪最近一次 run:无结果(首建/恢复)或提交在途(纠偏重算)时启用;仅 running/在途时轮询 700ms
  const latestRun = trpc.profile.latestRun.useQuery(undefined, {
    enabled: !profile.isLoading && (!hasResult || submitted),
    refetchInterval: (query) =>
      submitted || query.state.data?.status === "running" ? 700 : false,
  });

  // 恢复路径:刷新后 run 已 succeeded(管线已完成)→ 刷新画像进入结果视图
  useEffect(() => {
    if (!hasResult && latestRun.data?.status === "succeeded" && !finishedRef.current) {
      finishedRef.current = true;
      void utils.profile.get.invalidate();
    }
  }, [hasResult, latestRun.data?.status, utils]);

  if (me.isLoading || profile.isLoading || !me.data) {
    return (
      <div className="mx-auto w-full max-w-[640px] space-y-4 px-4 py-6" aria-label="加载中">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const draftKey = `careeros:profile-draft:${me.data.id}`;
  // 仅「无结果」时进入恢复等待:提交成功后画像已刷新(hasResult=true),轮询缓存的 running
  // 状态是过期的,不应再把视图钉在分析过程页(修复:提交成功后卡在 60%、需手动刷新才出结果)
  const recovering = !analyzeError && !hasResult && latestRun.data?.status === "running";
  const failedRun =
    !formMode && !analyzeError && latestRun.data?.status === "failed" ? latestRun.data : null;

  // 在途提交时忽略历史 run(避免把上次失败的旧 run 当作本次状态),等待轮询发现新 run
  const runForView =
    submitted && latestRun.data && latestRun.data.status !== "running"
      ? null
      : (latestRun.data ?? null);

  async function submit(data: ProfileData, feedback?: CorrectionFeedback) {
    lastInput.current = { data, feedback };
    finishedRef.current = false;
    setAnalyzeError(null);
    setFormMode(null);
    setSubmitted(true);
    try {
      await analyze.mutateAsync({ ...data, feedback });
      await utils.profile.get.invalidate();
    } catch (err) {
      setAnalyzeError(friendlyError(err));
      // 向表单抛出以保留草稿(表单仅在提交成功时清除 localStorage)
      throw err;
    } finally {
      setSubmitted(false);
    }
  }

  async function handleRetry() {
    // 会话内失败:直接用最近一次提交的数据(含纠偏反馈)重试
    if (lastInput.current) {
      const { data, feedback } = lastInput.current;
      await submit(data, feedback).catch(() => undefined);
      return;
    }
    // 刷新后恢复:服务端从失败 run 的 input 重放分析
    if (!failedRun) {
      setAnalyzeError("分析任务不存在,请重新填写");
      return;
    }
    finishedRef.current = false;
    setAnalyzeError(null);
    setSubmitted(true);
    try {
      await retry.mutateAsync({ runId: failedRun.id });
      await utils.profile.get.invalidate();
    } catch (err) {
      setAnalyzeError(friendlyError(err));
    } finally {
      setSubmitted(false);
    }
  }

  // 主动进入表单:清掉会话内提交痕迹,失败视图「修改信息」(edit)与结果页「更新信息」(update)共用
  function enterFormMode(mode: "edit" | "update") {
    lastInput.current = null;
    setAnalyzeError(null);
    setFormMode(mode);
  }

  // 纠偏(2.6):Toast 确认后全量重算;失败进入分析失败视图(重试/修改信息)
  async function handleCorrect(feedback: CorrectionFeedback) {
    const data = lastInput.current?.data ?? profile.data?.data;
    if (!data) {
      toast.error("画像数据不存在,请重新填写");
      return;
    }
    toast("已记录,AI 将重新分析");
    await submit(data, feedback).catch(() => undefined);
  }

  let view: React.ReactNode;
  if (submitted || recovering || analyzeError) {
    // 分析在途或本次会话失败(含纠偏重算):优先级高于结果视图
    view = (
      <AnalysisView
        run={runForView}
        error={analyzeError}
        onRetry={handleRetry}
        onEdit={() => enterFormMode("edit")}
      />
    );
  } else if (formMode) {
    // 主动更新(2.7):预填最新版本数据;提交走同一分析管线产生新版本
    view = (
      <ProfileForm
        initialData={profile.data?.data}
        draftKey={draftKey}
        onSubmit={submit}
        title={formMode === "update" ? "更新画像信息" : undefined}
      />
    );
  } else if (hasResult && profile.data) {
    view = (
      <ProfileResult
        initial={profile.data}
        onCorrect={() => setCorrectionOpen(true)}
        onUpdate={() => enterFormMode("update")}
      />
    );
  } else if (failedRun) {
    // 无结果时遇历史失败 run:失败恢复视图(刷新后仍可重试)
    view = (
      <AnalysisView
        run={failedRun}
        error={failedRun.error}
        onRetry={handleRetry}
        onEdit={() => enterFormMode("edit")}
      />
    );
  } else {
    view = (
      <ProfileForm initialData={profile.data?.data} draftKey={draftKey} onSubmit={submit} />
    );
  }

  return (
    <>
      {view}
      <CorrectionDialog
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
        onSubmit={handleCorrect}
      />
    </>
  );
}
