// @vitest-environment node
// authConfig 守卫逻辑测试(1.4):middleware 的 authorized 回调
import { describe, it, expect } from "vitest";
import type { NextRequest } from "next/server";
import type { Session } from "next-auth";
import { authConfig, isProtectedPath } from "@/lib/auth.config";

const authorized = authConfig.callbacks.authorized;

function requestAt(pathname: string) {
  return { nextUrl: { pathname } } as unknown as NextRequest;
}

// 已登录会话夹具(authorized 只读 auth.user 是否为空)
const loggedInSession: Session = {
  user: { id: "u1", email: "a@b.c", name: "甲" },
  expires: "2030-01-01T00:00:00.000Z",
};

describe("isProtectedPath", () => {
  it("受保护路由及其子路径返回 true", () => {
    expect(isProtectedPath("/dashboard")).toBe(true);
    expect(isProtectedPath("/profile")).toBe(true);
    expect(isProtectedPath("/navigator")).toBe(true);
    expect(isProtectedPath("/resume")).toBe(true);
    expect(isProtectedPath("/interview")).toBe(true); // 7.2 新增:模拟面试页
    expect(isProtectedPath("/settings")).toBe(true);
    expect(isProtectedPath("/settings/account")).toBe(true);
  });

  it("非受保护路由返回 false(含前缀相似路径边界)", () => {
    expect(isProtectedPath("/")).toBe(false);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/register")).toBe(false);
    expect(isProtectedPath("/dashboardx")).toBe(false); // 边界:相似前缀不算受保护
    expect(isProtectedPath("/api/trpc")).toBe(false);
  });
});

describe("authorized 回调(未登录重定向 / 放行)", () => {
  it("未登录访问受保护路由 → false(重定向到登录页)", () => {
    expect(authorized({ auth: null, request: requestAt("/dashboard") })).toBe(false);
    expect(authorized({ auth: null, request: requestAt("/settings") })).toBe(false);
  });

  it("未登录访问公开路由 → true(放行)", () => {
    expect(authorized({ auth: null, request: requestAt("/") })).toBe(true);
    expect(authorized({ auth: null, request: requestAt("/login") })).toBe(true);
    expect(authorized({ auth: null, request: requestAt("/register") })).toBe(true);
  });

  it("已登录访问任意路由 → true", () => {
    expect(authorized({ auth: loggedInSession, request: requestAt("/dashboard") })).toBe(true);
    expect(authorized({ auth: loggedInSession, request: requestAt("/") })).toBe(true);
  });
});
