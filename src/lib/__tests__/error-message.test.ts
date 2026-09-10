// friendlyError 单测:兜底 / 中文透传 / zod issue JSON 提取 / 非 JSON 不误伤。
import { describe, expect, it } from "vitest";
import { friendlyError } from "../error-message";

// 实测 bug 串(单个 issue 对象,以 { 开头)
const RAW_ISSUE_JSON =
  '{"code":"too_big","maximum":30,"type":"array","inclusive":true,"exact":false,"message":"技能最多 30 项","path":["parsedData","skills"]}';

describe("friendlyError", () => {
  it("非 Error / 空 message → 兜底文案", () => {
    expect(friendlyError(undefined)).toBe("操作失败,请稍后重试");
    expect(friendlyError(null)).toBe("操作失败,请稍后重试");
    expect(friendlyError("")).toBe("操作失败,请稍后重试");
    expect(friendlyError(new Error(""))).toBe("操作失败,请稍后重试");
  });

  it("普通中文文案原样透传", () => {
    expect(friendlyError(new Error("AI 返回了无法识别的结果,请稍后重试"))).toBe(
      "AI 返回了无法识别的结果,请稍后重试"
    );
    expect(friendlyError(new Error("改写结果与简历原文不一致,请重新分析"))).toBe(
      "改写结果与简历原文不一致,请重新分析"
    );
  });

  it("单个 zod issue 对象 JSON → 提取中文 message(不再显示裸 JSON)", () => {
    expect(friendlyError(new Error(RAW_ISSUE_JSON))).toBe("技能最多 30 项");
  });

  it("issue 数组 JSON → 首个非空 message", () => {
    const arr = JSON.stringify([
      { code: "too_big", message: "技能最多 30 项", path: ["parsedData", "skills"] },
      { code: "too_small", message: "学校不能为空", path: ["parsedData", "education", 0, "school"] },
    ]);
    expect(friendlyError(new Error(arr))).toBe("技能最多 30 项");
  });

  it("{issues:[...]} 形态 → 提取", () => {
    const shape = JSON.stringify({
      issues: [{ code: "custom", message: "开始时间不能为空", path: ["timeRange", "start"] }],
    });
    expect(friendlyError(new Error(shape))).toBe("开始时间不能为空");
  });

  it("扁平化形态 {formErrors, fieldErrors} → 首个字段消息", () => {
    const flat = JSON.stringify({
      formErrors: [],
      fieldErrors: { school: ["学校不能为空"], "timeRange.start": ["开始时间不能为空"] },
    });
    expect(friendlyError(new Error(flat))).toBe("学校不能为空");
    const onlyForm = JSON.stringify({ formErrors: ["请至少填写一项"], fieldErrors: {} });
    expect(friendlyError(new Error(onlyForm))).toBe("请至少填写一项");
  });

  it("以 { / [ 开头但非合法 JSON → 原样透传;合法 JSON 但无 message → 兜底", () => {
    expect(friendlyError(new Error("{ 这不是 JSON"))).toBe("{ 这不是 JSON");
    expect(friendlyError(new Error("[error] 服务端返回了异常"))).toBe("[error] 服务端返回了异常");
    expect(friendlyError(new Error('{"code":"BAD_REQUEST","data":{}}'))).toBe("操作失败,请稍后重试");
  });
});
