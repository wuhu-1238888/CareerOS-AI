// 认证页布局:居中卡片(登录 / 注册共用)
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-[400px]">{children}</div>
    </main>
  );
}
