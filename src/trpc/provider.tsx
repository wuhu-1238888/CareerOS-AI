"use client";
// tRPC + react-query Provider:包在根布局,为所有客户端组件提供 API 调用能力
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./client";

// 网关异常响应防御(2026-11):生产域名经 Cloudflare/PocketBay 前置,长请求被网关截断时
// 返回的是 HTML 错误页(如 524 超时页)、平台休眠挑战页或空 204 —— 都不是 tRPC JSON。
// httpBatchLink 对这类响应直接 response.json() 会抛「Unexpected token '<', "<!DOCTYPE …" is not valid JSON」,
// 用户只能看到原始解析错误。这里提前按状态码 + Content-Type 识别,转为统一的友好中文错误;
// 合法的 tRPC 错误响应(HTTP 非 2xx 但 body 为 JSON,含 data.httpStatus/code)原样透传给业务层。
export async function resilientFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  const isJson = (res.headers.get("content-type") ?? "").toLowerCase().includes("application/json");
  if (!isJson) {
    // HTML 错误页 / 挑战页 / 空响应(204 等):不把 HTML 当业务数据解析,直接给出明确提示
    throw new Error("服务暂时不可用(网关响应异常),请稍后重试");
  }
  return res;
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 2026-08:服务异常时防请求风暴(500 × retry 3 × 焦点重拉曾放大为全量轮询);
            // 最多重试 1 次、切回标签页不自动全量重拉(staleTime/refetchOnMount 保持默认)
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: "/api/trpc", fetch: resilientFetch })],
    })
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
