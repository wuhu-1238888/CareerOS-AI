// 「下一步建议」行动卡(工作台导航优化 P0):green-50 底 + 左 3px green-600 边(复用简历分析页
// 「建议采纳」视觉语言,resume-analysis-card.tsx:64-69)+ Compass 图标 + 眉标/主行动/说明 + 主 CTA。
// 轻量横幅式区块:非整卡染色、非 Hero、无 AI 紫、无渐变;数据与文案由 dashboard-view 的
// computeNextStep 规则链注入(基于真实业务状态,不引入 AI 推荐系统)。
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NextStepCard({
  title,
  text,
  href,
  cta,
}: {
  /** 主行动(如「继续推进成长路线」) */
  title: string;
  /** 一句话说明(如「完成当前阶段任务,逐步提升目标岗位匹配度」) */
  text: string;
  href: string;
  /** CTA 文案(如「继续成长路线」) */
  cta: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-r-control border-l-[3px] border-l-green-600 bg-green-50 p-4">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
      >
        <Compass className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption font-semibold text-green-700">下一步建议</p>
        <p className="mt-0.5 text-body-lg font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-body-sm text-ink-secondary">{text}</p>
      </div>
      <Button type="button" asChild>
        <Link href={href}>
          {cta}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
