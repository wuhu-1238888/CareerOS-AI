"use client";
// 模拟面试对话界面(7.2,DesignRules「模拟面试页(7.2/7.3)」特许对话形态,全产品唯一聊天式布局):
// 面试官提问气泡(本轮新出现者打字机渲染,useTypewriter)+ 用户答案气泡(右)+ 每题评估卡
// (内容/表达分徽章 + 改进建议)+ 追问气泡与追问输入行(ghost「跳过追问」)+ 行为面 STAR 提示。
// 评估为等待式(答案先落库再评估):等待期「面试官正在思考」气泡(role=status),输入在途禁用;
// 评估失败答案保留 → 评估槽「重试评估」(evaluate 端点);全部答完 → 完成卡 + 结束面试 Dialog。
// 刷新恢复:已存在的消息整段渲染,仅本轮新出现的气泡打字机;长文本 break-words 不撑破容器。
// 布局(2026-09 优化):对话视图全宽继承 1160px 壳(w-full space-y-6 py-6,与结果视图一致),
// 页面单一纵向滚动(对话区无内嵌滚动)、顶部状态栏吸顶、输入为全宽 composer 卡。
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AiBadge } from "@/components/shared/ai-badge";
import { trpc } from "@/trpc/client";
import { useTypewriter } from "@/lib/design/use-typewriter";
import type { InterviewAnswerItem, InterviewQuestion } from "@/lib/interview/analysis-schemas";

function friendlyError(err: unknown): string {
  return err instanceof Error ? err.message : "操作失败,请稍后重试";
}

// 打字机文本(7.2):animate=false(恢复的历史消息)直接整段渲染;true 时逐字渲染并在完成回调。
// 2026-08:animate 透传进 hook——历史消息在 hook 内短路(不调度帧),消除大量并发 rAF 空转
function TypedText({ text, animate, onDone }: { text: string; animate: boolean; onDone?: () => void }) {
  const shown = useTypewriter(text, { animate, onDone });
  return <p className="break-words whitespace-pre-wrap">{shown}</p>;
}

// 面试官头像(48px 时仍用小尺寸;与 Hub 出题视图 Bot 图标一致)
function InterviewerAvatar() {
  return (
    <span
      aria-hidden
      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600"
    >
      <MessageSquareText className="size-4" />
    </span>
  );
}

// 每题评估卡:内容/表达分徽章(数值即文字通道,不依赖颜色区分)+ 改进建议
// (作答记录中的评估不含追问字段,传入 NonNullable<InterviewAnswerItem["evaluation"]>)
function EvaluationCard({ evaluation }: { evaluation: NonNullable<InterviewAnswerItem["evaluation"]> }) {
  return (
    <div className="rounded-2xl border border-hairline bg-sunken p-4">
      <div className="flex flex-wrap items-center gap-2">
        <AiBadge />
        <p className="text-body-sm font-medium text-ink">面试官点评</p>
        <span className="rounded-pill bg-surface px-2.5 py-1 text-body-sm text-ink">
          内容 <strong>{evaluation.contentScore}</strong>/10
        </span>
        <span className="rounded-pill bg-surface px-2.5 py-1 text-body-sm text-ink">
          表达 <strong>{evaluation.expressionScore}</strong>/10
        </span>
      </div>
      <p className="mt-2 break-words text-body-sm text-ink-secondary">
        {evaluation.improvementSuggestion}
      </p>
    </div>
  );
}

export function InterviewChat({
  session,
  onEnd,
  onViewReport,
}: {
  session: {
    interviewType: string;
    questionCount: number;
    targetPosition: string;
    status: string;
    questions: InterviewQuestion[] | null;
    currentQuestionIndex: number;
    answers: InterviewAnswerItem[] | null;
    /** 7.3 综合报告视图使用;对话视图不消费(序列化返回 unknown,防御解析由报告视图承担) */
    report?: unknown;
    updatedAt: string | Date;
  };
  /** 结束面试 → 生成综合报告(7.3 Hub 接 finish) */
  onEnd: () => void;
  /** 已完成场次(报告视图「返回对话」进入的只读回顾):查看综合报告 */
  onViewReport?: () => void;
}) {
  const utils = trpc.useUtils();
  const submitAnswer = trpc.interview.submitAnswer.useMutation();
  const evaluate = trpc.interview.evaluate.useMutation();
  const submitFollowUp = trpc.interview.submitFollowUp.useMutation();
  const skipFollowUp = trpc.interview.skipFollowUp.useMutation();

  const questions = session.questions ?? [];
  const answers = session.answers ?? [];
  const index = session.currentQuestionIndex;
  const allDone = index >= questions.length;
  const current = allDone ? null : questions[index];
  const currentEntry = current ? answers.find((a) => a.questionId === current.id) : undefined;
  // 已完成场次(报告视图「返回对话」进入):只读回顾,不再作答/结束
  const completed = session.status === "completed";

  // 本轮已打字完成的题目/追问 id:初始化即包含恢复的历史消息(已作答的题、已出现的追问),
  // 仅本轮新出现的气泡打字机;onDone 时登记(触发重渲染切整段渲染)
  const [typedQuestions, setTypedQuestions] = useState<Set<string>>(() => {
    const seen = new Set(questions.slice(0, index).map((q) => q.id));
    const currentQuestion = questions[index];
    if (currentQuestion && answers.some((a) => a.questionId === currentQuestion.id)) {
      seen.add(currentQuestion.id);
    }
    return seen;
  });
  const [typedFollowUps, setTypedFollowUps] = useState<Set<string>>(
    () => new Set(answers.filter((a) => a.followUpQuestion).map((a) => a.questionId))
  );

  const [draft, setDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  // 评估在途(提交答案含 LLM 评估;重试评估亦在途)→「面试官正在思考」气泡 + 输入禁用
  const [submitting, setSubmitting] = useState(false);
  const [retryingEval, setRetryingEval] = useState(false);
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  // 当前题评估失败文案(答案已落库、evaluation=null → 评估槽显示「重试评估」)
  const [evalError, setEvalError] = useState<string | null>(null);
  const [endOpen, setEndOpen] = useState(false);

  // 新内容(新消息/打字完成/思考气泡)出现时滚动到底部
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [
    index,
    answers.length,
    submitting,
    retryingEval,
    followUpSubmitting,
    typedQuestions.size,
    typedFollowUps.size,
  ]);

  const entry = currentEntry;
  const followUpPending =
    !allDone && !!entry?.evaluation && !!entry.followUpQuestion && entry.followUpAnswer === null;

  async function handleSend() {
    const answer = draft.trim();
    if (!answer || submitting || retryingEval) return;
    setDraft("");
    setEvalError(null);
    setSubmitting(true);
    try {
      await submitAnswer.mutateAsync({ answer });
      await utils.interview.get.invalidate();
    } catch (err) {
      // 答案已落库、评估失败:重读场次展示答案与「重试评估」(不永久卡在思考态)
      setEvalError(friendlyError(err));
      await utils.interview.get.refetch();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRetryEvaluation() {
    setEvalError(null);
    setRetryingEval(true);
    try {
      await evaluate.mutateAsync({ questionIndex: index });
      await utils.interview.get.invalidate();
    } catch (err) {
      setEvalError(friendlyError(err));
      await utils.interview.get.refetch();
    } finally {
      setRetryingEval(false);
    }
  }

  async function handleFollowUpSend() {
    const answer = followUpDraft.trim();
    if (!answer || followUpSubmitting) return;
    setFollowUpDraft("");
    setFollowUpSubmitting(true);
    try {
      await submitFollowUp.mutateAsync({ followUpAnswer: answer });
      await utils.interview.get.invalidate();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setFollowUpSubmitting(false);
    }
  }

  async function handleSkipFollowUp() {
    if (followUpSubmitting) return;
    setFollowUpSubmitting(true);
    try {
      await skipFollowUp.mutateAsync();
      await utils.interview.get.invalidate();
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setFollowUpSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 发送 / Shift+Enter 换行;isComposing 防中文输入法确认误发
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleFollowUpKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleFollowUpSend();
    }
  }

  const questionNumber = Math.min(index + 1, questions.length);
  const remaining = questions.length - index;

  return (
    <div className="w-full space-y-6 py-6">
      {/* 顶部:进度 / 场次信息 / 结束面试 */}
      <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-3 bg-canvas py-2">
        <div className="flex min-w-0 items-center gap-2 text-body-sm text-ink-secondary">
          <span className="font-medium text-ink">
            第 {questionNumber} / {questions.length} 题
          </span>
          <span aria-hidden>·</span>
          <span>{session.interviewType}</span>
          <span aria-hidden>·</span>
          <span className="truncate">{session.targetPosition}</span>
        </div>
        {completed ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onViewReport}
            disabled={!onViewReport}
          >
            查看综合报告
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => setEndOpen(true)}
            disabled={submitting || retryingEval || followUpSubmitting}
          >
            结束面试
          </Button>
        )}
      </div>

      {/* 对话区(特许形态):面试官左、用户右;历史消息整段,新气泡打字机。
          不用 role=log(隐式 live region 会逐字朗读打字机内容),状态播报由思考气泡 role=status 承担。
          全宽、页面级滚动、无内嵌滚动条(2026-09 布局优化,消除双重滚动) */}
      <section
        aria-label="面试对话"
        className="space-y-4 rounded-card border border-hairline bg-surface p-6 shadow-card"
      >
        {questions.slice(0, index + 1).map((q, i) => {
          const item = answers.find((a) => a.questionId === q.id);
          const isCurrent = i === index;
          return (
            <div key={q.id} className="space-y-3">
              {/* 面试官提问气泡 */}
              <div className="flex items-end gap-2">
                <InterviewerAvatar />
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-hairline bg-sunken px-4 py-3 text-body text-ink">
                  <span className="sr-only">面试官提问:</span>
                  <TypedText
                    text={q.question}
                    animate={isCurrent && !typedQuestions.has(q.id)}
                    onDone={() => setTypedQuestions((prev) => new Set(prev).add(q.id))}
                  />
                </div>
              </div>

              {/* 行为面 STAR 提示:仅当前未作答的题(可折叠,不打断对话;已完成场次只读不显示) */}
              {session.interviewType === "行为面" && isCurrent && !item && !allDone && !completed && (
                <details className="ml-10 max-w-[85%] rounded-control bg-sunken p-3 text-body-sm text-ink-secondary">
                  <summary className="cursor-pointer font-medium text-ink">
                    面试官提示:STAR 结构
                  </summary>
                  <p className="mt-2 break-words">
                    用「情境 Situation → 任务 Task → 行动 Action → 结果 Result」组织回答:
                    讲具体事例,补充可量化的结果数据,能显著提升行为面试得分。
                  </p>
                </details>
              )}

              {item && (
                <>
                  {/* 用户答案气泡(右) */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-green-600 px-4 py-3 text-body text-white">
                      <span className="sr-only">你的回答:</span>
                      <p className="break-words whitespace-pre-wrap">{item.answer}</p>
                    </div>
                  </div>

                  {/* 评估卡 / 失败重试槽(仅当前题) / 历史未评估注记 */}
                  {item.evaluation ? (
                    <EvaluationCard evaluation={item.evaluation} />
                  ) : isCurrent ? (
                    <div className="space-y-2 rounded-2xl border border-dashed border-hairline bg-sunken p-4">
                      <p role="alert" className="break-words text-body-sm text-danger">
                        {evalError ?? "评估未完成,你可以重试"}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRetryEvaluation}
                        disabled={retryingEval || submitting}
                      >
                        {retryingEval && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                        重试评估
                      </Button>
                    </div>
                  ) : (
                    <p className="text-caption text-ink-faint">该题未评估</p>
                  )}

                  {/* 追问气泡(新出现者打字机)/ 追问回答 / 跳过注记 */}
                  {item.followUpQuestion && (
                    <div className="flex items-end gap-2">
                      <InterviewerAvatar />
                      <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-hairline bg-sunken px-4 py-3 text-body text-ink">
                        <span className="sr-only">面试官追问:</span>
                        <TypedText
                          text={item.followUpQuestion}
                          animate={!typedFollowUps.has(q.id)}
                          onDone={() => setTypedFollowUps((prev) => new Set(prev).add(q.id))}
                        />
                      </div>
                    </div>
                  )}
                  {item.followUpAnswer != null && (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-green-600 px-4 py-3 text-body text-white">
                        <span className="sr-only">你的追问回答:</span>
                        <p className="break-words whitespace-pre-wrap">{item.followUpAnswer}</p>
                      </div>
                    </div>
                  )}
                  {!isCurrent && item.followUpQuestion && item.followUpAnswer === null && (
                    <p className="pl-10 text-caption text-ink-faint">已跳过追问</p>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* 等待期「面试官正在思考」气泡(评估在途,role=status 独立播报) */}
        {(submitting || retryingEval) && (
          <div className="flex items-end gap-2">
            <InterviewerAvatar />
            <div className="rounded-2xl rounded-bl-sm border border-hairline bg-sunken px-4 py-3">
              <p role="status" className="flex items-center gap-2 text-body-sm text-ink-muted">
                <Loader2 className="size-4 shrink-0 animate-spin text-green-600" aria-hidden />
                面试官正在思考…
              </p>
            </div>
          </div>
        )}

      </section>

      {/* 全部答完:完成卡(进行中 → 结束面试生成报告;已完成 → 直接查看报告) */}
      {allDone && (
        <div className="rounded-card border border-hairline bg-surface p-6 text-center shadow-card">
          <Check className="mx-auto size-8 text-green-600" aria-hidden />
          <h3 className="mt-2 text-h3 text-ink">全部 {questions.length} 题已完成</h3>
          <p className="mt-1 text-body-sm text-ink-secondary">
            {completed ? "本场面试已结束。" : "你的作答已保存,结束面试后 AI 将生成综合报告。"}
          </p>
          <Button
            className="mt-4"
            onClick={() => (completed ? onViewReport?.() : setEndOpen(true))}
            disabled={completed && !onViewReport}
          >
            {completed ? "查看综合报告" : "结束面试,查看综合报告"}
          </Button>
        </div>
      )}

      {/* 已完成但未答完(提前结束):只读回顾 + 结束注记 + 查看报告 */}
      {completed && !allDone && (
        <div className="rounded-card border border-hairline bg-surface p-6 text-center shadow-card">
          <h3 className="text-h3 text-ink">面试已结束</h3>
          <p className="mt-1 text-body-sm text-ink-secondary">
            未作答的 {questions.length - index} 道题不计入本次报告。
          </p>
          <Button className="mt-4" onClick={onViewReport} disabled={!onViewReport}>
            查看综合报告
          </Button>
        </div>
      )}

      {/* 输入区:追问待答时显示追问输入行,否则显示主作答输入(已完成场次只读,不渲染) */}
      {!allDone &&
        !completed &&
        (followUpPending ? (
          <div className="rounded-card border border-hairline bg-surface">
            <Textarea
              className="min-h-[72px] resize-y rounded-none border-0 px-4 pt-4 pb-2 shadow-none"
              placeholder="回答面试官的追问…(Enter 发送,Shift+Enter 换行)"
              aria-label="追问回答"
              rows={2}
              maxLength={2000}
              value={followUpDraft}
              onChange={(e) => setFollowUpDraft(e.target.value)}
              onKeyDown={handleFollowUpKeyDown}
              disabled={followUpSubmitting}
            />
            <div className="flex items-center justify-between gap-2 px-4 pb-3">
              <p className="text-caption text-ink-faint">{followUpDraft.length}/2000</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSkipFollowUp}
                  disabled={followUpSubmitting}
                >
                  跳过追问
                </Button>
                <Button
                  size="sm"
                  onClick={handleFollowUpSend}
                  disabled={followUpSubmitting || !followUpDraft.trim()}
                >
                  {followUpSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                  回答
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-hairline bg-surface">
            <Textarea
              className="min-h-[96px] resize-y rounded-none border-0 px-4 pt-4 pb-2 shadow-none"
              placeholder="输入你的回答…(Enter 发送,Shift+Enter 换行)"
              aria-label="你的回答"
              rows={3}
              maxLength={2000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={submitting || retryingEval}
            />
            <div className="flex items-center justify-between gap-2 px-4 pb-3">
              <p className="text-caption text-ink-faint">{draft.length}/2000</p>
              <Button onClick={handleSend} disabled={submitting || retryingEval || !draft.trim()}>
                {submitting && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {submitting ? "评估中" : "发送"}
              </Button>
            </div>
          </div>
        ))}

      {/* 自动滚底锚点(2026-09 布局优化:页面级滚动,置于根容器尾部保证输入区完整可见) */}
      <div ref={bottomRef} />

      {/* 结束面试确认 */}
      <Dialog open={endOpen} onOpenChange={setEndOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>结束本次面试?</DialogTitle>
            <DialogDescription>
              {allDone
                ? "AI 将基于你的全部作答生成综合报告。"
                : `还有 ${remaining} 题未作答,结束后未答题目不计入报告。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEndOpen(false)}>
              继续面试
            </Button>
            <Button
              onClick={() => {
                setEndOpen(false);
                onEnd();
              }}
            >
              结束面试
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
