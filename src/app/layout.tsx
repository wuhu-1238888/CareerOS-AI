import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { TRPCProvider } from "@/trpc/provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "CareerOS AI",
  description: "AI 驱动的职业成长平台",
};

// 防 FOUC(6.9):hydration 前按存储/系统偏好给 <html> 上 .dark(与 ThemeProvider 同一存储键与判据)
const themeInitScript = `(function () {
  try {
    var stored = localStorage.getItem("careeros-theme");
    var dark = stored === "dark" || ((!stored || stored === "system") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <SessionProvider>
            <TRPCProvider>{children}</TRPCProvider>
            {/* 全局 Toast(2.6 纠偏「已记录,AI 将重新分析」);位置按 DesignSystem 右下 */}
            <Toaster position="bottom-right" />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
