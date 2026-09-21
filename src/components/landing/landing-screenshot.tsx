// 产品截图展示框(首页专用):浏览器窗口外观(三圆点 + 地址 pill)+ 真实产品截图。
// 截图均为现有产品页面(docs/screenshots 复制至 public/landing),不虚构产品界面。
import Image from "next/image";

export function ScreenshotFrame({
  src,
  alt,
  url,
  priority = false,
  className = "",
}: {
  src: string;
  alt: string;
  url: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <figure
      className={`overflow-hidden rounded-card border border-hairline bg-surface shadow-card ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <span className="size-2 rounded-full bg-sunken" />
          <span className="size-2 rounded-full bg-sunken" />
          <span className="size-2 rounded-full bg-sunken" />
        </span>
        <span className="ml-2 truncate rounded-pill bg-sunken px-2.5 py-0.5 text-caption text-ink-muted">
          {url}
        </span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={1882}
        height={871}
        priority={priority}
        className="block h-auto w-full"
      />
    </figure>
  );
}
