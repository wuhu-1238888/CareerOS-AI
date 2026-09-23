// Hero 产品展示(首页专用):Landing 专用 DOM Demo Mockup,取代真实账号截图。
// 结构对齐设计基准图:单条顶栏(窗口三点 + Logo + 六项导航 + 头像)→ 问候 →
// 「我的职业成长进度」五格进度卡(五格 = 产品五步闭环,首屏直接看到产品形态)→「推荐岗位」行。
// 虚构演示数据:不 import 种子文件、不读任何真实用户数据、不含真实个人信息。
// 全部按钮均为纯样式 span(不可聚焦),wrapper aria-hidden,屏幕阅读器只读 figure 的 aria-label。
// 字号为真实工作台约 60% 比例,放大后密度适中且天然高分辨率。
// 禁令走查:无渐变、无发光、无玻璃拟态;无 img/视频;仅使用 DesignSystem token 类。
import { Briefcase, Compass, FileText, MessageSquareText, Route, Search, Target, User } from "lucide-react";

const NAV_ITEMS = ["首页", "职业画像", "岗位匹配", "成长路线", "简历优化", "模拟面试"] as const;

// 五格进度 = 产品五步闭环(虚构值;全部非零,避免出现「空状态」观感)
const PROGRESS = [
  { icon: Search, label: "职业画像", value: "80%" },
  { icon: Target, label: "岗位匹配", value: "65%" },
  { icon: Route, label: "成长路线", value: "40%" },
  { icon: FileText, label: "简历优化", value: "30%" },
  { icon: MessageSquareText, label: "模拟面试", value: "15%" },
] as const;

// 虚构推荐岗位
const JOB = {
  title: "产品经理",
  meta: "互联网 | 15-30k | 本科及以上",
  match: "85%",
  desc: "负责产品规划与需求分析，推动产品迭代与落地。",
};

export function LandingDemoMockup() {
  return (
    <figure
      role="img"
      aria-label="CareerOS 工作台界面示意(演示数据)"
      className="overflow-hidden rounded-card border border-hairline bg-surface shadow-card"
    >
      <div aria-hidden>
        {/* 单条顶栏:窗口三点 + Logo + 导航 + 头像。
            导航仅在 Mockup 足够宽时显示(sm–lg 单列全宽、xl+ 双列宽右列);
            lg–xl 区间右列约 464–552px 放不下 6 项导航,隐藏避免挤压。 */}
        <div className="flex h-11 items-center gap-3 border-b border-hairline px-4">
          <span className="flex shrink-0 gap-1.5">
            <span className="size-2 rounded-full bg-sunken" />
            <span className="size-2 rounded-full bg-sunken" />
            <span className="size-2 rounded-full bg-sunken" />
          </span>
          <span className="shrink-0 text-body-sm font-bold text-ink">
            CareerOS<span className="text-green-600"> AI</span>
          </span>
          <span className="hidden items-center gap-0.5 sm:flex lg:hidden xl:flex">
            {NAV_ITEMS.map((item, index) => (
              <span
                key={item}
                className={
                  index === 0
                    ? "relative rounded-control px-1.5 py-1 text-caption font-medium text-green-700"
                    : "rounded-control px-1.5 py-1 text-caption text-ink-secondary"
                }
              >
                {item}
                {/* 当前项下划线:贴在顶栏下边线上 */}
                {index === 0 ? (
                  <span className="absolute inset-x-1.5 -bottom-[9px] h-0.5 rounded-pill bg-green-600" />
                ) : null}
              </span>
            ))}
          </span>
          <span className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
            <User className="size-3.5" />
          </span>
        </div>

        {/* 内容区 */}
        <div className="space-y-3.5 p-5">
          {/* 问候 */}
          <div>
            <p className="text-h2 text-ink">你好，未来的职场人 👋</p>
            <p className="mt-1 text-body-sm text-ink-secondary">
              让 AI 帮助你找到方向，制定计划，成为更好的自己
            </p>
          </div>

          {/* 我的职业成长进度(五格 = 五步闭环) */}
          <div className="overflow-hidden rounded-card border border-hairline bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-hairline bg-green-50 px-3.5 py-2">
              <span className="flex items-center gap-1.5 text-caption font-semibold text-green-700">
                <Compass className="size-3.5 shrink-0" />
                我的职业成长进度
              </span>
              <span className="shrink-0 text-caption text-green-700">继续完善信息 →</span>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3.5 sm:grid-cols-5">
              {PROGRESS.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-control border border-hairline bg-surface px-2 py-2">
                  <Icon className="size-3.5 text-green-600" aria-hidden />
                  <p className="mt-1.5 truncate text-caption text-ink-muted">{label}</p>
                  <p className="mt-0.5 text-[18px] font-bold leading-none text-ink">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 推荐岗位 */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-body-sm font-semibold text-ink">推荐岗位</p>
              <span className="shrink-0 text-caption text-green-700">查看更多 →</span>
            </div>
            <div className="mt-2 rounded-card border border-hairline bg-surface p-3.5">
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <Briefcase className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-ink">{JOB.title}</p>
                  <p className="mt-0.5 truncate text-caption text-ink-muted">{JOB.meta}</p>
                  <p className="mt-2.5 truncate text-caption text-ink-muted">{JOB.desc}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="rounded-pill bg-green-100 px-2 py-0.5 text-caption font-medium text-green-700">
                    匹配度 {JOB.match}
                  </span>
                  {/* 纯样式按钮(不可聚焦,仅视觉展示) */}
                  <span className="rounded-control bg-green-600 px-3 py-1.5 text-caption font-medium text-white">
                    查看详情
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
