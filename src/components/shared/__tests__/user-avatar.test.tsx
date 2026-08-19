// 首字母头像测试(1.7):首字渲染、显式配色优先、自动配色确定性、空名兜底
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar, avatarColorFromName, AVATAR_COLORS } from "../user-avatar";

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

describe("UserAvatar", () => {
  it("渲染昵称首字", () => {
    render(<UserAvatar name="张三" />);
    expect(screen.getByText("张")).toBeInTheDocument();
  });

  it("显式配色优先于自动配色", () => {
    render(<UserAvatar name="张三" color="#0c8a5f" />);
    expect(screen.getByText("张").style.backgroundColor).toBe("rgb(12, 138, 95)");
  });

  it("未设置配色时按名字确定性取预设色", () => {
    const { rerender } = render(<UserAvatar name="李四" />);
    // 渲染结果与确定性函数一致(hex → jsdom 归一化为 rgb)
    expect(screen.getByText("李").style.backgroundColor).toBe(hexToRgb(avatarColorFromName("李四")));
    expect(AVATAR_COLORS).toContain(avatarColorFromName("李四"));
    // 确定性:同名字两次结果一致
    rerender(<UserAvatar name="李四" />);
    expect(screen.getByText("李").style.backgroundColor).toBe(hexToRgb(avatarColorFromName("李四")));
  });

  it("空名字兜底显示 ?", () => {
    render(<UserAvatar name="" />);
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
