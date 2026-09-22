// Hero(首页 ①):3 秒传达「是什么 / 能做什么 / 长什么样」——左文案 + 双 CTA + 数据说明,
// 右 Landing 专用 DOM Demo Mockup(虚构演示数据,取代真实账号截图:清晰、可放大、无个人数据)。
// 移动端文字在上、Mockup 在下,自然换行无横向溢出。
import Link from "next/link";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestLoginButton } from "./guest-login-button";
import { LandingDemoMockup } from "./landing-demo-mockup";

export function LandingHero() {
  return (
    <section className="grid items-center gap-12 pb-12 pt-16 sm:pt-20 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div>
        <p className="text-[14px] font-semibold text-green-700">AI 职业成长操作系统</p>
        <h1 className="mt-2.5 max-w-[440px] text-display text-ink">
          找到你的职业方向
          <br />
          一步一步走到目标岗位
        </h1>
        <p className="mt-4 max-w-[480px] text-body-lg text-ink-muted">
          CareerOS 从职业画像、岗位匹配、成长路线到简历优化与模拟面试，帮你建立从自我认知到拿下面试的完整求职闭环。
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" asChild>
            <Link href="/register">开始免费体验</Link>
          </Button>
          <GuestLoginButton />
        </div>
        <p className="mt-4 flex items-center gap-2 text-body-sm text-ink-muted">
          <Lock className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
          你的数据只用于个性化分析
        </p>
      </div>
      <LandingDemoMockup />
    </section>
  );
}
