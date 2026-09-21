// CareerOS 工作方式(首页 ②):先讲「为什么五个环节必须连在一起」——每个环节回答一个职业问题,
// 上一环的结果是下一环的起点。左 sticky 标题说明 + 右问答列表;与 ③ 流程图措辞分工(②讲为什么,③讲流程)。
// 段尾一个 ghost 锚点引导到产品截图区(上下文 CTA,全页仅此一处)。
import { ArrowDown } from "lucide-react";

const STEPS = [
  {
    question: "我适合做什么？",
    answer: "3 分钟完成职业画像，拿到六维能力雷达与推荐方向。",
  },
  {
    question: "目标岗位要什么？",
    answer: "粘贴 JD，AI 逐项对比岗位要求与你的能力，给出匹配度与差距清单。",
  },
  {
    question: "我还缺什么？",
    answer: "阶段化成长路线，把差距拆成每周可执行的任务。",
  },
  {
    question: "怎么把经历说清楚？",
    answer: "简历逐条优化，每一处修改都告诉你为什么，附 ATS 评分。",
  },
  {
    question: "面试表现怎么样？",
    answer: "基于简历与目标岗位个性化出题，逐题作答、逐题反馈。",
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" aria-label="CareerOS 工作方式" className="scroll-mt-20 py-16 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
        {/* 左列:桌面端 sticky 的叙事说明 */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-eyebrow text-green-600">CareerOS 工作方式</p>
          <h2 className="mt-2 text-h1 text-ink">从职业定位，到真正走到目标岗位</h2>
          <p className="mt-3 text-body text-ink-muted">
            职业发展不是一条直线。CareerOS
            把求职拆成五个环环相扣的环节，每个环节回答一个关键问题：上一环的结果，就是下一环的起点。
          </p>
          <a
            href="#showcase"
            className="mt-6 inline-flex items-center gap-1.5 rounded-control text-body-sm text-green-600 transition-colors hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            直接看真实产品界面
            <ArrowDown className="size-4" aria-hidden />
          </a>
        </div>

        {/* 右列:五个问题 → 回答 */}
        <ol className="divide-y divide-hairline">
          {STEPS.map((step, index) => (
            <li key={step.question} className="flex gap-4 py-5 first:pt-0 last:pb-0">
              <span className="text-eyebrow text-green-600">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="text-h3 text-ink">{step.question}</h3>
                <p className="mt-1 text-body text-ink-muted">{step.answer}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
