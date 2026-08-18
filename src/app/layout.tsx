import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "CareerOS AI",
  description: "AI 驱动的职业成长平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
