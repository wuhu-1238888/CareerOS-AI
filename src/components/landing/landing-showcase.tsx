// 核心产品能力(首页 ④):截图从「装饰」变成「产品证据」。每块固定四要素——
// 用户问题(eyebrow)→ 模块名 → CareerOS 做了什么 → 截图中的关键结果(bullets)。
// 全部能力点与结果取自现有产品真实功能,不虚构。截图加宽至 7/12 列,与文案交错。
import { Check } from "lucide-react";
import { SectionHeading } from "./landing-section-heading";
import { ScreenshotFrame } from "./landing-screenshot";

type Feature = {
  problem: string;
  name: string;
  action: string;
  results: string[];
  src: string;
  alt: string;
  url: string;
};

const ROWS: Feature[] = [
  {
    problem: "不知道自己适合做什么",
    name: "职业画像",
    action: "3 分钟输入教育、技能与经历，AI 提炼你的能力结构，给出结构化画像与推荐方向。",
    results: ["六维能力雷达与优势短板", "推荐方向带匹配度，按优先级排列", "觉得不准可点「这不是我」重新分析"],
    src: "/landing/profile.png",
    alt: "CareerOS 职业画像页面截图",
    url: "careeros.ai/profile",
  },
  {
    problem: "不知道和目标岗位差在哪",
    name: "岗位匹配",
    action: "粘贴目标 JD，AI 逐项对比岗位要求与你的能力，给出可解释的匹配结论。",
    results: ["匹配度大数字 + 投递建议", "逐项能力对比：达标 / 接近 / 不足", "差距一键生成 90 天提升计划"],
    src: "/landing/matching.png",
    alt: "CareerOS 岗位匹配页面截图",
    url: "careeros.ai/matching",
  },
  {
    problem: "知道差在哪，但不知道怎么补",
    name: "成长路线",
    action: "选定方向与每周可投入时间，AI 把差距拆成阶段化、可执行的成长路径。",
    results: ["3-4 个阶段的纵向时间线", "任务三态标记，进度一目了然", "「太难了 / 已经会了」反馈让 AI 调整路线"],
    src: "/landing/roadmap.png",
    alt: "CareerOS 成长路线页面截图",
    url: "careeros.ai/navigator",
  },
];

const TWO_UP: Feature[] = [
  {
    problem: "有经历，但不会表达",
    name: "简历优化",
    action: "上传简历，AI 逐条解析并给出修改建议，每一处修改都告诉你为什么。",
    results: ["修改前 / 后 / 原因三段对比", "ATS 评分量化简历质量", "复制最终文本 / 导出 PDF"],
    src: "/landing/resume.png",
    alt: "CareerOS 简历优化页面截图",
    url: "careeros.ai/resume",
  },
  {
    problem: "不知道面试哪里会失分",
    name: "模拟面试",
    action: "基于简历与目标岗位出题，逐题作答、逐题反馈，结束得到综合报告。",
    results: ["行为 / 技术 / 案例三档个性化出题", "逐题评估：内容与表达双维度评分", "综合报告：优势、短板与改进方向"],
    src: "/landing/interview.png",
    alt: "CareerOS 模拟面试页面截图",
    url: "careeros.ai/interview",
  },
];

function FeatureText({ feature }: { feature: Feature }) {
  return (
    <div>
      <p className="text-eyebrow text-green-600">{feature.problem}</p>
      <h3 className="mt-2 text-h2 text-ink">{feature.name}</h3>
      <p className="mt-2 text-body text-ink-muted">{feature.action}</p>
      <ul className="mt-4 space-y-2">
        {feature.results.map((result) => (
          <li key={result} className="flex items-start gap-2 text-body-sm text-ink-secondary">
            <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
            {result}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingShowcase() {
  return (
    <section id="showcase" aria-label="核心产品能力" className="scroll-mt-20 py-16 sm:py-20">
      <SectionHeading
        eyebrow="核心产品能力"
        title="每个环节，都有真实产品界面与结果"
        description="下面每一张图都是产品真实页面。你关心的不是「有没有这个功能」，而是「它到底怎么帮我」。"
      />
      <div className="mt-10 space-y-12">
        {ROWS.map((feature, index) => (
          <div key={feature.name} className="grid items-center gap-8 lg:grid-cols-12">
            <div className={`lg:col-span-5 ${index % 2 === 1 ? "lg:order-2" : ""}`}>
              <FeatureText feature={feature} />
            </div>
            <ScreenshotFrame
              src={feature.src}
              alt={feature.alt}
              url={feature.url}
              className={`lg:col-span-7 ${index % 2 === 1 ? "lg:order-1" : ""}`}
            />
          </div>
        ))}
        {/* 简历优化 + 模拟面试:双栏(结构与上同构:问题 → 做了什么 → 关键结果 → 截图) */}
        <div className="grid gap-8 md:grid-cols-2">
          {TWO_UP.map((feature) => (
            <div key={feature.name} className="space-y-6">
              <FeatureText feature={feature} />
              <ScreenshotFrame src={feature.src} alt={feature.alt} url={feature.url} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
