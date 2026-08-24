"use client";
// tRPC + react-query Provider:包在根布局,为所有客户端组件提供 API 调用能力
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "./client";

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
      links: [httpBatchLink({ url: "/api/trpc" })],
    })
  );
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
