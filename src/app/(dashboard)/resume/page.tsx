import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ResumeUpload } from "@/components/resume/resume-upload";

export const metadata: Metadata = { title: "简历优化 - CareerOS AI" };

// 简历智能模块(4.1):文件上传与粘贴;解析/优化阶段 4.3 起接入(ResumeHub 接管页面状态机)
export default function ResumePage() {
  return (
    <>
      <PageHeader title="简历优化" description="智能解析与优化你的简历,提升求职竞争力" />
      <ResumeUpload />
    </>
  );
}
