// 首页(5.2):未登录 → 营销首页(LandingView);已登录 → 服务端重定向工作台(DesignRules 首页)。
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LandingView } from "@/components/landing/landing-view";

export const metadata: Metadata = { title: "CareerOS AI - AI 帮你找到职业方向" };

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  return <LandingView />;
}
