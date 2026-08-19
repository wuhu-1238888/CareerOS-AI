import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
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
        </SessionProvider>
      </body>
    </html>
  );
}
