import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("合并多个类名", () => {
    expect(cn("text-sm", "font-medium")).toBe("text-sm font-medium");
  });

  it("跳过假值条件类名", () => {
    expect(cn("base", true && "active", false && "hidden")).toBe(
      "base active",
    );
  });

  it("tailwind-merge 合并冲突类", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
