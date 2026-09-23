// 产品闭环(首页 ②):画像 → 匹配 → 路线 → 简历 → 面试 五步,每卡「编号 + 图标 + 标题 + 一句短描述」,
// 让用户 3 秒看懂完整闭环,不解释产品机制(细节由 AI 区块与游客预览承担)。
// 图标与工作台顶栏同源(Search / Target / Route / FileText / MessageSquareText);桌面横向箭头相连,移动端纵向堆叠。
import { ArrowRight, ChevronDown, FileText, MessageSquareText, Route, Search, Target } from "lucide-react";
import { SectionHeading } from "./landing-section-heading";

const STEPS = [
  { icon: Search, name: "职业画像", desc: "了解你的优势与发展方向" },
  { icon: Target, name: "岗位匹配", desc: "找到与你匹配的目标岗位" },
  { icon: Route, name: "成长路线", desc: "明确下一阶段的成长路径" },
  { icon: FileText, name: "简历优化", desc: "让经历更贴合目标岗位" },
  { icon: MessageSquareText, name: "模拟面试", desc: "针对目标岗位进行面试准备" },
] as const;

export function LandingFlow() {
  return (
    <section id="loop" aria-label="产品闭环" className="scroll-mt-20 py-10">
      <SectionHeading
        eyebrow="产品闭环"
        title="从职业定位，到真正拿到目标岗位"
        description="五个环节首尾相连：先看清自己，再补上差距，最后在简历与面试里把它表达出来。"
      />
      <ol className="mt-8 grid gap-4 md:grid-cols-5">
        {STEPS.map(({ icon: Icon, name, desc }, index) => (
          <li
            key={name}
            className="relative rounded-card border border-hairline bg-surface p-5 shadow-card"
          >
            {/* 桌面端横向箭头 / 移动端纵向箭头 */}
            {index < STEPS.length - 1 ? (
              <ArrowRight
                className="absolute -right-4 top-1/2 hidden size-4 -translate-y-1/2 text-ink-faint md:block"
                aria-hidden
              />
            ) : null}
            <p className="text-[14px] font-semibold text-green-600">{String(index + 1).padStart(2, "0")}</p>
            <div className="mt-2.5 flex size-10 items-center justify-center rounded-control bg-green-100 text-green-600">
              <Icon className="size-5" aria-hidden />
            </div>
            <h3 className="mt-2.5 text-h3 text-ink">{name}</h3>
            <p className="mt-1.5 text-body-sm text-ink-muted">{desc}</p>
            {index < STEPS.length - 1 ? (
              <ChevronDown className="mx-auto mt-3 size-4 text-ink-faint md:hidden" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
