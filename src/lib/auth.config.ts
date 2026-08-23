// NextAuth v5 边缘安全配置(middleware 与 auth.ts 共用)
// 约定:providers 留空、不引用任何 Node 专属模块(prisma/bcrypt),保证 Edge 运行时可用
import type { NextAuthConfig } from "next-auth";

// 受保护路由:(dashboard) 路由组内的全部页面(工作台 + 四模块 + 设置)
const protectedPaths = ["/dashboard", "/profile", "/navigator", "/resume", "/interview", "/settings"];

export const isProtectedPath = (pathname: string) =>
  protectedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const authConfig = {
  // 自托管部署:信任运行时的 Host 头(生产 start/部署平台无该配置会拒绝认证请求)
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    // middleware 守卫:未登录访问受保护路由 → 重定向到登录页(带 callbackUrl)
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      if (isProtectedPath(request.nextUrl.pathname)) {
        return isLoggedIn;
      }
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
