import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = { title: "工作台 - CareerOS AI" };

// 工作台(5.1 + IA 重构):问候行 → 下一步建议 → KPI 行(3 卡) → AI 洞察 → 成长概览(四态齐全,DesignRules Dashboard);
// 2.7 的问候/画像过期提示并入 dashboard-view,占位模块至此移除
export default function DashboardHomePage() {
  return <DashboardView />;
}
