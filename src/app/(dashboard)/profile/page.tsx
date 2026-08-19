import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ModulePlaceholder } from "@/components/shared/module-placeholder";

export const metadata: Metadata = { title: "职业画像 - CareerOS AI" };

// 职业画像模块(1.7 占位,里程碑 M2 建设):画像编辑、SkillRadar、AI 分析
export default function ProfilePage() {
  return (
    <>
      <PageHeader title="职业画像" description="梳理你的教育背景、技能与兴趣,构建专属职业画像" />
      <ModulePlaceholder moduleName="职业画像模块" milestone="M2" />
    </>
  );
}
