// Final CTA(首页 ⑦)+ 页脚:居中标题 + 双 CTA + 信任行;页脚充实为品牌行 + 页内锚点 + 法律链接 + 版权。
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestLoginButton } from "./guest-login-button";

export function LandingFinalCta() {
  return (
    <>
      <section className="py-16 text-center sm:py-20">
        <h2 className="text-h1 text-ink">准备好开始你的职业规划了吗？</h2>
        <p className="mt-3 text-body-lg text-ink-muted">
          从职业画像开始，找到目标岗位，并明确下一步行动。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" asChild>
            <Link href="/register">开始免费体验</Link>
          </Button>
          <GuestLoginButton />
        </div>
        <p className="mt-10 flex items-center justify-center gap-2 text-body-sm text-ink-muted">
          <ShieldCheck className="size-4 text-green-600" aria-hidden />
          你的数据只用于个性化分析
        </p>
      </section>

      <footer className="border-t border-hairline py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-body-sm font-bold text-ink">
              CareerOS<span className="text-green-600"> AI</span>
            </p>
            <p className="mt-1 text-caption text-ink-muted">AI 职业成长操作系统 · 找到方向，走到目标岗位</p>
          </div>
          <nav aria-label="页脚导航" className="flex flex-wrap items-center gap-6">
            <a
              href="#how-it-works"
              className="text-body-sm text-ink-muted transition-colors hover:text-ink-secondary"
            >
              使用流程
            </a>
            <a
              href="#showcase"
              className="text-body-sm text-ink-muted transition-colors hover:text-ink-secondary"
            >
              产品能力
            </a>
            <Link href="/privacy" className="text-body-sm text-ink-muted transition-colors hover:text-ink-secondary">
              隐私政策
            </Link>
            <Link href="/terms" className="text-body-sm text-ink-muted transition-colors hover:text-ink-secondary">
              用户协议
            </Link>
          </nav>
        </div>
        <p className="mt-6 text-caption text-ink-muted">© 2026 CareerOS AI</p>
      </footer>
    </>
  );
}
