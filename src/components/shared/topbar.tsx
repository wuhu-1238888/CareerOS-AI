"use client";
// 顶栏(64px):logo + 6 个一级入口(工作台/职业画像/成长路线/岗位匹配/简历优化/模拟面试)+ 头像下拉(设置/退出)。
// 当前入口高亮(aria-current + 绿色态);<768px 导航折叠为左侧抽屉。无侧栏、无渐变(DesignRules)。
// IA 调整(2026-09):「简历中心」已并入简历优化页「我的简历」Tab(/resume?tab=resumes),不再是顶级入口。
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { LogOut, Menu, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { trpc } from "@/trpc/client";
import { DEMO_EMAIL } from "@/lib/demo-account";
import { UserAvatar } from "./user-avatar";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "工作台" },
  { href: "/profile", label: "职业画像" },
  { href: "/navigator", label: "成长路线" },
  { href: "/matching", label: "岗位匹配" },
  { href: "/resume", label: "简历优化" },
  { href: "/interview", label: "模拟面试" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navLinkClass(active: boolean) {
  return `rounded-control px-3 py-2 text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
    active ? "bg-green-50 font-medium text-green-700" : "text-ink-secondary hover:bg-sunken hover:text-ink"
  }`;
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  // 用户资料走 tRPC:修改昵称/头像色后(1.8)invalidate 即可让顶栏实时同步
  const me = trpc.user.me.useQuery(undefined, { enabled: status === "authenticated" });

  const name = me.data?.name ?? session?.user?.name ?? "";
  const avatarColor = me.data?.avatarColor ?? null;
  // 演示模式(游客预览):顶栏常驻「返回首页」入口与菜单「退出演示」,仅演示账号可见,真实用户零影响
  const isDemo = session?.user?.email === DEMO_EMAIL;

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  // 演示模式(游客预览)退出:返回 Landing Page 固定路由(非 router.back)。
  // 必须先退出演示会话——/ 对任何已登录会话都会服务端重定向 /dashboard,只有回到未登录态才能渲染 Landing Page。
  async function handleExitDemo() {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-[1160px] items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-body-lg font-bold text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            CareerOS<span className="text-green-600"> AI</span>
          </Link>

          <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={navLinkClass(active)}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* 演示模式专属:返回首页(退出演示会话回 Landing Page),移动端与汉堡/头像同行 */}
          {isDemo ? (
            <Button
              type="button"
              variant="ghost"
              className="whitespace-nowrap"
              onClick={() => void handleExitDemo()}
            >
              返回首页
            </Button>
          ) : null}

          {/* 移动端抽屉(<md 折叠) */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="打开导航菜单">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-left text-body-lg font-bold">
                  CareerOS<span className="text-green-600"> AI</span>
                </SheetTitle>
              </SheetHeader>
              <nav aria-label="主导航(移动端)" className="mt-6 flex flex-col gap-1">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={navLinkClass(active)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </SheetContent>
          </Sheet>

          {/* 用户菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="打开用户菜单"
                className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {me.isLoading ? (
                  <div className="size-10 animate-pulse rounded-full bg-sunken" aria-hidden />
                ) : (
                  <UserAvatar name={name || "用"} color={avatarColor} />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="truncate text-body-sm text-ink-secondary">
                {name || "用户"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings className="mr-2 size-4" aria-hidden />
                  个人设置
                </Link>
              </DropdownMenuItem>
              {/* 外观(6.9):三态主题切换,独立成组;非菜单项,点击不关闭下拉 */}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-caption text-ink-muted">外观</DropdownMenuLabel>
              <div className="px-2 pb-1.5 pt-0.5">
                <ThemeToggle variant="menu" />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  void (isDemo ? handleExitDemo() : handleSignOut());
                }}
              >
                <LogOut className="mr-2 size-4" aria-hidden />
                {isDemo ? "退出演示" : "退出登录"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
