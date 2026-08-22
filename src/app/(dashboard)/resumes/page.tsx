import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ResumeCenter } from "@/components/resume/resume-center";

export const metadata: Metadata = { title: "简历中心 - CareerOS AI" };

// 简历中心(4.13):顶级导航一级页面 —— 全部简历的查看/切换/新增/删除;
// 自个人设置页「简历文件管理」整体迁移(简历是核心业务对象,不是设置项)。
export default function ResumesPage() {
  return (
    <>
      <PageHeader title="简历中心" description="查看、切换与管理你的全部简历" />
      <div className="mx-auto max-w-[860px]">
        <ResumeCenter />
      </div>
    </>
  );
}
