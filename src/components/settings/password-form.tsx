"use client";
// 修改密码表单(1.8):当前密码 + 新密码 + 确认;成功清空并提示;当前密码错误映射到字段
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/trpc/client";

type FieldErrors = { currentPassword?: string; newPassword?: string; confirmPassword?: string };

export function PasswordForm() {
  const mutation = trpc.user.changePassword.useMutation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [success, setSuccess] = useState("");

  function validateAll() {
    const next: FieldErrors = {};
    if (!currentPassword) next.currentPassword = "请输入当前密码";
    if (!newPassword) next.newPassword = "请输入新密码";
    else if (newPassword.length < 8) next.newPassword = "新密码至少 8 位";
    else if (newPassword.length > 72) next.newPassword = "新密码最多 72 位";
    if (confirmPassword && confirmPassword !== newPassword) next.confirmPassword = "两次输入的新密码不一致";
    setFieldErrors(next);
    return !next.currentPassword && !next.newPassword && !next.confirmPassword;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    setSuccess("");
    if (!validateAll()) return;
    mutation
      .mutateAsync({ currentPassword, newPassword })
      .then(() => {
        setSuccess("密码已修改,下次登录请使用新密码");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      })
      .catch((err) => {
        const data = (err as { data?: { code?: string } }).data;
        if (data?.code === "BAD_REQUEST") {
          setFieldErrors((prev) => ({ ...prev, currentPassword: (err as Error).message || "当前密码不正确" }));
          return;
        }
        setServerError("修改失败,请稍后重试");
      });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-card border border-hairline bg-surface p-6 shadow-card">
      <h2 className="text-body-lg font-medium text-ink">修改密码</h2>
      <p className="mt-1 text-body-sm text-ink-muted">建议定期更换密码,至少 8 位</p>

      <div className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="current-password">当前密码</Label>
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => {
              setCurrentPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
            }}
            aria-invalid={!!fieldErrors.currentPassword}
            className={`max-w-[320px] ${fieldErrors.currentPassword ? "border-danger" : ""}`}
          />
          {fieldErrors.currentPassword ? (
            <p className="text-body-sm text-danger">{fieldErrors.currentPassword}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password">新密码</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="至少 8 位"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
            }}
            aria-invalid={!!fieldErrors.newPassword}
            className={`max-w-[320px] ${fieldErrors.newPassword ? "border-danger" : ""}`}
          />
          {fieldErrors.newPassword ? <p className="text-body-sm text-danger">{fieldErrors.newPassword}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">确认新密码</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
            }}
            aria-invalid={!!fieldErrors.confirmPassword}
            className={`max-w-[320px] ${fieldErrors.confirmPassword ? "border-danger" : ""}`}
          />
          {fieldErrors.confirmPassword ? (
            <p className="text-body-sm text-danger">{fieldErrors.confirmPassword}</p>
          ) : null}
        </div>

        {serverError ? (
          <p role="alert" className="text-body-sm text-danger">
            {serverError}
          </p>
        ) : null}
        {success ? <p className="text-body-sm text-success">{success}</p> : null}

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {mutation.isPending ? "提交中…" : "修改密码"}
        </Button>
      </div>
    </form>
  );
}
