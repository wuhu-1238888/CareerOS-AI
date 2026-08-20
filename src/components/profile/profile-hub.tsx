"use client";
// 职业画像页状态枢纽(2.2 起):加载骨架 / 无画像→四步采集表单 / 有画像→结果视图(2.5 接入)
// 2.2 阶段提交仅保存画像数据(profile.create/update);2.4 起提交切换为分析管线
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/trpc/client";
import { ProfileForm } from "./profile-form";
import type { ProfileData } from "@/lib/profile/schemas";

export function ProfileHub() {
  const utils = trpc.useUtils();
  const me = trpc.user.me.useQuery();
  const profile = trpc.profile.get.useQuery();
  const create = trpc.profile.create.useMutation();
  const update = trpc.profile.update.useMutation();

  if (me.isLoading || profile.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[640px] space-y-4 px-4 py-6" aria-label="加载中">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const hasResult = !!profile.data?.aiAnalysis;
  const draftKey = me.data ? `careeros:profile-draft:${me.data.id}` : undefined;

  if (hasResult) {
    // 占位:分析结果视图在 2.5 接入
    return (
      <div className="mx-auto w-full max-w-[640px] rounded-card border border-hairline bg-surface p-10 text-center shadow-card">
        <p className="text-body text-ink-muted">画像分析结果即将在此展示</p>
      </div>
    );
  }

  return (
    <ProfileForm
      initialData={profile.data?.data}
      draftKey={draftKey}
      onSubmit={async (data: ProfileData) => {
        if (profile.data) {
          await update.mutateAsync(data);
        } else {
          await create.mutateAsync(data);
        }
        await utils.profile.get.invalidate();
      }}
    />
  );
}
