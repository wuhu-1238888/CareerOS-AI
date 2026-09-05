import { Suspense } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ResumeTabs } from "@/components/resume/resume-tabs";

export const metadata: Metadata = { title: "简历优化 - CareerOS AI" };

// 简历智能模块(4.3):ResumeHub 接管页面状态机(上传/粘贴 → AI 解析 → 核对修正;4.4 起优化结果);
// 4.12 起 hub 用 useSearchParams 读 ?resumeId / ?upload(Next 14 静态渲染要求 Suspense 边界)。
// IA 调整(2026-09):原「简历中心」并入本页,ResumeTabs 提供「简历优化 / 我的简历」页内二级切换(?tab=resumes)。
export default function ResumePage() {
  return (
    <>
      <PageHeader title="简历优化" description="智能解析与优化你的简历,提升求职竞争力" />
      <Suspense fallback={null}>
        <ResumeTabs />
      </Suspense>
    </>
  );
}
