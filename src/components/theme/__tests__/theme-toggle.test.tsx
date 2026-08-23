// 主题切换测试(6.9):radiogroup 三态语义、aria-checked 随主题转移、menu/card 两变体。
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "../theme-provider";
import { ThemeToggle } from "../theme-toggle";

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

function renderWithProvider(variant?: "menu" | "card") {
  return render(
    <ThemeProvider>
      <ThemeToggle variant={variant} />
    </ThemeProvider>
  );
}

describe("ThemeToggle", () => {
  it("menu 变体:radiogroup 含三态,默认跟随系统选中", () => {
    renderWithProvider();
    const group = screen.getByRole("radiogroup", { name: "主题模式" });
    const radios = within(group).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    expect(within(group).getByRole("radio", { name: /跟随系统/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(within(group).getByRole("radio", { name: /浅色/ })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(within(group).getByRole("radio", { name: /深色/ })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("点深色 → aria-checked 转移 + 持久化 + html 挂 dark 类", async () => {
    const user = userEvent.setup();
    renderWithProvider();
    await user.click(screen.getByRole("radio", { name: /深色/ }));
    expect(screen.getByRole("radio", { name: /深色/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /跟随系统/ })).toHaveAttribute(
      "aria-checked",
      "false"
    );
    expect(window.localStorage.getItem("careeros-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("card 变体:同三态结构", () => {
    renderWithProvider("card");
    const group = screen.getByRole("radiogroup", { name: "主题模式" });
    expect(within(group).getAllByRole("radio")).toHaveLength(3);
    expect(within(group).getByRole("radio", { name: /跟随系统/ })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });
});
