import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileHub } from "@/components/profile/profile-hub";

export const metadata: Metadata = { title: "职业画像 - CareerOS AI" };

// 职业画像模块(M2):状态枢纽 ProfileHub 按「无画像/分析中/已有画像」渲染采集表单、过程页与结果页
export default function ProfilePage() {
  return (
    <>
      <PageHeader title="职业画像" description="梳理你的教育背景、技能与兴趣,构建专属职业画像" />
      <ProfileHub />
    </>
  );
}
