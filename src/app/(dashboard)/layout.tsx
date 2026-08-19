// (dashboard) 路由组布局:64px 顶栏 + 1160px 内容容器(全部受保护模块页共享;访问控制由 middleware 负责)
import { Topbar } from "@/components/shared/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas">
      <Topbar />
      <main className="mx-auto w-full max-w-[1160px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
