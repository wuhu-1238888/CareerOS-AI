// 演示账号(2026-09 游客预览):登录凭据的单一事实来源,prisma/demo-seed.ts 与 guest-login-button 共用。
// 密码公开属设计内:该账号在 tRPC 层强制只读(router.ts protectedProcedure),演示数据与真实用户隔离。
export const DEMO_EMAIL = "demo@careeros.local";
export const DEMO_PASSWORD = "careeros-demo-2026";
