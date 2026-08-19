"use client";
// 登录表单:四态(失焦校验 / 提交校验 / 提交中 / 服务端通用错误);错误提示不泄露账号是否存在
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldErrors = { email?: string; password?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validateField(field: "email" | "password", value: string): string | undefined {
    if (!value.trim()) return field === "email" ? "请输入邮箱" : "请输入密码";
    if (field === "email" && !EMAIL_RE.test(value)) return "邮箱格式不正确";
    return undefined;
  }

  function validateAll() {
    const next: FieldErrors = {
      email: validateField("email", email),
      password: validateField("password", password),
    };
    setFieldErrors(next);
    return !next.email && !next.password;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    if (!validateAll()) return;
    setIsSubmitting(true);
    try {
      const res = await signIn("credentials", { redirect: false, email, password });
      if (res?.error) {
        // 通用提示:不区分「账号不存在」与「密码错误」
        setServerError("邮箱或密码错误");
        return;
      }
      const callbackUrl = searchParams.get("callbackUrl");
      router.push(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-card border border-hairline bg-surface p-8 shadow-card">
      <header className="space-y-1 pb-6">
        <h1 className="text-h1 text-ink">登录 CareerOS</h1>
        <p className="text-body-sm text-ink-muted">继续你的职业成长之旅</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">邮箱</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setFieldErrors((prev) => ({ ...prev, email: validateField("email", email) }))}
            aria-invalid={!!fieldErrors.email}
            className={fieldErrors.email ? "border-danger" : ""}
          />
          {fieldErrors.email ? <p className="text-body-sm text-danger">{fieldErrors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">密码</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setFieldErrors((prev) => ({ ...prev, password: validateField("password", password) }))}
            aria-invalid={!!fieldErrors.password}
            className={fieldErrors.password ? "border-danger" : ""}
          />
          {fieldErrors.password ? <p className="text-body-sm text-danger">{fieldErrors.password}</p> : null}
        </div>

        {serverError ? (
          <p role="alert" className="text-body-sm text-danger">
            {serverError}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {isSubmitting ? "登录中…" : "登录"}
        </Button>
      </form>

      <p className="pt-6 text-center text-caption text-ink-muted">
        还没有账号?{" "}
        <Link href="/register" className="text-green-600 hover:text-green-700">
          免费注册
        </Link>
      </p>
    </div>
  );
}
