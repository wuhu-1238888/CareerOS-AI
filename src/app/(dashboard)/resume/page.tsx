import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "简历优化 - CareerOS AI" };

// 简历智能模块(1.7 占位,里程碑 M4 建设):简历解析、优化与 ATS 评分
export default function ResumePage() {
  return (
    <>
      <PageHeader title="简历优化" description="智能解析与优化你的简历,提升求职竞争力" />
      <ModulePlaceholder moduleName="简历优化模块" milestone="M4" />
    </>
  );
}
