import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "工作台 - CareerOS AI" };

// 工作台(1.7 占位):跨模块总览与今日行动,内容随 M2–M5 各模块上线逐步汇聚
export default function DashboardHomePage() {
  return (
    <>
      <PageHeader title="工作台" description="你的职业成长总览与今日行动" />
      <ModulePlaceholder moduleName="工作台内容" milestone="M2 起逐步汇聚" />
    </>
  );
}
