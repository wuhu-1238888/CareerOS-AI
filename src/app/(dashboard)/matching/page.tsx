import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { MatchingHub } from "@/components/matching/matching-hub";

export const metadata: Metadata = { title: "岗位匹配 - CareerOS AI" };

// 岗位匹配模块(6.2):粘贴 JD → 匹配报告 → 一键发起 90 天提升计划(技能分析,6.4 视图态共用本入口)
export default function MatchingPage() {
  return (
    <>
      <PageHeader title="岗位匹配" description="粘贴岗位描述,AI 拆解要求并评估你的匹配度" />
      <MatchingHub />
    </>
  );
}
