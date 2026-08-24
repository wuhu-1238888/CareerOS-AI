"use client";
// 页面级「返回」链接(通用):左上角低强调文本链接(非主 CTA 按钮,Atlassian 式克制)。
// 应用内导航 → history.back() 回上一页;直接打开(外链/新标签,无应用内历史)→ 回兜底页(默认工作台)。
// 用于经深链进入、无自身导航入口的页面(如 /dashboard/growth:工作台 → 成长趋势 → 查看完整报告)。
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { goBackOrFallback } from "@/lib/client-back";

export function BackButton({
  fallback = "/dashboard",
  label = "返回",
  className,
}: {
  fallback?: string;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => goBackOrFallback(router, fallback)}
      // -ml-2 抵消 px-2 内边距:箭头与下方 H1 保持同一左边缘;hover 仅轻微底衬 + 文字加深
      className={cn(
        "-ml-2 inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-body-sm text-ink-muted transition-colors hover:bg-sunken hover:text-ink",
        className
      )}
    >
      <ArrowLeft aria-hidden className="size-4" />
      {label}
    </button>
  );
}
