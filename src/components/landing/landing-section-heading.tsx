// Landing 区块标题:眉标 + 标题 + 可选描述,各区块复用同一节奏(DesignSystem eyebrow/h1/body)
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
      <p className="text-eyebrow text-green-600">{eyebrow}</p>
      <h2 className="mt-2 text-h1 text-ink">{title}</h2>
      {description ? <p className="mt-3 max-w-[640px] text-body text-ink-muted">{description}</p> : null}
    </div>
  );
}
