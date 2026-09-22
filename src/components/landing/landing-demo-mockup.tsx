// Hero 产品展示(首页专用):Landing 专用 DOM Demo Mockup,取代真实账号截图。
// 虚构演示数据(张伟),数值形态与 prisma/demo-seed.ts 的 db:seed:demo 一致,但不 import 种子文件、
// 不读任何真实用户数据、不含真实个人信息。全部按钮均为纯样式 div(不可聚焦),wrapper aria-hidden,
// 屏幕阅读器只读 figure 的 aria-label。字号为真实工作台约 60% 比例,放大后密度适中且天然高分辨率。
// 禁令走查:无渐变、无发光、无玻璃拟态;无 img/视频;仅使用 DesignSystem token 类。
import { Check, Compass, Info } from "lucide-react";
import { AiBadge } from "@/components/shared/ai-badge";

const NAV_ITEMS = ["工作台", "职业画像", "成长路线", "岗位匹配", "简历优化", "模拟面试"] as const;

// 虚构 KPI(推荐方向匹配度 / 路线图进度 / 待处理建议)
const STATS = [
  { label: "推荐方向匹配度", value: "82", suffix: "", delta: "较上次 +3%" },
  { label: "路线图进度", value: "12", suffix: "%", delta: null },
  { label: "待处理建议", value: "1", suffix: "", delta: null },
] as const;

// 虚构 AI 洞察(岗位优势 / 需要关注)
const STRENGTHS = ["后端工程经验扎实", "数据意识强"];
const WEAKNESSES = ["高并发场景经验不足"];

// 虚构进度概览
const OVERVIEW = [
  { label: "简历 ATS", value: "85" },
  { label: "岗位匹配", value: "78%" },
  { label: "面试准备", value: "2 / 5" },
] as const;

export function LandingDemoMockup() {
  return (
    <figure
      role="img"
      aria-label="CareerOS 工作台界面示意(演示数据)"
      className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card"
    >
      <div aria-hidden>
        {/* 浏览器窗口 chrome */}
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2 rounded-full bg-sunken" />
            <span className="size-2 rounded-full bg-sunken" />
            <span className="size-2 rounded-full bg-sunken" />
          </span>
          <span className="ml-2 truncate rounded-pill bg-sunken px-2.5 py-0.5 text-caption text-ink-muted">
            careeros.ai/dashboard
          </span>
        </div>

        {/* 迷你应用顶栏:导航仅在 Mockup 足够宽时显示(sm–lg 单列全宽、xl+ 双列宽右列),
            lg–xl 区间右列约 464–552px 放不下 6 项导航,隐藏避免挤压 */}
        <div className="flex h-11 items-center justify-between gap-3 border-b border-hairline px-4">
          <span className="shrink-0 text-body-sm font-bold text-ink">
            CareerOS<span className="text-green-600"> AI</span>
          </span>
          <span className="hidden items-center gap-0.5 sm:flex lg:hidden xl:flex">
            {NAV_ITEMS.map((item, index) => (
              <span
                key={item}
                className={
                  index === 0
                    ? "rounded-control bg-green-50 px-1.5 py-1 text-caption font-medium text-green-700"
                    : "rounded-control px-1.5 py-1 text-caption text-ink-secondary"
                }
              >
                {item}
              </span>
            ))}
          </span>
          <span className="size-6 shrink-0 rounded-full bg-green-100" />
        </div>

        {/* 内容区 */}
        <div className="space-y-4 p-5">
          {/* 问候 */}
          <div>
            <p className="text-h2 text-ink">你好，张伟</p>
            <p className="mt-1 text-body-sm text-ink-secondary">
              本周完成 2 个任务，路线图进度 12%
            </p>
          </div>

          {/* 下一步建议横幅 */}
          <div className="flex items-center gap-3 rounded-r-control border-l-[3px] border-l-green-600 bg-green-50 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
              <Compass className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-caption font-semibold text-green-700">下一步建议</span>
              <span className="mt-0.5 block truncate text-body-sm text-ink">继续推进成长路线</span>
            </span>
            {/* 纯样式按钮(不可聚焦,仅视觉展示) */}
            <span className="shrink-0 rounded-control bg-green-600 px-3 py-1.5 text-caption font-medium text-white">
              继续
            </span>
          </div>

          {/* KPI 三卡 */}
          <div className="grid grid-cols-3 gap-3">
            {STATS.map(({ label, value, suffix, delta }) => (
              <div key={label} className="rounded-card border border-hairline bg-surface px-4 py-3">
                <p className="truncate text-caption text-ink-muted">{label}</p>
                <p className="mt-1.5 text-h2 text-ink">
                  {value}
                  {suffix ? <span className="text-body-sm text-ink-muted">{suffix}</span> : null}
                </p>
                {delta ? (
                  <p className="mt-1 inline-flex items-center rounded-pill bg-success-bg px-1.5 py-0.5 text-caption text-success">
                    {delta}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          {/* AI 洞察卡 */}
          <div className="rounded-card border border-hairline bg-surface p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-h3 text-ink">AI 洞察</p>
              <AiBadge />
            </div>
            <ul className="mt-3 space-y-2">
              {STRENGTHS.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-green-600" />
                  <span className="min-w-0 truncate text-body-sm text-ink">{item}</span>
                </li>
              ))}
              {WEAKNESSES.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Info className="mt-0.5 size-3.5 shrink-0 text-ink-faint" />
                  <span className="min-w-0 truncate text-body-sm text-ink-secondary">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 进度概览条 */}
          <div className="flex items-center justify-between gap-4 border-t border-hairline pt-3">
            {OVERVIEW.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <p className="truncate text-caption text-ink-faint">{label}</p>
                <p className="mt-0.5 text-h3 text-ink">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}
