// 首页(Landing Page,2026-09 升级为完整 SaaS 营销页,同月做信息减法:删除核心能力 Showcase,详细产品体验由游客预览承担):
// Header → Hero → 产品闭环 → AI 决策逻辑 → 适用人群 → Final CTA + 页脚。
// 纯静态服务端组件,未登录可见;已登录用户由 page.tsx 服务端重定向工作台,不渲染本页。
// 禁令走查:无机器人形象、无粒子/渐变/发光、无自动播放视频;产品展示仅 Hero 一处 DOM Demo Mockup(虚构演示数据)。
import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { LandingFlow } from "./landing-flow";
import { LandingAiLogic } from "./landing-ai-logic";
import { LandingAudience } from "./landing-audience";
import { LandingFinalCta } from "./landing-final-cta";

export function LandingView() {
  return (
    <div className="min-h-screen bg-canvas">
      <LandingHeader />
      <main className="mx-auto w-full max-w-[1160px] px-4 sm:px-6">
        <LandingHero />
        <LandingFlow />
        <LandingAiLogic />
        <LandingAudience />
        <LandingFinalCta />
      </main>
    </div>
  );
}
