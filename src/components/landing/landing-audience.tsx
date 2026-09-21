// 谁适合使用(首页 ⑥):以「用户带着什么问题来」为标题,人群映射严格取自 user-persona.md 的 4 类人群,
// 不虚构新群体。2×2 轻卡,快速阅读。
import { Check } from "lucide-react";
import { SectionHeading } from "./landing-section-heading";

const AUDIENCES = [
  {
    problem: "不知道自己适合什么岗位",
    audience: "常见于：大学生 · 转行人群",
    answer: "3 分钟生成职业画像，从推荐方向开始探索",
  },
  {
    problem: "有目标岗位，但不知道差距",
    audience: "常见于：应届生 · 0-3 年职场新人",
    answer: "粘贴 JD 拿到匹配度与差距清单，一键生成 90 天提升计划",
  },
  {
    problem: "有经历，但不会表达",
    audience: "常见于：应届生 · 转行人群",
    answer: "简历逐条优化 + ATS 评分，每处修改都告诉你为什么",
  },
  {
    problem: "准备面试，但不知道哪里会失分",
    audience: "常见于：应届生 · 0-3 年职场新人",
    answer: "个性化模拟面试：逐题反馈，结束拿到综合报告",
  },
] as const;

export function LandingAudience() {
  return (
    <section aria-label="谁适合使用" className="py-16 sm:py-20">
      <SectionHeading
        eyebrow="谁适合使用"
        title="你带着哪个问题来？"
        description="从第一次想「以后做什么」，到投递前的最后一轮面试准备。"
      />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {AUDIENCES.map(({ problem, audience, answer }) => (
          <div key={problem} className="rounded-card border border-hairline bg-surface p-6 shadow-card">
            <h3 className="text-h3 text-ink">{problem}</h3>
            <p className="mt-1 text-caption text-ink-muted">{audience}</p>
            <p className="mt-4 flex items-start gap-2 text-body-sm text-ink-secondary">
              <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
              {answer}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
