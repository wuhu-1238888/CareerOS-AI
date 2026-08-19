// @vitest-environment node
// Agent 注册表单测(1.6):登记 / 清单 / 意图路由(显式意图优先、Agent 名兜底、未命中报错)
import { describe, it, expect } from "vitest";
import { AgentRegistry } from "../registry";
import { AgentNotFoundError } from "../types";
import { SummaryAgent } from "./fixtures";

describe("AgentRegistry", () => {
  it("register 后可按名取回,list 返回配置清单", () => {
    const reg = new AgentRegistry();
    reg.register(new SummaryAgent());
    expect(reg.get("sample-summary")?.config.name).toBe("sample-summary");
    expect(reg.list().map((c) => c.name)).toEqual(["sample-summary"]);
  });

  it("findByIntent:未声明显式意图时按 Agent 名匹配", () => {
    const reg = new AgentRegistry();
    reg.register(new SummaryAgent());
    expect(reg.findByIntent("sample-summary").config.name).toBe("sample-summary");
  });

  it("findByIntent:显式意图路由优先于名称匹配", () => {
    const reg = new AgentRegistry();
    reg.register(new SummaryAgent());
    reg.registerIntent("analyze-profile", "sample-summary");
    expect(reg.findByIntent("analyze-profile").config.name).toBe("sample-summary");
  });

  it("findByIntent:未注册意图 → AgentNotFoundError", () => {
    const reg = new AgentRegistry();
    reg.register(new SummaryAgent());
    expect(() => reg.findByIntent("unknown-intent")).toThrow(AgentNotFoundError);
  });
});
