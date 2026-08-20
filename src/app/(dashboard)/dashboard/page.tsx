import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";
import { ProfileHint } from "@/components/dashboard/profile-hint";

export const metadata: Metadata = { title: "工作台 - CareerOS AI" };

// 工作台(1.7 占位):跨模块总览与今日行动,内容随 M2–M5 各模块上线逐步汇聚;
// 2.7 接入问候行(画像更新状态 + 7 天过期提示,PRD 5.2),完整工作台属任务 5.1
export default function DashboardHomePage() {
  return (
    <>
      <PageHeader title="工作台" description="你的职业成长总览与今日行动" />
      <div className="mx-auto w-full max-w-[640px] space-y-4 px-4 py-6">
        <ProfileHint />
        <ModulePlaceholder moduleName="工作台内容" milestone="M2 起逐步汇聚" />
      </div>
    </>
  );
}
