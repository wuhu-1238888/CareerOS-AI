// @vitest-environment node
// 全局上下文信封单测(1.6):版本号 + 来源 Agent + 生成时间自 Phase 1 写入
import { describe, it, expect } from "vitest";
import { GLOBAL_CONTEXT_VERSION, buildContext, mergeContext } from "../context";

describe("buildContext", () => {
  it("携带固定版本号、来源 Agent、ISO 生成时间与数据体", () => {
    const ctx = buildContext("sample-summary", { profileId: "p1" });
    expect(ctx.version).toBe(GLOBAL_CONTEXT_VERSION);
    expect(ctx.sourceAgent).toBe("sample-summary");
    expect(new Date(ctx.generatedAt).toISOString()).toBe(ctx.generatedAt); // 合法 ISO 时间
    expect(ctx.data).toEqual({ profileId: "p1" });
  });
});

describe("mergeContext", () => {
  it("浅合并上游数据,来源与时间戳更新为新 Agent", () => {
    const upstream = buildContext("sample-summary", { profileId: "p1", keywords: ["a"] });
    const merged = mergeContext(upstream, { keywords: ["b"], stage: 2 }, "planner");
    expect(merged.data).toEqual({ profileId: "p1", keywords: ["b"], stage: 2 });
    expect(merged.sourceAgent).toBe("planner");
    // 时间戳重新生成(ISO 字符串可字典序比较;同毫秒内可能相等,故用 >=)
    expect(merged.generatedAt >= upstream.generatedAt).toBe(true);
  });
});
