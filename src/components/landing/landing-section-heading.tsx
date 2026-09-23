// Landing 区块标题:眉标 + 标题 + 可选描述,各区块复用同一节奏。
// 眉标统一为「轻量 Section Label」:14px semibold(600)+ green-700 无字距,无胶囊底、无 Badge,
// 与 H2 间距 10px;H2 才是区块唯一视觉主标题(眉标只作辅助定位,不得抢权重)。
export function SectionHeading({
  eyebrow,
  title,
  description,
  className = "",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-[14px] font-semibold text-green-700">{eyebrow}</p>
      <h2 className="mt-2.5 text-display text-ink">{title}</h2>
      {description ? <p className="mt-3 max-w-[640px] text-body text-ink-muted">{description}</p> : null}
    </div>
  );
}
