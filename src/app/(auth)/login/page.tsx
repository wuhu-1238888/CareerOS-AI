import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "登录 - CareerOS AI" };

export default function LoginPage() {
  // useSearchParams 需 Suspense 边界(Next 14 静态渲染要求)
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
