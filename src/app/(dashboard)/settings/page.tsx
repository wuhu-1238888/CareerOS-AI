import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { AppearanceForm } from "@/components/settings/appearance-form";

export const metadata: Metadata = { title: "个人设置 - CareerOS AI" };

// 个人设置(1.8):基本资料(昵称/头像配色)、修改密码。
// 4.13:简历文件管理已整体迁移至顶级导航「简历中心」(/resumes),简历不再是设置项。
// 6.9:外观(主题三态切换)。
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="个人设置" description="管理你的账号资料与安全" />
      <div className="mx-auto max-w-[640px] space-y-6">
        <ProfileForm />
        <PasswordForm />
        <AppearanceForm />
      </div>
    </>
  );
}
