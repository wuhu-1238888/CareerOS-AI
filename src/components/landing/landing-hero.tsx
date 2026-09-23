// Hero(首页 ①):3 秒传达「是什么 / 能做什么 / 长什么样」——左文案 + 双 CTA + 数据说明,
// 右 Landing 专用 DOM Demo Mockup(虚构演示数据,取代真实账号截图:清晰、可放大、无个人数据)。
// 标题用 Landing 专用 text-display-lg(43px,基准图像素实测值),两行显式断行形成视觉节奏;内部页面不使用该档。
// 右列装饰(氛围圆 / 悬浮助手卡)均为平色 + aria-hidden、不可聚焦,不参与语义。
import Link from "next/link";
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestLoginButton } from "./guest-login-button";
import { LandingDemoMockup } from "./landing-demo-mockup";

export function LandingHero() {
  return (
    <section className="grid items-center gap-12 pb-10 pt-16 sm:pt-20 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.32fr)]">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-green-700">AI 驱动的职业成长系统</p>
        <h1 className="mt-2.5 max-w-[480px] text-display sm:text-display-lg text-ink">
          找到你的职业方向
          <br />
          一步一步走到目标岗位
        </h1>
        <p className="mt-4 max-w-[480px] text-body-lg text-ink-muted">
          CareerOS 从职业画像、岗位匹配、成长路线到简历优化与模拟面试，帮你建立从自我认知到拿下面试的完整求职闭环。
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" asChild>
            <Link href="/register">
              开始免费体验
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <GuestLoginButton />
        </div>
        <p className="mt-4 flex items-center gap-2 text-body-sm text-ink-muted">
          <ShieldCheck className="size-3.5 shrink-0 text-green-600" aria-hidden />
          你的数据只用于个性化分析
        </p>
      </div>

      <div className="relative isolate min-w-0">
        {/* 氛围圆:平色浅绿(非渐变/非发光),仅桌面显示且不越出容器 */}
        <div
          className="absolute -top-10 right-0 -z-10 hidden size-[420px] rounded-full bg-green-50 lg:block"
          aria-hidden
        />
        <LandingDemoMockup />
        {/* 悬浮助手卡:纯装饰,不可聚焦。位置按基准图像素实测:卡与「查看详情」垂直居中(中心同高)、
            卡左缘距按钮右缘 7px、横跨 Mockup 右缘(内侧 48px / 外侧 88px)。我们卡片更宽,故取左缘距按钮 6px。
            ≥1384px 才有容纳该横向位置的空间(1280–1383 容器已封顶,右侧仅剩 126px),
            这段回退为「贴在 Mockup 右下角下方」——两档都不遮挡匹配度与按钮。 */}
        <div
          className="absolute -bottom-6 -right-3 hidden items-center gap-2.5 rounded-card border border-hairline bg-surface px-3 py-2 shadow-card sm:flex min-[1384px]:bottom-8 min-[1384px]:-right-16"
          aria-hidden
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <UserRound className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block text-caption text-ink-muted">你的职业成长伙伴</span>
            <span className="block text-body-sm font-semibold text-ink">CareerOS AI</span>
          </span>
        </div>
      </div>
    </section>
  );
}
