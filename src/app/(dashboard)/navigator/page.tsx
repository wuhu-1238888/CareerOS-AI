import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "成长路线 - CareerOS AI" };

// 职业导航模块(1.7 占位,里程碑 M3 建设):方向匹配、成长路线与任务
export default function NavigatorPage() {
  return (
    <>
      <PageHeader title="成长路线" description="探索适合你的职业方向,制定可执行的成长计划" />
      <ModulePlaceholder moduleName="成长路线模块" milestone="M3" />
    </>
  );
}
