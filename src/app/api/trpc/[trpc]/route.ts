// tRPC HTTP 端点(框架必需 Route Handler;其余 API 一律经 tRPC,见 technical-design API 层约定)
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/lib/trpc/router";
import { createContext } from "@/lib/trpc/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
    // 2026-08:服务端错误观测(此前 500 排查无日志接入点)。
    // 仅 console.error,不修改返回给客户端的 payload;刻意不记录 input(简历/回答等用户内容,避免敏感信息进日志)
    onError: ({ error, type, path }) => {
      console.error(
        `[trpc] ${type} ${path ?? "<unknown>"} failed: ${error.code} ${error.message}`,
        error.stack
      );
    },
  });

export { handler as GET, handler as POST };
