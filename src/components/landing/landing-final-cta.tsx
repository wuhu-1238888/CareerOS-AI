// Final CTA(首页 ⑤)+ 页脚:居中标题 + 双 CTA + 信任行 + 法律链接/版权。
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestLoginButton } from "./guest-login-button";

export function LandingFinalCta() {
  return (
    <>
      <section className="py-12 text-center">
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

      <footer className="flex flex-col items-center justify-between gap-2 border-t border-hairline py-6 sm:flex-row">
        <span className="text-body-sm text-ink-muted">© 2026 CareerOS AI</span>
        <div className="flex items-center gap-6">
          <Link href="/privacy" className="text-body-sm text-ink-muted hover:text-ink-secondary">
            隐私政策
          </Link>
          <Link href="/terms" className="text-body-sm text-ink-muted hover:text-ink-secondary">
            用户协议
          </Link>
        </div>
      </footer>
    </>
  );
}
