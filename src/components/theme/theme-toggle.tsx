"use client";
// 主题切换(6.9):三态按钮组(radiogroup 语义,aria-checked + Check 标记,颜色 + 符号双通道)。
// variant "menu" 用于顶栏头像下拉(紧凑),"card" 用于设置页外观卡(宽松)。
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type Theme } from "./theme-provider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string; icon: typeof Monitor }[] = [
  { value: "system", label: "跟随系统", icon: Monitor },
  { value: "light", label: "浅色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
];

export function ThemeToggle({ variant = "menu" }: { variant?: "menu" | "card" }) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="主题模式"
      className={cn("grid grid-cols-3", variant === "menu" ? "gap-1" : "gap-2")}
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(option.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-control border font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              variant === "menu" ? "px-1.5 py-1.5 text-caption" : "px-2 py-2 text-body-sm",
              selected
                ? "border-green-600 bg-green-50 text-green-700"
                : "border-hairline text-ink-secondary hover:bg-sunken hover:text-ink"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {option.label}
            {selected ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}
