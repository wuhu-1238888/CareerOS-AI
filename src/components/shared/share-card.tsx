// 分享卡片(6.8):客户端截图方案(html-to-image)的渲染载体,两变体 profile / roadmap。
// 「节点轨迹」品牌元素(DesignSystem:仅允许出现在空状态插画、加载动画与分享卡片中,纯 div 圆点+连线);
// 固定宽 w-[560px];AI 内容带 AiBadge;不放 Recharts 雷达(截图不可靠),用分值条替代;
// 数据由调用方以 props 传入(已鉴权查询现成数据,无新 API/公开 URL);全 token 类名,零硬编码色值。
import { Check } from "lucide-react";
import { AiBadge } from "@/components/shared/ai-badge";
import { cn } from "@/lib/utils";

// 能力等级样式(与 profile-result 的 LEVEL_STYLE 一致)
const LEVEL_STYLE: Record<string, string> = {
  基础: "text-ink-muted",
  熟练: "text-green-600",
  精通: "text-green-700 font-medium",
};

// 区块小标题统一层级(与 roadmap-timeline 的 SECTION_TITLE 一致)
const SECTION_TITLE = "text-caption font-semibold text-ink-secondary";

export type ProfileShareData = {
  variant: "profile";
  nickname?: string;
  summary: string;
  abilityTags: { name: string; level: string }[];
  /** 核心优势(调用方截取前 3 条) */
  strengths: { title: string }[];
  /** 推荐方向 + 匹配度大数字(无画像降级时为 null) */
  topDirection: { name: string; matchScore: number } | null;
  /** 六维能力(分值条替代雷达,数据与雷达同源) */
  radar: { dimension: string; value: number }[];
};

export type RoadmapShareData = {
  variant: "roadmap";
  targetDirection: string;
  totalDuration: string | null;
  finalGoal: string | null;
  weeklyHours: number | null;
  stages: { name: string; goal: string }[];
  /** 总进度(0-100,由调用方按任务完成度计算) */
  percent: number;
};

export type ShareCardData = ProfileShareData | RoadmapShareData;

// 节点轨迹:完成(实心绿)→ 当前(绿环)→ 未来(灰点)三节点 + 连线
function NodeTrail() {
  return (
    <span className="flex items-center gap-1.5" aria-hidden>
      <span className="size-2 rounded-full bg-green-600" />
      <span className="h-px w-5 bg-hairline-strong" />
      <span className="size-2 rounded-full bg-surface ring-2 ring-green-400" />
      <span className="h-px w-5 bg-hairline-strong" />
      <span className="size-2 rounded-full bg-sunken ring-1 ring-hairline-strong" />
    </span>
  );
}

// 卡片外壳:标题 + 节点轨迹 + AiBadge + 内容 + 品牌落款
function CardShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="w-[560px] max-w-full rounded-card border border-hairline bg-surface p-6 shadow-card">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <NodeTrail />
          <span className="text-body-lg font-medium text-ink">{title}</span>
        </div>
        <AiBadge />
      </header>
      <div className="mt-5">{children}</div>
      <footer className="mt-5 border-t border-hairline pt-3 text-caption text-ink-faint">
        CareerOS · AI 职业成长助手
      </footer>
    </section>
  );
}

function ProfileCard({ data }: { data: ProfileShareData }) {
  // 维度分值按从高到低排列:仅展示顺序,数据与雷达同源
  const sortedRadar = [...data.radar].sort((a, b) => b.value - a.value);
  return (
    <CardShell title="我的职业画像">
      {data.nickname ? <p className="text-h3 text-ink">{data.nickname}</p> : null}
      <p className={cn("text-body text-ink-secondary", data.nickname && "mt-2")}>
        {data.summary}
      </p>
      <ul className="mt-4 flex flex-wrap gap-2" aria-label="能力标签">
        {data.abilityTags.map((tag) => (
          <li
            key={tag.name}
            className="flex items-center gap-1 rounded-pill bg-sunken px-2.5 py-1 text-body-sm"
          >
            <span className="text-ink">{tag.name}</span>
            <span className={LEVEL_STYLE[tag.level] ?? "text-ink-muted"}>{tag.level}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <section>
          <h3 className={SECTION_TITLE}>核心优势</h3>
          <ul className="mt-2 space-y-2">
            {data.strengths.map((strength) => (
              <li key={strength.title} className="flex items-start gap-2 text-body-sm text-ink">
                <Check className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                {strength.title}
              </li>
            ))}
          </ul>
          <h3 className={cn(SECTION_TITLE, "mt-5")}>推荐方向</h3>
          {data.topDirection ? (
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-num text-green-600">{data.topDirection.matchScore}</span>
              <span className="text-body-sm text-ink-secondary">
                匹配度 · {data.topDirection.name}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-body-sm text-ink-muted">暂无推荐方向</p>
          )}
        </section>
        <section>
          <h3 className={SECTION_TITLE}>六维能力</h3>
          <ul className="mt-2 space-y-2" aria-label="六维能力">
            {sortedRadar.map((item) => (
              <li key={item.dimension} className="flex items-center gap-2">
                <span className="w-8 shrink-0 text-body-sm text-ink-secondary">
                  {item.dimension}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-pill bg-sunken" aria-hidden>
                  <span
                    className="block h-full rounded-pill bg-green-600"
                    style={{ width: `${item.value}%` }}
                  />
                </span>
                <span className="w-7 shrink-0 text-right text-body-sm text-ink">
                  {item.value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </CardShell>
  );
}

function RoadmapCard({ data }: { data: RoadmapShareData }) {
  return (
    <CardShell title="我的成长路线">
      <p className="text-h3 text-ink">
        成为「{data.targetDirection}」的 {data.totalDuration ?? "成长"} 路径
      </p>
      {data.finalGoal ? (
        <p className="mt-1 text-body-sm text-ink-secondary">{data.finalGoal}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="h-1.5 w-48 overflow-hidden rounded-pill bg-sunken" aria-hidden>
          <span
            className="block h-full rounded-pill bg-green-600"
            style={{ width: `${data.percent}%` }}
          />
        </span>
        <span className="text-body-sm text-ink-secondary">
          总进度 {data.percent}%
          {data.weeklyHours != null ? ` · 每周 ${data.weeklyHours} 小时` : ""}
        </span>
      </div>
      <ol className="mt-5 space-y-3" aria-label="成长阶段">
        {data.stages.map((stage, index) => (
          <li key={stage.name} className="flex items-start gap-3">
            <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-green-50 text-caption text-green-700">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-body-sm font-medium text-ink">{stage.name}</p>
              <p className="mt-0.5 text-caption text-ink-muted">{stage.goal}</p>
            </div>
          </li>
        ))}
      </ol>
    </CardShell>
  );
}

export function ShareCard({ data }: { data: ShareCardData }) {
  return data.variant === "profile" ? <ProfileCard data={data} /> : <RoadmapCard data={data} />;
}
