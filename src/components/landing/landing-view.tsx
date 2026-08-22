// 首页(5.2,DesignRules 首页):主视觉区(display 标题 + 副标题 + 单一主 CTA)→ 三模块静态介绍卡 → 信任行。
// 纯静态服务端组件,未登录可见;已登录用户由 page.tsx 服务端重定向工作台,不渲染本页。
// 禁令走查:无机器人形象(无图片/插画)、无粒子动效、无视频、整页仅「开始职业探索」一个主按钮。
// 图标与工作台 Agent 卡同源(画像 Search / 规划 Route / 简历 FileText),保持全站一致性。
import Link from "next/link";
import { FileText, Route, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

// 三模块介绍:图标 + 一句话价值,无交互(DesignRules 首页必备区块 ②)
const MODULES = [
  { icon: Search, name: "职业画像", value: "3 分钟完成画像,推荐匹配方向" },
  { icon: Route, name: "成长路线", value: "把目标拆成可执行的成长路线" },
  { icon: FileText, name: "简历优化", value: "逐条解析优化,适配目标岗位" },
] as const;

export function LandingView() {
  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto w-full max-w-[1160px] px-4 sm:px-6">
        {/* ① 主视觉区:3 秒传达价值主张(标题 ≤14 字 / 副标题 16px ≤30 字 / 单一 CTA) */}
        <section className="flex flex-col items-center pb-16 pt-24 text-center sm:pt-32">
          <h1 className="text-display text-ink">AI 帮你找到职业方向</h1>
          <p className="mt-4 max-w-[480px] text-body-lg text-ink-muted">
            3 分钟生成职业画像,获得专属方向与成长建议
          </p>
          <Button size="lg" className="mt-8" asChild>
            <Link href="/register">开始职业探索</Link>
          </Button>
        </section>

        {/* ② 三模块介绍:静态卡片,无 hover 抬升等交互暗示 */}
        <section aria-label="三大模块" className="grid gap-4 pb-16 md:grid-cols-3">
          {MODULES.map(({ icon: Icon, name, value }) => (
            <div key={name} className="rounded-card border border-hairline bg-surface p-6 shadow-card">
              <div className="flex size-10 items-center justify-center rounded-control bg-green-100 text-green-600">
                <Icon className="size-5" aria-hidden />
              </div>
              <h2 className="mt-4 text-h3 text-ink">{name}</h2>
              <p className="mt-1 text-body-sm text-ink-muted">{value}</p>
            </div>
          ))}
        </section>

        {/* ③ 轻量信任区:一行说明 */}
        <p className="flex items-center justify-center gap-2 pb-16 text-body-sm text-ink-muted">
          <ShieldCheck className="size-4 text-green-600" aria-hidden />
          你的数据只用于个性化分析
        </p>
      </main>
    </div>
  );
}
