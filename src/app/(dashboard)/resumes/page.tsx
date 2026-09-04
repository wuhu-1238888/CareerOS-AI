import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ResumeCenter } from "@/components/resume/resume-center";

export const metadata: Metadata = { title: "简历中心 - CareerOS AI" };

// 简历中心(4.13):顶级导航一级页面 —— 全部简历的查看/切换/新增/删除;
// 自个人设置页「简历文件管理」整体迁移(简历是核心业务对象,不是设置项)。
// 4.16:核心内容区复用全局 1160px 内容容器(dashboard layout),不再页级收窄 860px ——
// 与工作台/画像/路线图/匹配/简历优化各核心页保持统一内容宽度。
export default function ResumesPage() {
  return (
    <>
      <PageHeader title="简历中心" description="查看、切换与管理你的全部简历" />
      <ResumeCenter />
    </>
  );
}
