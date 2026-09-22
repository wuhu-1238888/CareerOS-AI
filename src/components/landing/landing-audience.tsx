// 适用人群(首页 ④):严格取自 user-persona.md 的 4 类人群(PRD P0-P3)。
// 每卡极简:人群标签 + 一个典型痛点 + 一句帮助(不再解释痛点细节,减少灰色小字)。
import { Check } from "lucide-react";
import { SectionHeading } from "./landing-section-heading";

const AUDIENCES = [
  {
    label: "大学生",
    pain: "方向迷茫，信息过载",
    solution: "3 分钟生成职业画像，从推荐方向开始探索",
  },
  {
    label: "应届生",
    pain: "简历表达差，匹配度未知",
    solution: "逐条优化简历，用匹配度看清差距",
  },
  {
    label: "0-3 年职场新人",
    pain: "想转型，能力不自信",
    solution: "能力对比 + 90 天提升计划，把差距变成任务",
  },
  {
    label: "转行人群",
    pain: "担心过往经历白费",
    solution: "重新定位方向，用可迁移能力重写表达",
  },
] as const;

export function LandingAudience() {
  return (
    <section aria-label="适用人群" className="py-12">
      <SectionHeading
        eyebrow="适合谁"
        title="无论你处于求职的哪个阶段"
        description="从第一次想「以后做什么」，到投递前的最后一轮面试准备。"
      />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {AUDIENCES.map(({ label, pain, solution }) => (
          <div key={label} className="rounded-card border border-hairline bg-surface p-6 shadow-card">
            <p className="text-[14px] font-semibold text-green-700">{label}</p>
            <h3 className="mt-2 text-h3 text-ink">{pain}</h3>
            <p className="mt-4 flex items-start gap-2 text-body-sm text-ink-secondary">
              <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
              {solution}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
