"use client";
// 设计 token 运行时读取(6.2 起):从 CSS 变量解析主题相关颜色,深色模式切换后由 themechange 事件
// (ThemeProvider 派发,6.9)驱动刷新;供 Recharts 等 JS 渲染组件使用(SVG 属性不走 Tailwind 类)。
// 约定(6.9 落地):--careeros-* 变量存「H S% L%」三元组,经 hsl() 包装后供 JS 消费;
// 变量未定义时回退 tokens.ts 浅色静态值(6.9 上线前与异常环境行为一致)。
import { useEffect, useState } from "react";
import { colors } from "@/lib/design/tokens";

function readVariable(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value ? `hsl(${value})` : "";
}

export function useTokenColor() {
  const [tokens, setTokens] = useState(() => ({
    hairlineStrong: colors.hairline.strong,
    inkMuted: colors.ink.muted,
  }));

  useEffect(() => {
    const read = () =>
      setTokens({
        hairlineStrong: readVariable("--careeros-hairline-strong") || colors.hairline.strong,
        inkMuted: readVariable("--careeros-ink-muted") || colors.ink.muted,
      });
    read();
    window.addEventListener("themechange", read);
    return () => window.removeEventListener("themechange", read);
  }, []);

  return tokens;
}
