// 模块入口卡(5.1,DesignRules 模块入口区):模块名 + 最新进展一句话 + 继续按钮(ghost)。
// 三个模块共用(画像/路线图/简历);纯展示组件,数据与按钮文案由 dashboard-view 注入。
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ModuleCard({
  title,
  icon: Icon,
  progress,
  href,
  actionLabel,
}: {
  title: string;
  icon: LucideIcon;
  /** 最新进展一句话(无数据 → 引导文案) */
  progress: string;
  href: string;
  /** 分模块动词(工作台导航优化 P1):画像 继续查看/开始分析;路线图 继续学习/开始规划;简历 继续优化/上传简历 */
  actionLabel: string;
}) {
  return (
    <div className="flex flex-col rounded-card border border-hairline bg-surface p-6 shadow-card">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-control bg-green-100 text-green-600"
        >
          <Icon className="size-5" />
        </span>
        <p className="text-h3 text-ink">{title}</p>
      </div>
      <p className="mt-3 flex-1 text-body-sm text-ink-muted">{progress}</p>
      <div className="mt-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={href}>{actionLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
