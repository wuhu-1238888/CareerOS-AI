import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { TRPCProvider } from "@/trpc/provider";
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
      <body className="antialiased">
        <SessionProvider>
          <TRPCProvider>{children}</TRPCProvider>
          {/* 全局 Toast(2.6 纠偏「已记录,AI 将重新分析」) */}
          <Toaster position="top-center" />
        </SessionProvider>
      </body>
    </html>
  );
}
