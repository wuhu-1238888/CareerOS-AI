// Landing Header(2026-09):未登录首页顶栏 —— logo + 页内锚点导航(桌面)+「登录」+ 主 CTA。
// 纯静态服务端组件:锚点为原生 hash 链接,零客户端 JS;移动端保持一行(锚点隐藏,不引入汉堡)。
// 64px 高度 / hairline 下边线 / logo 样式与工作台顶栏同源。
import Link from "next/link";
import { Button } from "@/components/ui/button";

// 页内锚点:按页面出现顺序排列,目标 Section 以 scroll-mt-20 避开 sticky header
const NAV_ANCHORS = [
  { href: "#how-it-works", label: "使用流程" },
  { href: "#showcase", label: "产品能力" },
  { href: "#ai-decision", label: "AI 如何工作" },
] as const;

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-[1160px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-body-lg font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            CareerOS<span className="text-green-600"> AI</span>
          </Link>
          <nav aria-label="页内导航" className="hidden items-center gap-1 md:flex">
            {NAV_ANCHORS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-control px-3 py-2 text-body-sm text-ink-secondary transition-colors hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {item.label}
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
            <Link href="/register">开始免费体验</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
