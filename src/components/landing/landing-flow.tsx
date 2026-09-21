// 产品闭环(首页 ③):五个环节如何首尾相连。顶部一行故事主线(认识自己→找到目标→补齐差距→优化材料→验证能力),
// 下方 5 张精简卡(模块名 + 产出单行)。与 ② 分工:②讲「为什么」,③讲「流程怎么走」,不重复展开。
// 图标与工作台顶栏同源(Search / Target / Route / FileText / MessageSquareText);桌面横向箭头相连,移动端纵向堆叠。
import { ArrowRight, ChevronDown, FileText, MessageSquareText, Route, Search, Target } from "lucide-react";
import { SectionHeading } from "./landing-section-heading";

const STEPS = [
  { icon: Search, name: "职业画像", output: "结构化画像 + 推荐方向" },
  { icon: Target, name: "岗位匹配", output: "匹配度 + 差距清单" },
  { icon: Route, name: "成长路线", output: "阶段化路线 + 每周任务" },
  { icon: FileText, name: "简历优化", output: "修改建议 + ATS 评分" },
  { icon: MessageSquareText, name: "模拟面试", output: "逐题反馈 + 综合报告" },
] as const;

// 故事主线:五个环节连起来回答的终极问题(收束语义,与 ② 的五个问题措辞区分)
const STORY_ARC = ["认识自己", "找到目标", "补齐差距", "优化材料", "验证能力"] as const;

export function LandingFlow() {
  return (
    <section aria-label="产品闭环" className="py-16 sm:py-20">
      <SectionHeading
        eyebrow="产品闭环"
        title="五个环节，首尾相连"
        description="上一环的结果是下一环的起点：求职的每一步，都用同一份画像与数据。"
      />

      {/* 顶部连接语义:一条主线 */}
      <p className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-body-sm text-ink-secondary">
        {STORY_ARC.map((label, index) => (
          <span key={label} className="flex items-center gap-x-2">
            {index > 0 ? <ArrowRight className="size-4 text-ink-faint" aria-hidden /> : null}
            {label}
          </span>
        ))}
      </p>

      <ol className="mt-8 grid gap-4 md:grid-cols-5">
        {STEPS.map(({ icon: Icon, name, output }, index) => (
          <li
            key={name}
            className="relative rounded-card border border-hairline bg-surface p-6 shadow-card"
          >
            {/* 桌面端横向箭头 / 移动端纵向箭头 */}
            {index < STEPS.length - 1 ? (
              <ArrowRight
                className="absolute -right-4 top-1/2 hidden size-4 -translate-y-1/2 text-ink-faint md:block"
                aria-hidden
              />
            ) : null}
            <p className="text-eyebrow text-green-600">{String(index + 1).padStart(2, "0")}</p>
            <div className="mt-3 flex size-10 items-center justify-center rounded-control bg-green-100 text-green-600">
              <Icon className="size-5" aria-hidden />
            </div>
            <h3 className="mt-4 text-h3 text-ink">{name}</h3>
            <p className="mt-2 text-body-sm text-ink-muted">{output}</p>
            {index < STEPS.length - 1 ? (
              <ChevronDown className="mx-auto mt-4 size-4 text-ink-faint md:hidden" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
