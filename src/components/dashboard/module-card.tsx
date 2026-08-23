// 模块入口卡(5.1,DesignRules 模块入口区;工作台导航优化 P0):卡片主体与 CTA 是两条独立链接——
// 主体(拉伸覆盖卡面)= 查看模块总览;CTA(ghost 按钮)= 继续当前工作(深链定位,由 actionHref 注入)。
// 双链接不嵌套:主体为 absolute inset-0 拉伸 Link,CTA 以 relative z-10 浮于其上;hover 上浮与 AgentCard 一致。
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ModuleCard({
  title,
  icon: Icon,
  progress,
  href,
  actionHref,
  actionLabel,
}: {
  title: string;
  icon: LucideIcon;
  /** 最新进展一句话(无数据 → 引导文案) */
  progress: string;
  /** 卡片主体目标:查看模块总览(画像/路线图 → 模块页;简历 → 简历中心 /resumes) */
  href: string;
  /** CTA 目标:继续当前工作(深链定位:画像 /profile#glance、路线图 /navigator?focus=current、简历 /resume?resumeId=) */
  actionHref: string;
  /** 分模块动词:画像 继续查看/开始分析;路线图 继续学习/开始规划;简历 继续优化/上传简历 */
  actionLabel: string;
}) {
  return (
    <div className="relative flex flex-col rounded-card border border-hairline bg-surface p-6 shadow-card transition-transform hover:-translate-y-0.5 hover:shadow-hover">
      <Link
        href={href}
        aria-label={`查看${title}`}
        className="absolute inset-0 rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
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
      <div className="relative z-10 mt-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
