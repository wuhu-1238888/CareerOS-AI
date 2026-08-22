// 法律文档页共享布局(5.3):隐私政策 / 用户协议共用;公开路由(不在 (dashboard) 组内,无顶栏)。
// 内容为静态服务端组件;返回首页入口 + 1160px 容器 + 760px 阅读宽度。
import Link from "next/link";

export type LegalSection = { heading: string; paragraphs: string[] };

export function LegalPage({
  title,
  updated,
  sections,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto w-full max-w-[1160px] px-4 py-12 sm:px-6">
        <Link href="/" className="text-body-sm text-green-600 hover:text-green-700">
          ← 返回首页
        </Link>
        <h1 className="mt-6 text-h1 text-ink">{title}</h1>
        <p className="mt-2 text-body-sm text-ink-muted">更新日期:{updated}</p>
        <div className="mt-8 max-w-[760px] space-y-8 pb-12">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-h2 text-ink">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="mt-3 text-body text-ink-secondary">
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
