"use client";
// 模拟面试综合报告视图(7.3):①Hero(面试类型/岗位 + 内容/表达能力均分大数字,显式「/ 10」
// 明示 10 分制 + 动态「已评估 X / N 题」注记;均分由前端对已评估题确定性计算——
// 报告 Agent 只产出定性内容)②总体评价 ③突出优势列表
// ④主要短板列表 ⑤重点改进方向卡(ai-insight 视觉)⑥底部操作:ghost「返回对话」
// + 主行动「开始新面试」(确认 Dialog,覆盖式新建由 Hub 处理)。
// report null(服务端防御解析失败)→ 兜底卡片 + 开始新面试,不报错。
import { useState } from "react";
import { Check, Target, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiBadge } from "@/components/shared/ai-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InterviewAnswerItem, InterviewReport as InterviewReportData } from "@/lib/interview/analysis-schemas";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-h2 text-ink">{children}</h2>;
}

export function InterviewReport({
  session,
  onBackToChat,
  onNewInterview,
}: {
  session: {
    interviewType: string;
    targetPosition: string;
    /** 本场题目总数(注记分母,来自 interview.get 的 questionCount) */
    questionCount: number;
    answers: InterviewAnswerItem[] | null;
    report: InterviewReportData | null;
  };
  /** 返回对话查看完整作答记录 */
  onBackToChat: () => void;
  /** 开始新面试(覆盖本场记录,确认 Dialog 在本组件内) */
  onNewInterview: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const report = session.report;
  const questionCount = session.questionCount;

  // 均分确定性计算:仅含已评估题(未评估题不计入分母)
  const evaluated = (session.answers ?? []).filter((a) => a.evaluation);
  const avgContent = evaluated.length
    ? evaluated.reduce((sum, a) => sum + a.evaluation!.contentScore, 0) / evaluated.length
    : null;
  const avgExpression = evaluated.length
    ? evaluated.reduce((sum, a) => sum + a.evaluation!.expressionScore, 0) / evaluated.length
    : null;

  return (
    <div className="w-full space-y-6 py-6">
      {/* ① Hero:AI 标识 + 报告标题 + 场次信息 + 均分大数字 */}
      <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <AiBadge />
              <h1 className="text-h1 text-ink">模拟面试综合报告</h1>
            </div>
            <p className="mt-1 text-body text-ink-muted">
              {session.interviewType} · {session.targetPosition}
            </p>
          </div>
          {avgContent !== null && avgExpression !== null ? (
            /* 评分摘要:双列横排(数字 + 标签上下成组),一行注记居中于下方 */
            <div className="flex shrink-0 flex-col items-center">
              <div className="flex items-start gap-8">
                <div className="text-center">
                  <p className="text-num text-green-600">
                    <span>{avgContent.toFixed(1)}</span>
                    <span className="ml-1 text-body-lg text-ink-muted">/ 10</span>
                  </p>
                  <p className="mt-1 text-body-sm text-ink-muted">内容能力</p>
                </div>
                <div className="text-center">
                  <p className="text-num text-green-600">
                    <span>{avgExpression.toFixed(1)}</span>
                    <span className="ml-1 text-body-lg text-ink-muted">/ 10</span>
                  </p>
                  <p className="mt-1 text-body-sm text-ink-muted">表达能力</p>
                </div>
              </div>
              <p className="mt-3 text-caption text-ink-muted">
                已评估 {evaluated.length} / {questionCount} 题
                {evaluated.length >= questionCount ? " · 面试评分已完成" : " · 阶段性评分"}
              </p>
            </div>
          ) : (
            /* 0 道已评估:不渲染虚假的 0.0 分数,仅提示暂无评分 */
            <div className="shrink-0 text-right">
              <p className="mt-1 text-caption text-ink-muted">
                已评估 0 / {questionCount} 题 · 本场暂无评分
              </p>
            </div>
          )}
        </div>
      </section>

      {report ? (
        <>
          {/* ② 总体评价 */}
          <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
            <SectionTitle>总体评价</SectionTitle>
            <p className="mt-3 break-words text-body text-ink-secondary">{report.overallEvaluation}</p>
          </section>

          {/* ③ 突出优势 + ④ 主要短板(并列两卡,窄屏堆叠) */}
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
              <SectionTitle>突出优势</SectionTitle>
              <ul className="mt-3 space-y-2">
                {report.strengths.map((strength, index) => (
                  <li key={`strength-${index}`} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                    <p className="break-words text-body-sm text-ink">{strength}</p>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
              <SectionTitle>主要短板</SectionTitle>
              <ul className="mt-3 space-y-2">
                {report.weaknesses.map((weakness, index) => (
                  <li key={`weakness-${index}`} className="flex items-start gap-2">
                    <X className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                    <p className="break-words text-body-sm text-ink">{weakness}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* ⑤ 重点改进方向:ai-insight 视觉(紫底紫边 + AI 标识,镜像匹配报告隐性需求卡) */}
          <section className="rounded-r-control border-l-[3px] border-l-violet-400 bg-violet-50 p-6">
            <div className="flex items-center gap-2">
              <AiBadge>AI 建议</AiBadge>
              <h2 className="text-h2 text-ink">重点改进方向</h2>
            </div>
            <ul className="mt-3 space-y-3">
              {report.keyImprovements.map((improvement, index) => (
                <li key={`improvement-${index}`} className="flex items-start gap-2">
                  <Target className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden />
                  <p className="break-words text-body text-ink">{improvement}</p>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        /* 报告不可用兜底(服务端防御解析失败等边缘态):不报错,可开始新面试 */
        <section className="rounded-card border border-hairline bg-surface p-6 text-center shadow-card">
          <p className="text-body text-ink">综合报告不可用</p>
          <p className="mt-1 text-body-sm text-ink-secondary">
            报告数据缺失或损坏,你的作答记录仍保存在对话中。
          </p>
        </section>
      )}

      {/* ⑥ 底部操作:返回对话 + 开始新面试(确认) */}
      <section className="rounded-card bg-sunken p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <SectionTitle>下一步</SectionTitle>
            <p className="mt-1 text-body-sm text-ink-muted">
              回顾对话中的作答与逐题点评,或开始一场新的面试
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBackToChat}>
              返回对话
            </Button>
            <Button onClick={() => setConfirmOpen(true)}>开始新面试</Button>
          </div>
        </div>
      </section>

      {/* 开始新面试确认:覆盖本场记录(单行模型) */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>开始新面试?</DialogTitle>
            <DialogDescription>
              开始新面试将覆盖本场面试的全部记录,本次综合报告将无法再查看。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                onNewInterview();
              }}
            >
              开始新面试
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
