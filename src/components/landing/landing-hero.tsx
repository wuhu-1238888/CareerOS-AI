// Hero(首页 ①):3 秒传达「是什么 / 能做什么 / 长什么样」——左文案 + 双 CTA + 数据说明,
// 右 Landing 专用 DOM Demo Mockup(虚构演示数据,取代真实账号截图:清晰、可放大、无个人数据)。
// 标题两行显式断行形成视觉节奏:≥1400px 用 Landing 专用 text-display-xl(48px,2026-09 放大档),
// 以下退回 display-lg(43px)——1280 视口左列仅 474px,48px 下第二行「一步一步走到目标岗位」
// 需 480px 会折成三行,故放大档从 1400px 起用(内部页面一律不使用这两档)。
// 右列装饰(氛围圆 / 悬浮助手卡)均为平色 + aria-hidden、不可聚焦,不参与语义。
import Link from "next/link";
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GuestLoginButton } from "./guest-login-button";
import { LandingDemoMockup } from "./landing-demo-mockup";

export function LandingHero() {
  return (
    <section className="grid items-center gap-12 pb-12 pt-20 sm:pt-24 lg:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
      <div className="min-w-0">
        <p className="text-eyebrow-lg text-green-700">AI 驱动的职业成长系统</p>
        <h1 className="mt-2.5 max-w-[540px] text-display sm:text-display-lg min-[1400px]:text-display-xl text-ink">
          找到你的职业方向
          <br />
          一步一步走到目标岗位
        </h1>
        <p className="mt-5 max-w-[520px] text-body-lg text-ink-muted">
          CareerOS 从职业画像、岗位匹配、成长路线到简历优化与模拟面试，帮你建立从自我认知到拿下面试的完整求职闭环。
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="xl" asChild>
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
        {/* Mockup 包裹层:xl 起右列内缩 60px(容器 1400 下 Mockup ≈722px),在右侧留出悬浮卡探出的横向空间 */}
        <div className="relative xl:w-[calc(100%-60px)]">
          <LandingDemoMockup />
          {/* 悬浮助手卡:纯装饰,不可聚焦。位置按基准图像素实测:卡与「查看详情」垂直居中(中心同高)、
              卡左缘距按钮右缘 7px(实现取 6px),横跨 Mockup 右缘(内侧 30px / 外侧 130px)。
              锚点是 Mockup 包裹层(已内缩 60px),故 -right-[130px] 相对容器实际探出 70px。
              2026-09 容器加宽至 1400px 后重算(浏览器 boundingBox 实测):
              ≥1536px 视口用该位置(1536 下卡右缘距视口 22px,卡左缘 = 按钮右缘 + 6px ✓);
              1440 视口容器边距仅 20px、右列更靠右,130px 探出会溢出 26px,且「按钮右侧 6px」在该宽度下
              几何上不可满足(卡右缘需 1466 > 1440)→ 回退为「贴在 Mockup 右下角下方」(-bottom-6 -right-3)。
              两档都必须与「查看详情」「匹配度」零相交(已用 boundingBox 相交断言复核)。 */}
          <div
            className="absolute -bottom-6 -right-3 hidden items-center gap-2.5 rounded-card border border-hairline bg-surface px-3 py-2 shadow-card sm:flex min-[1536px]:bottom-8 min-[1536px]:-right-[130px]"
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
      </div>
    </section>
  );
}
