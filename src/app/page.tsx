// 首页(5.2):未登录 → 营销首页(LandingView);已登录 → 服务端重定向工作台(DesignRules 首页)。
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LandingView } from "@/components/landing/landing-view";

export const metadata: Metadata = {
  title: "CareerOS AI - AI 职业成长操作系统",
  description:
    "CareerOS AI 通过职业画像、岗位匹配、成长路线、简历优化与模拟面试，帮你建立从自我认知到拿下面试的完整求职闭环。",
};

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return <LandingView />;
}
