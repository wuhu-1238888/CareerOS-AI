"use client";
// 应用内「返回」按钮(通用,4.15 先例):左上角幽灵按钮。应用内导航 → history.back() 回上一页;
// 直接打开(外链/新标签,无应用内历史)→ 回兜底页(默认工作台),避免把用户带出应用。
// 用于经深链进入、无自身导航入口的页面(如 /dashboard/growth)。
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { goBackOrFallback } from "@/lib/client-back";

export function BackButton({ fallback = "/dashboard" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mb-2"
      onClick={() => goBackOrFallback(router, fallback)}
    >
      <ArrowLeft aria-hidden />
      返回
    </Button>
  );
}
