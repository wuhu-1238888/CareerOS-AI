// 受保护路由守卫(Edge 运行时):仅拦截 (dashboard) 组页面,未登录重定向到 /login?callbackUrl=…
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/navigator/:path*",
    "/resume/:path*",
    "/settings/:path*",
  ],
};
