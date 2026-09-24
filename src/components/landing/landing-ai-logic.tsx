// AI 决策逻辑(首页 ③):理解 → 分析 → 决策 → 行动 四列,不堆技术名词。
// 差异化主张:AI 不只生成内容,而是给出有理由的职业决策,并把决策转化为行动。
// 「分析」是 AI 语义内容 → 合法使用 ai-badge 与 ai-insight 紫底(DesignRules AI 视觉白名单;
// 用户明确裁定保留紫底,作为本 section 唯一的强调卡);「决策」为普通白卡,不再用绿色底强调。
import { ArrowRight, Check, Compass, ListChecks, ScanSearch } from "lucide-react";
import { AiBadge } from "@/components/shared/ai-badge";
import { SectionHeading } from "./landing-section-heading";

const UNDERSTAND = ["教育背景", "技能", "项目与工作经历", "目标岗位"];
const ANALYZE = ["能力优势与短板", "岗位要求", "匹配程度", "成长差距"];
const DECIDE = ["职业方向", "岗位选择", "成长优先级", "下一阶段目标"];
const ACTIONS = ["成长任务", "简历优化建议", "面试准备", "后续反馈与 AI 调整"];

export function LandingAiLogic() {
  return (
    <section id="ai-how" aria-label="AI 决策逻辑" className="scroll-mt-24 py-12">
      <SectionHeading
        eyebrow="AI 如何工作"
        title="AI 不只生成内容，更帮你做职业决策"
        description="它先理解你的背景，再给出有理由的结论——选哪个方向、投哪个岗位，最后把每个结论变成今天就能做的动作。"
      />
      <div className="mt-8 grid gap-6 md:grid-cols-4">
        {/* 01 理解 */}
        <div className="relative rounded-card border border-hairline bg-surface p-5 shadow-card">
          <ArrowRight
            className="absolute -right-5 top-1/2 hidden size-4 -translate-y-1/2 text-ink-faint md:block"
            aria-hidden
          />
          <div className="flex items-center gap-2">
            <ScanSearch className="size-4 text-green-600" aria-hidden />
            <h3 className="text-h3 text-ink">理解</h3>
          </div>
          <p className="mt-1 text-caption text-ink-muted">你只需要提供这些信息</p>
          <ul className="mt-3 space-y-1.5">
            {UNDERSTAND.map((item) => (
              <li key={item} className="flex items-center gap-2 text-body-sm text-ink-secondary">
                <span className="size-1.5 rounded-full bg-hairline-strong" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 02 分析(AI 语义:ai-insight 视觉) */}
        <div className="relative rounded-r-control border-l-[3px] border-l-violet-400 bg-violet-50 p-5">
          <ArrowRight
            className="absolute -right-5 top-1/2 hidden size-4 -translate-y-1/2 text-ink-faint md:block"
            aria-hidden
          />
          <AiBadge>AI 分析</AiBadge>
          <p className="mt-2 text-caption text-ink-muted">AI 把你的信息与岗位要求放在一起比对</p>
          <ul className="mt-3 space-y-1.5">
            {ANALYZE.map((item) => (
              <li key={item} className="flex items-center gap-2 text-body-sm text-ink-secondary">
                <span className="size-1.5 rounded-full bg-violet-400" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 03 决策(标准白卡:全 section 只让「分析」一张卡带色底,视觉重心落在 AI 分析) */}
        <div className="relative rounded-card border border-hairline bg-surface p-5 shadow-card">
          <ArrowRight
            className="absolute -right-5 top-1/2 hidden size-4 -translate-y-1/2 text-ink-faint md:block"
            aria-hidden
          />
          <div className="flex items-center gap-2">
            <Compass className="size-4 text-green-600" aria-hidden />
            <h3 className="text-h3 text-ink">决策</h3>
          </div>
          <p className="mt-1 text-caption text-ink-muted">在分析之上，给出结论与理由</p>
          <ul className="mt-3 space-y-1.5">
            {DECIDE.map((item) => (
              <li key={item} className="flex items-center gap-2 text-body-sm text-ink-secondary">
                <span className="size-1.5 rounded-full bg-green-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* 04 行动 */}
        <div className="rounded-card border border-hairline bg-surface p-5 shadow-card">
          <div className="flex items-center gap-2">
            <ListChecks className="size-4 text-green-600" aria-hidden />
            <h3 className="text-h3 text-ink">行动</h3>
          </div>
          <p className="mt-1 text-caption text-ink-muted">每个结论都变成今天就能做的动作</p>
          <ul className="mt-3 space-y-1.5">
            {ACTIONS.map((item) => (
              <li key={item} className="flex items-center gap-2 text-body-sm text-ink-secondary">
                <Check className="size-4 shrink-0 text-green-600" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
