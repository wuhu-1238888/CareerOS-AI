"use client";
// 基本资料表单(1.8):昵称 + 首字母头像配色(5 预设色)。保存后 invalidate user.me,顶栏实时同步。
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/trpc/client";
import { AVATAR_COLORS, UserAvatar } from "@/components/shared/user-avatar";

export const AVATAR_COLOR_NAMES = ["松绿", "罗兰紫", "琥珀", "湖蓝", "石板灰"] as const;

export function ProfileForm() {
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const mutation = trpc.user.updateProfile.useMutation({
    onSuccess: async () => {
      await utils.user.me.invalidate();
    },
  });

  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [serverError, setServerError] = useState("");
  const [saved, setSaved] = useState(false);

  // 查询数据到达后填充表单初始值(me 数据来自顶栏同源查询)
  useEffect(() => {
    if (me.data) {
      setName(me.data.name);
      setColor(me.data.avatarColor);
    }
  }, [me.data]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError("");
    setSaved(false);
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("请输入昵称");
      return;
    }
    if (trimmed.length > 30) {
      setNameError("昵称最多 30 个字符");
      return;
    }
    setNameError("");
    mutation.mutateAsync({ name: trimmed, avatarColor: color })
      .then(() => setSaved(true))
      .catch((err) => {
        const data = (err as { data?: { code?: string; zodError?: { fieldErrors?: { name?: string[] } } } }).data;
        if (data?.zodError?.fieldErrors?.name?.[0]) {
          setNameError(data.zodError.fieldErrors.name[0]);
          return;
        }
        setServerError("保存失败,请稍后重试");
      });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-card border border-hairline bg-surface p-6 shadow-card">
      <h2 className="text-body-lg font-medium text-ink">基本资料</h2>
      <p className="mt-1 text-body-sm text-ink-muted">昵称与头像配色会展示在工作台顶栏</p>

      <div className="mt-6 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="settings-name">昵称</Label>
          <Input
            id="settings-name"
            type="text"
            autoComplete="nickname"
            placeholder="怎么称呼你"
            value={name}
            disabled={me.isLoading}
            onChange={(e) => {
              setName(e.target.value);
              setNameError("");
              setSaved(false);
            }}
            aria-invalid={!!nameError}
            className={`max-w-[320px] ${nameError ? "border-danger" : ""}`}
          />
          {nameError ? <p className="text-body-sm text-danger">{nameError}</p> : null}
        </div>

        <div className="space-y-2">
          <Label>头像配色</Label>
          <div className="flex items-center gap-4">
            <UserAvatar name={name || me.data?.name || "?"} color={color} />
            <div role="group" aria-label="头像颜色" className="flex items-center gap-2">
              {AVATAR_COLORS.map((preset, index) => {
                const selected = color === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-label={`头像颜色:${AVATAR_COLOR_NAMES[index]}`}
                    aria-pressed={selected}
                    onClick={() => {
                      setColor(preset);
                      setSaved(false);
                    }}
                    className={`size-7 rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                      selected ? "ring-2 ring-green-600 ring-offset-2" : ""
                    }`}
                    style={{ backgroundColor: preset }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {serverError ? (
          <p role="alert" className="text-body-sm text-danger">
            {serverError}
          </p>
        ) : null}
        {saved ? <p className="text-body-sm text-success">已保存,顶栏头像已同步</p> : null}

        <Button type="submit" disabled={me.isLoading || mutation.isPending}>
          {mutation.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          {mutation.isPending ? "保存中…" : "保存资料"}
        </Button>
      </div>
    </form>
  );
}
