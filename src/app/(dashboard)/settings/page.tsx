import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { ResumeFiles } from "@/components/settings/resume-files";

export const metadata: Metadata = { title: "个人设置 - CareerOS AI" };

// 个人设置(1.8):基本资料(昵称/头像配色)、修改密码、简历文件管理(空态)
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="个人设置" description="管理你的账号资料与安全" />
      <div className="mx-auto max-w-[640px] space-y-6">
        <ProfileForm />
        <PasswordForm />
        <ResumeFiles />
      </div>
    </>
  );
}
