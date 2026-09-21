// Hero(首页 ①):12 列双栏 —— 左 5 列价值主张 + 双 CTA + 真实指标行,右 7 列放大工作台截图。
// 指标行全部来自真实产品结构(6 大模块 / 5 步闭环 / 6 维雷达 / 90 天计划),不虚构任何社会证明。
// 移动端文字在上、截图在下,自然换行无横向溢出。
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GuestLoginButton } from "./guest-login-button";
import { ScreenshotFrame } from "./landing-screenshot";

export function LandingHero() {
  return (
    <section className="grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <p className="text-eyebrow text-green-600">AI 职业成长操作系统</p>
        <h1 className="mt-3 text-display text-ink">找到你的职业方向，一步一步走到目标岗位</h1>
        <p className="mt-4 text-body-lg text-ink-muted">
          CareerOS 从职业画像、岗位匹配、成长路线到简历优化与模拟面试，帮你建立从自我认知到拿下面试的完整求职闭环。
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" asChild>
            <Link href="/register">开始免费体验</Link>
          </Button>
          <GuestLoginButton />
        </div>
        {/* 真实能力指标:纯产品结构数据,无用户数/成功率类虚构 */}
        <p className="mt-8 text-caption text-ink-muted">
          6 大核心模块 · 5 步职业闭环 · 6 维能力雷达 · 90 天提升计划
        </p>
      </div>
      <div className="lg:col-span-7">
        <ScreenshotFrame
          src="/landing/dashboard.png"
          alt="CareerOS 工作台界面截图"
          url="careeros.ai/dashboard"
          priority
        />
        <p className="mt-3 text-center text-caption text-ink-muted">
          上图为真实工作台界面 · 游客预览可直接体验
        </p>
      </div>
    </section>
  );
}
