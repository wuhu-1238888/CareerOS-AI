// 外观卡测试(6.9):说明文案随主题状态变化,内含 card 变体三态切换组。
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { AppearanceForm } from "../appearance-form";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

function renderWithProvider() {
  return render(
    <ThemeProvider>
      <AppearanceForm />
    </ThemeProvider>
  );
}

describe("AppearanceForm", () => {
  it("默认跟随系统 → 显示对应说明 + card 变体三态切换组", () => {
    renderWithProvider();
    expect(screen.getByLabelText("外观设置")).toBeInTheDocument();
    expect(screen.getByText("当前跟随操作系统主题自动切换")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "主题模式" })).toBeInTheDocument();
  });

  it("切深色 → 说明更新 + 持久化", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByRole("radio", { name: /深色/ }));
    expect(screen.getByText("当前始终使用深色主题")).toBeInTheDocument();
    expect(window.localStorage.getItem("careeros-theme")).toBe("dark");
  });
});
