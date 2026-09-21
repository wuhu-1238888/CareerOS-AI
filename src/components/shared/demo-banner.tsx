"use client";
// 演示模式横幅(2026-09 游客预览):演示账号登录后常驻于顶栏下方,声明只读并引导注册。
// 仅演示账号可见(session 邮箱匹配),正常用户零影响。
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Eye } from "lucide-react";
import { DEMO_EMAIL } from "@/lib/demo-account";

export function DemoBanner() {
  const { data: session } = useSession();
  if (session?.user?.email !== DEMO_EMAIL) return null;
  return (
    <div className="border-b border-hairline bg-green-50">
      <div className="mx-auto flex w-full max-w-[1160px] flex-wrap items-center justify-center gap-x-2 gap-y-1 px-4 py-2 text-body-sm text-ink-secondary sm:px-6">
        <Eye className="size-4 text-green-600" aria-hidden />
        当前为演示模式（只读），你的操作不会被保存。
        <Link
          href="/register"
          className="font-medium text-green-700 hover:text-green-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          注册后开始你的真实探索
        </Link>
      </div>
    </div>
  );
}
