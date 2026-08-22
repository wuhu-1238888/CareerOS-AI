// 相对时间格式化测试(5.1):今天/昨天 HH:mm、同年 M月D日、跨年 YYYY年M月D日、无效时间空串
import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "../format";

// 固定「现在」:2026-08-18(周二)15:00 本地
const now = new Date(2026, 7, 18, 15, 0, 0);

describe("formatRelativeTime", () => {
  it("今天:今天 HH:mm(补零)", () => {
    expect(formatRelativeTime(new Date(2026, 7, 18, 9, 5).toISOString(), now)).toBe("今天 09:05");
  });

  it("昨天:昨天 HH:mm", () => {
    expect(formatRelativeTime(new Date(2026, 7, 17, 20, 14).toISOString(), now)).toBe("昨天 20:14");
  });

  it("同年更早:M月D日 HH:mm", () => {
    expect(formatRelativeTime(new Date(2026, 6, 30, 8, 0).toISOString(), now)).toBe("7月30日 08:00");
  });

  it("跨年:YYYY年M月D日", () => {
    expect(formatRelativeTime(new Date(2025, 11, 31, 23, 59).toISOString(), now)).toBe("2025年12月31日");
  });

  it("无效时间:空串", () => {
    expect(formatRelativeTime("not-a-date", now)).toBe("");
  });

  it("时钟偏移(未来时间):按「今天」兜底", () => {
    expect(formatRelativeTime(new Date(2026, 7, 18, 23, 0).toISOString(), now)).toBe("今天 23:00");
  });
});
