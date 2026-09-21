// 首页(Landing Page,2026-09 二轮升级为「产品体验型」SaaS Landing Page):
// Header(锚点导航)→ Hero(大截图 + 指标行)→ 工作方式(问题→回答叙事)→ 产品闭环(主线 + 5 卡)
// → 核心产品能力(截图=证据)→ AI 决策(理解/分析/决策/行动)→ 谁适合使用(问题导向)→ Final CTA + 页脚。
// 7 个 Section、7 种呈现形式,节奏交替;CTA 仅首尾两组按钮 + 02 段尾一个锚点链接,无 CTA 疲劳。
// 纯静态服务端组件,未登录可见;已登录用户由 page.tsx 服务端重定向工作台,不渲染本页。
// 禁令走查:无机器人形象、无粒子/渐变/发光、无自动播放视频;产品展示均为真实截图与真实能力。
import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { LandingHowItWorks } from "./landing-how-it-works";
import { LandingFlow } from "./landing-flow";
import { LandingShowcase } from "./landing-showcase";
import { LandingAiLogic } from "./landing-ai-logic";
import { LandingAudience } from "./landing-audience";
import { LandingFinalCta } from "./landing-final-cta";

export function LandingView() {
  return (
    <div className="min-h-screen bg-canvas">
      <LandingHeader />
      <main className="mx-auto w-full max-w-[1160px] px-4 sm:px-6">
        <LandingHero />
        <LandingHowItWorks />
        <LandingFlow />
        <LandingShowcase />
        <LandingAiLogic />
        <LandingAudience />
        <LandingFinalCta />
      </main>
    </div>
  );
}
