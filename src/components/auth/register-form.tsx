"use client";
// 注册表单:昵称 + 邮箱 + 密码。注册成功(库内建用户)后立即以同凭据登录进入工作台。
// 校验:失焦触发 + 提交触发;重复邮箱 / 字段错误分别呈现;密码只提交哈希前原文,服务端仅存哈希。
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/trpc/client";

type FieldErrors = { name?: string; email?: string; password?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function RegisterForm() {
  const router = useRouter();
  const mutation = trpc.user.register.useMutation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");

  const isSubmitting = mutation.isPending;

  function validateField(field: keyof FieldErrors, value: string): string | undefined {
    if (!value.trim()) {
      return field === "name" ? "请输入昵称" : field === "email" ? "请输入邮箱" : "请输入密码";
    }
    if (field === "email" && !EMAIL_RE.test(value)) return "邮箱格式不正确";
    if (field === "password" && value.length < 8) return "密码至少 8 位";
    return undefined;
  }

  function validateAll() {
    const next: FieldErrors = {
      name: validateField("name", name),
      email: validateField("email", email),
      password: validateField("password", password),
    };
    setFieldErrors(next);
    return !next.name && !next.email && !next.password;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    if (!validateAll()) return;
    try {
      await mutation.mutateAsync({ name: name.trim(), email: email.trim(), password });
    } catch (err) {
      const data = (err as { data?: { code?: string; zodError?: { fieldErrors?: FieldErrors } } }).data;
      if (data?.code === "CONFLICT") {
        setServerError("该邮箱已注册");
        return;
      }
      if (data?.zodError?.fieldErrors) {
        setFieldErrors({
          name: data.zodError.fieldErrors.name?.[0],
          email: data.zodError.fieldErrors.email?.[0],
          password: data.zodError.fieldErrors.password?.[0],
        });
        return;
      }
      setServerError("注册失败,请稍后重试");
      return;
    }
    // 注册成功 → 直接登录(同凭据)
    const res = await signIn("credentials", { redirect: false, email: email.trim(), password });
    if (res?.error) {
      setServerError("注册成功,自动登录失败,请前往登录页");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="rounded-card border border-hairline bg-surface p-8 shadow-card">
      <header className="space-y-1 pb-6">
        <h1 className="text-h1 text-ink">创建账号</h1>
        <p className="text-body-sm text-ink-muted">3 分钟建立你的职业画像,开启 AI 陪伴成长</p>
      </header>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">昵称</Label>
          <Input
            id="name"
            type="text"
            autoComplete="nickname"
            placeholder="怎么称呼你"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setFieldErrors((prev) => ({ ...prev, name: validateField("name", name) }))}
            aria-invalid={!!fieldErrors.name}
            className={fieldErrors.name ? "border-danger" : ""}
          />
          {fieldErrors.name ? <p className="text-body-sm text-danger">{fieldErrors.name}</p> : null}
        </div>

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
            autoComplete="new-password"
            placeholder="至少 8 位"
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
          {isSubmitting ? "注册中…" : "免费注册"}
        </Button>
      </form>

      <p className="pt-6 text-center text-caption text-ink-muted">
        已有账号?{" "}
        <Link href="/login" className="text-green-600 hover:text-green-700">
          直接登录
        </Link>
      </p>
    </div>
  );
}
