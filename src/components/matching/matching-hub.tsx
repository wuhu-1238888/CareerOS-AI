"use client";
// 岗位匹配页状态枢纽(6.2):无画像引导 / JD 表单 / 匹配过程 / 匹配报告 / 失败恢复。
// 镜像 profile-hub 状态机:匹配态统一轮询 matching.latestRun({intent:"analyze-match"})(700ms,
// 进度事件已随执行落库):分析中刷新页面按最近 run 恢复;
// 失败态提供「重试」(会话内用最近一次 JD;刷新后服务端从 AgentRun.input 重放)与「修改 JD」。
// 纠偏(6.2)「这个要求我其实满足」:弹窗收集说明 → Toast → 以落库 JD 原文重新匹配。
// 技能分析(6.4)扩展视图态:coach-setup(设定表单,差距清单/能力基线服务端自动带出)
// / coach 分析中(轮询 build-coach-plan)/ coach-plan(已有计划时报告 CTA 变「查看 90 天提升计划」)。
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Crosshair, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { trpc } from "@/trpc/client";
import { MatchForm } from "./match-form";
import { MatchReport } from "./match-report";
import { GapCorrectionDialog } from "./gap-correction-dialog";
import { CoachSetup, type CoachSetupValues } from "@/components/coach/coach-setup";
import { CoachPlanView } from "@/components/coach/coach-plan";
import { AnalysisView } from "@/components/profile/analysis-view";
import { matchAnalysisSchema, profileRadarSchema } from "@/lib/matching/analysis-schemas";
import { coachPlanSchema } from "@/lib/coach/analysis-schemas";

function friendlyError(err: unknown): string {
  return err instanceof Error ? err.message : "匹配失败,请稍后重试";
}

export function MatchingHub() {
  const utils = trpc.useUtils();
  const profile = trpc.profile.get.useQuery();
  const matching = trpc.matching.get.useQuery();
  // 技能分析设定预填(6.4):每周投入与 Navigator 对齐(无路线图时默认 10)
  const roadmap = trpc.navigator.roadmap.get.useQuery();
  const run = trpc.matching.run.useMutation();
  const retry = trpc.matching.retry.useMutation();
  const correct = trpc.matching.correct.useMutation();
  const coachRun = trpc.matching.coach.useMutation();

  // 本次会话提交状态:submitted=true 表示匹配 mutation 在途;matchError 为失败文案(驱动失败视图)
  const [submitted, setSubmitted] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [formMode, setFormMode] = useState<null | "edit" | "redo">(null);
  const [correction, setCorrection] = useState<{ id: string; text: string } | null>(null);
  // 技能分析视图态(6.4):setup 设定表单 / running 分析中 / plan 计划视图;null = 报告视图
  const [coachView, setCoachView] = useState<null | "setup" | "running" | "plan">(null);
  const [coachError, setCoachError] = useState<string | null>(null);
  const lastInput = useRef<string | null>(null);
  const lastCoachInput = useRef<CoachSetupValues | null>(null);
  const finishedRef = useRef(false);
  const coachFinishedRef = useRef(false);

  // 报告渲染前防御解析(DB 回读不直接信任);损坏按无报告处理
  const parsedReport = matchAnalysisSchema.safeParse(matching.data?.matchReport);
  const report = parsedReport.success ? parsedReport.data : null;
  const hasReport = !!report;
  // 教练计划防御解析(6.4):损坏按无计划处理,CTA 回到「生成」
  const parsedCoachPlan = coachPlanSchema.safeParse(matching.data?.coachPlan);
  const coachPlan = parsedCoachPlan.success ? parsedCoachPlan.data : null;
  const hasCoachPlan = !!coachPlan;
  // 用户线雷达:最新画像 aiAnalysis.radar 防御解析(画像存在但分析损坏 → 仅岗位线)
  const userRadar = profileRadarSchema.safeParse(
    (profile.data?.aiAnalysis as { radar?: unknown } | null)?.radar
  );

  // 跟踪最近一次匹配 run:无报告(首建/恢复)或提交在途时启用;仅 running/在途时轮询 700ms
  const latestRun = trpc.matching.latestRun.useQuery(
    { intent: "analyze-match" },
    {
      enabled: !matching.isLoading && (!hasReport || submitted),
      refetchInterval: (query) =>
        submitted || query.state.data?.status === "running" ? 700 : false,
    }
  );

  // 跟踪最近一次教练 run(6.4):报告视图即启用(CTA 需判断在途),仅教练在途/running 时轮询 700ms
  const latestRunCoach = trpc.matching.latestRun.useQuery(
    { intent: "build-coach-plan" },
    {
      enabled: hasReport,
      refetchInterval: (query) =>
        coachView === "running" || query.state.data?.status === "running" ? 700 : false,
    }
  );

  // 恢复路径:刷新后 run 已 succeeded(管线已完成)→ 刷新匹配记录进入报告视图
  useEffect(() => {
    if (!hasReport && latestRun.data?.status === "succeeded" && !finishedRef.current) {
      finishedRef.current = true;
      void utils.matching.get.invalidate();
    }
  }, [hasReport, latestRun.data?.status, utils]);

  // 教练 run 完成路径(6.4):分析中(running 视图)时 succeeded → 刷新匹配记录并进计划视图;
  // 报告视图下后台完成(如刷新后恢复)→ 仅刷新记录(CTA 文案变「查看」)
  useEffect(() => {
    if (latestRunCoach.data?.status !== "succeeded" || coachFinishedRef.current) return;
    coachFinishedRef.current = true;
    if (coachView === "running") {
      void (async () => {
        await utils.matching.get.refetch();
        setCoachView("plan");
      })();
    } else if (coachView === null && !hasCoachPlan) {
      void utils.matching.get.invalidate();
    }
  }, [coachView, latestRunCoach.data?.status, hasCoachPlan, utils]);

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
  // 教练失败 run(6.4):刷新后恢复重试的依据
  const failedCoachRun =
    !coachError && latestRunCoach.data?.status === "failed" ? latestRunCoach.data : null;

  // 在途提交时忽略历史 run(避免把上次失败的旧 run 当作本次状态),等待轮询发现新 run
  const runForView =
    submitted && latestRun.data && latestRun.data.status !== "running"
      ? null
      : (latestRun.data ?? null);

  // 教练视图的 run(6.4):在途提交时忽略历史 run,等待轮询发现新 run
  const coachRunForView =
    coachView === "running" &&
    !coachError &&
    latestRunCoach.data &&
    latestRunCoach.data.status !== "running"
      ? null
      : (latestRunCoach.data ?? null);

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

  // 技能分析入口(6.4):已有计划 → 计划视图;教练在途 → 分析视图;否则设定表单
  function handleCoach() {
    lastCoachInput.current = null;
    coachFinishedRef.current = false;
    setCoachError(null);
    if (hasCoachPlan) {
      setCoachView("plan");
      return;
    }
    if (latestRunCoach.data?.status === "running") {
      setCoachView("running");
      return;
    }
    setCoachView("setup");
  }

  // 提交教练设定(6.4):差距清单与能力基线由服务端组装;成功后刷新记录并进计划视图
  async function submitCoach(values: CoachSetupValues) {
    lastCoachInput.current = values;
    coachFinishedRef.current = false;
    setCoachError(null);
    setCoachView("running");
    try {
      await coachRun.mutateAsync({
        targetPosition: values.targetPosition,
        weeklyHours: values.weeklyHours,
        learningPreference: values.learningPreference || undefined,
      });
      await utils.matching.get.refetch();
      setCoachView("plan");
    } catch (err) {
      setCoachError(friendlyError(err));
    }
  }

  async function handleCoachRetry() {
    // 会话内失败:直接用最近一次提交的设定重试(覆盖 echo 校验失败等 run 已 succeeded 的边缘态)
    if (lastCoachInput.current) {
      await submitCoach(lastCoachInput.current);
      return;
    }
    // 刷新后恢复:服务端从失败 run 的 input 重放教练
    if (!failedCoachRun) {
      setCoachError("教练任务不存在,请重新生成提升计划");
      return;
    }
    coachFinishedRef.current = false;
    setCoachError(null);
    setCoachView("running");
    try {
      await retry.mutateAsync({ runId: failedCoachRun.id });
      await utils.matching.get.refetch();
      setCoachView("plan");
    } catch (err) {
      setCoachError(friendlyError(err));
    }
  }

  let view: React.ReactNode;
  if (coachView === "setup") {
    view = (
      <CoachSetup
        initialValues={
          lastCoachInput.current
            ? lastCoachInput.current
            : {
                targetPosition: matching.data?.jdTitle ?? "",
                weeklyHours: roadmap.data?.weeklyHours ?? 10,
                learningPreference: "",
              }
        }
        onSubmit={submitCoach}
      />
    );
  } else if (coachView === "running" || (coachView === "plan" && !coachPlan)) {
    view = (
      <AnalysisView
        run={coachRunForView}
        error={coachError}
        onRetry={handleCoachRetry}
        onEdit={() => {
          setCoachError(null);
          setCoachView("setup");
        }}
        agentName="技能教练"
        icon={GraduationCap}
        runningDescription="正在制定差距优先级与 13 周学习计划"
        failedDescription="这次提升计划没有生成,你可以重试或修改设定后重新生成"
        editLabel="修改设定"
      />
    );
  } else if (coachView === "plan" && coachPlan) {
    view = (
      <CoachPlanView
        plan={coachPlan}
        targetPosition={lastCoachInput.current?.targetPosition ?? matching.data?.jdTitle ?? ""}
        onBack={() => setCoachView(null)}
      />
    );
  } else if (submitted || recovering || matchError) {
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
        onCoach={handleCoach}
        coachExists={hasCoachPlan}
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
