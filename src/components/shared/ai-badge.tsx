// AI 内容标记(DesignSystem ai-badge):AI 紫只用于标记 AI 生成内容,业务文案可自定义
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiBadge({
  children = "AI 分析",
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-violet-50 px-2 py-0.5 text-caption text-violet-700",
        className
      )}
    >
      <Sparkles className="size-3" aria-hidden />
      {children}
    </span>
  );
}
