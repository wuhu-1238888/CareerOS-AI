"use client";
// 联动提示横幅(8.1b,进入页面时评估 D3):按 (kind, refVersion) 去重 —— 关闭后同版本不再出现,
// 画像新版本/路线图重新生成后才再现(版本隔离不串数据)。
// 视觉复用 next-step-card 语言:green-50 底 + 左 3px green-600 边;role="status" 供测试与读屏定位。
// 只提示不写入(D2/D3):不自动修改简历、不自动重新生成路线图,CTA 仅作引导入口。
import Link from "next/link";
import { ArrowRight, Compass, FolderKanban, X } from "lucide-react";
import { trpc } from "@/trpc/client";
import type { LinkageRule } from "@/lib/linkage/rules";

function Banner({ rule, onDismiss }: { rule: LinkageRule; onDismiss: () => void }) {
  if (rule.kind === "resume_project") {
    const deliverableText = rule.deliverable ? `(产出物:${rule.deliverable})` : "";
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-4 rounded-r-control border-l-[3px] border-l-green-600 bg-green-50 p-4"
      >
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
        >
          <FolderKanban className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold text-green-700">路线图项目可加入简历</p>
          <p className="mt-0.5 text-body-sm text-ink">
            你在「{rule.stageName}」阶段完成了实践项目「{rule.projectTitle}」{deliverableText},
            简历中还没有它,建议手动补充到简历的项目经历。
          </p>
        </div>
        <Link
          className="flex items-center gap-1 text-body-sm font-medium text-green-700 hover:underline"
          href="/navigator?focus=current"
        >
          查看项目
          <ArrowRight aria-hidden className="size-4" />
        </Link>
        <button
          type="button"
          aria-label="关闭提示"
          onClick={onDismiss}
          className="rounded-control p-1 text-ink-muted hover:bg-green-100 hover:text-ink"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    );
  }
  const date = rule.profileUpdatedAt.slice(0, 10);
  const isResume = rule.kind === "resume_outdated";
  const staleText = isResume ? "简历优化内容可能已过时,建议重新优化" : "当前成长路线可能需重新生成";
  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-4 rounded-r-control border-l-[3px] border-l-green-600 bg-green-50 p-4"
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"
      >
        <Compass className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-caption font-semibold text-green-700">画像已更新</p>
        <p className="mt-0.5 text-body-sm text-ink">
          你的职业画像已于 {date} 更新,{staleText}。
        </p>
      </div>
      <Link
        className="flex items-center gap-1 text-body-sm font-medium text-green-700 hover:underline"
        href="/profile"
      >
        查看画像
        <ArrowRight aria-hidden className="size-4" />
      </Link>
      <button
        type="button"
        aria-label="关闭提示"
        onClick={onDismiss}
        className="rounded-control p-1 text-ink-muted hover:bg-green-100 hover:text-ink"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

export function LinkageBanners({ kinds }: { kinds: LinkageRule["kind"][] }) {
  const utils = trpc.useUtils();
  const rules = trpc.linkage.rules.useQuery();
  const dismiss = trpc.linkage.dismiss.useMutation({
    onSuccess: () => void utils.linkage.rules.invalidate(),
  });
  const active = (rules.data ?? []).filter((rule) => kinds.includes(rule.kind));
  if (active.length === 0) return null;
  return (
    <div className="w-full space-y-3" aria-label="联动提示">
      {active.map((rule) => (
        <Banner
          key={`${rule.kind}:${rule.refVersion}`}
          rule={rule}
          onDismiss={() => dismiss.mutate({ kind: rule.kind, refVersion: rule.refVersion })}
        />
      ))}
    </div>
  );
}
