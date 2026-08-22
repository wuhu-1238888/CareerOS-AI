import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ResumeHub } from "@/components/resume/resume-hub";

export const metadata: Metadata = { title: "简历优化 - CareerOS AI" };

// 简历智能模块(4.3):ResumeHub 接管页面状态机(上传/粘贴 → AI 解析 → 核对修正;4.4 起优化结果);
// 4.12 起 hub 用 useSearchParams 读 ?resumeId / ?upload(Next 14 静态渲染要求 Suspense 边界)
export default function ResumePage() {
  return (
    <>
      <PageHeader title="简历优化" description="智能解析与优化你的简历,提升求职竞争力" />
      <Suspense fallback={null}>
        <ResumeHub />
      </Suspense>
    </>
  );
}
