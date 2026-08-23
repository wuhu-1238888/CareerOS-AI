"use client";
// 设置页「外观」卡(6.9):主题三态切换(ThemeToggle variant card)+ 当前生效模式说明。
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTheme } from "@/components/theme/theme-provider";

const THEME_DESC: Record<string, string> = {
  system: "当前跟随操作系统主题自动切换",
  light: "当前始终使用浅色主题",
  dark: "当前始终使用深色主题",
};

export function AppearanceForm() {
  const { theme } = useTheme();
  return (
    <section
      className="rounded-card border border-hairline bg-surface p-6 shadow-card"
      aria-label="外观设置"
    >
      <h2 className="text-h3 text-ink">外观</h2>
      <p className="mt-1 text-body-sm text-ink-muted">{THEME_DESC[theme]}</p>
      <div className="mt-4 max-w-[320px]">
        <ThemeToggle variant="card" />
      </div>
    </section>
  );
}
