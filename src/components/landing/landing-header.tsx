// Landing Header(2026-09):未登录首页顶栏 —— logo +「登录」+ 主 CTA。
// 纯静态服务端组件;64px 高度 / hairline 下边线 / logo 样式与工作台顶栏同源。
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-[1160px] items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="text-body-lg font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          CareerOS<span className="text-green-600"> AI</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-control px-3 py-2 text-body-sm text-ink-secondary transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            登录
          </Link>
          <Button asChild>
            <Link href="/register">开始免费体验</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
