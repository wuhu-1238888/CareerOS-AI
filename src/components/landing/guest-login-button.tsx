"use client";
// 「游客预览」按钮:用预置演示账号走现有 Credentials 登录流程,一键进入只读演示模式。
// 失败提示不暴露账号细节;成功后进入工作台(演示数据由 prisma/demo-seed.ts 预置)。
import { useState } from "react";
import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo-account";

export function GuestLoginButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleGuestLogin() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (res?.error) {
        toast.error("演示数据尚未初始化，请先注册体验");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("进入演示失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={className}
      disabled={loading}
      onClick={handleGuestLogin}
    >
      <Eye aria-hidden />
      {loading ? "正在进入…" : "游客预览"}
    </Button>
  );
}
