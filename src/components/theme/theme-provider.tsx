"use client";
// 主题提供者(6.9):手写三态(跟随系统 system / 浅色 light / 深色 dark),不引 next-themes。
// localStorage careeros-theme(非法值或缺省 → system);system 态监听 matchMedia 系统主题变化;
// 生效方式 classList.toggle("dark") 挂 <html> + 派发 themechange 事件(use-token-color 等 JS 消费者据此刷新);
// 首屏防 FOUC 由 layout.tsx <head> 内联脚本先行上类,本组件负责挂载后的状态与切换。
import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: "system",
  setTheme: () => undefined,
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY = "careeros-theme";

function isTheme(value: string | null): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR 无 window/localStorage(客户端组件同样服务端渲染)→ 初始 system,hydration 后以存储值接管
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      root.classList.toggle("dark", theme === "dark" || (theme === "system" && systemPrefersDark()));
      window.dispatchEvent(new Event("themechange"));
    };
    apply();
    // system 态:跟随操作系统主题变化;显式 light/dark 无需监听
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = (next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 隐私模式等写入失败:本次会话仍生效,静默忽略持久化失败
    }
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}
