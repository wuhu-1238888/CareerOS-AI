// @vitest-environment jsdom
// 网关异常响应防御测试(2026-11):生产经 Cloudflare/PocketBay 前置,长请求被截断时返回
// HTML 524 错误页/平台挑战页/空 204 —— resilientFetch 应转为友好中文错误,而不是让
// httpBatchLink 抛「Unexpected token '<', "<!DOCTYPE …" is not valid JSON」。
import { describe, expect, it, vi, afterEach } from "vitest";
import { resilientFetch } from "../provider";

function htmlResponse(status: number, body = "<!DOCTYPE html><html>gateway error</html>") {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("resilientFetch(网关异常响应防御)", () => {
  it("HTML 错误页(如 524 超时/403 挑战页):抛友好中文错误,不把 HTML 当数据解析", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(524)));
    await expect(resilientFetch("/api/trpc")).rejects.toThrow(
      "服务暂时不可用(网关响应异常),请稍后重试"
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(htmlResponse(403)));
    await expect(resilientFetch("/api/trpc")).rejects.toThrow(
      "服务暂时不可用(网关响应异常),请稍后重试"
    );
  });

  it("空响应(204,无 content-type):同样转为友好错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(resilientFetch("/api/trpc")).rejects.toThrow(
      "服务暂时不可用(网关响应异常),请稍后重试"
    );
  });

  it("合法 JSON 响应(含 tRPC 业务错误的非 2xx JSON):原样透传", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('{"error":{"message":"boom"}}', {
          status: 200,
          headers: { "content-type": "application/json" },
        })
      )
    );
    const ok = await resilientFetch("/api/trpc");
    expect(ok.status).toBe(200);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response('[{"error":{"json":{"message":"bad input"}}}]', {
          status: 400,
          headers: { "content-type": "application/json" },
        })
      )
    );
    const err = await resilientFetch("/api/trpc");
    expect(err.status).toBe(400);
  });

  it("网络层失败:原样向上抛(不做包装)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(resilientFetch("/api/trpc")).rejects.toThrow("fetch failed");
  });
});
