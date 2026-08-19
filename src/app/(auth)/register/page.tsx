import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "注册 - CareerOS AI" };

export default function RegisterPage() {
  return <RegisterForm />;
}
