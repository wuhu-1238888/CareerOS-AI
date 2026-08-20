"use client";
// Dashboard 问候行(2.7 / PRD 5.2):用户名 + 画像更新状态一句话;最新画像超过 7 天 → 建议更新提示。
// 完整工作台(KPI 行/Agent 区/模块入口)属任务 5.1,此处只实现 M2 要求的画像状态提示,不扩功能。
import Link from "next/link";
import { trpc } from "@/trpc/client";

// 决策 5:画像信息超过 7 天视为过时(「信息有变化」的可操作判据,常量可调)
const STALE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("zh-CN", { year: "numeric", month: "short", day: "numeric" });
}

export function ProfileHint() {
  const me = trpc.user.me.useQuery();
  const profile = trpc.profile.get.useQuery();

  if (me.isLoading || profile.isLoading || !me.data) {
    return null;
  }

  // 有分析结果才算「已有画像」(仅数据行无分析 = 未完成,引导去完成)
  const hasProfile = !!profile.data?.aiAnalysis;
  const stale =
    hasProfile && profile.data
      ? Date.now() - new Date(profile.data.createdAt).getTime() > STALE_DAYS * DAY_MS
      : false;

  return (
    <section className="rounded-card border border-hairline bg-surface p-6 shadow-card">
      <h1 className="text-body-lg font-medium text-ink">你好,{me.data.name}</h1>
      {hasProfile && profile.data ? (
        <p className="mt-1 text-body-sm text-ink-secondary">
          画像 v{profile.data.version} · 已更新于 {formatDate(profile.data.createdAt)}
        </p>
      ) : (
        <p className="mt-1 text-body-sm text-ink-muted">
          还没有职业画像,完成画像后获得专属方向与建议
          <Link className="ml-1 text-green-600 underline-offset-2 hover:underline" href="/profile">
            去创建
          </Link>
        </p>
      )}
      {stale && (
        <p className="mt-3 rounded-control bg-warning-bg p-3 text-body-sm text-warning">
          画像信息已超过 7 天,建议更新以获得更准确的建议
          <Link className="ml-2 underline underline-offset-2" href="/profile">
            更新画像
          </Link>
        </p>
      )}
    </section>
  );
}
