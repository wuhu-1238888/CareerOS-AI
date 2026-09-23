// Landing Header(2026-09):未登录首页顶栏 —— logo + 站内锚点导航(≥md 显示)+「登录」+ 主 CTA。
// 纯静态服务端组件;64px 高度 / hairline 下边线 / logo 样式与工作台顶栏同源。
// 锚点指向 LandingView 各 section 的 id(loop / ai-how / audience):纯站内跳转,不新增路由。
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "#loop", label: "产品闭环" },
  { href: "#ai-how", label: "AI 如何工作" },
  { href: "#audience", label: "适合谁" },
] as const;

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="text-[20px] font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            CareerOS<span className="text-green-600"> AI</span>
          </Link>
          <nav className="hidden items-center gap-2 md:flex">
            {NAV.map(({ href, label }) => (
              <a
                key={href}
                href={href}
                className="rounded-control px-3 py-2 text-body-sm text-ink-secondary transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-control px-3 py-2 text-body-sm text-ink-secondary transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            登录
          </Link>
          <Button asChild>
            <Link href="/register">
              开始免费体验
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
