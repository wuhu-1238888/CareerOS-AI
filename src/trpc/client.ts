// 客户端 tRPC React hook 入口(类型来自 AppRouter,端到端类型安全)
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@/lib/trpc/router";

export const trpc = createTRPCReact<AppRouter>();
