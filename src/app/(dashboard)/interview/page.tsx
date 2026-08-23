import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { InterviewHub } from "@/components/interview/interview-hub";

export const metadata: Metadata = { title: "模拟面试 - CareerOS AI" };

// 模拟面试模块(7.2):设定场次 → AI 面试官逐题提问 → 每题作答即时评估与追问 → 综合报告
export default function InterviewPage() {
  return (
    <>
      <PageHeader title="模拟面试" description="AI 面试官根据你的简历出题,逐题作答并获得即时反馈" />
      <InterviewHub />
    </>
  );
}
