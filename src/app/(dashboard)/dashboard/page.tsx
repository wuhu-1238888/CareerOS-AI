import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata: Metadata = { title: "工作台 - CareerOS AI" };

// 工作台(5.1):问候行 → KPI 行 → Agent 顾问区 → 模块入口区(四态齐全,DesignRules Dashboard);
// 2.7 的问候/画像过期提示并入 dashboard-view,占位模块至此移除
export default function DashboardHomePage() {
  return <DashboardView />;
}
