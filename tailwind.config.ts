import type { Config } from "tailwindcss";
import {
  colors,
  typography,
  borderRadius,
  spacing,
  boxShadow,
  fontFamily,
} from "./src/lib/design/tokens";

// 字号:DesignSystem typography 标度 → Tailwind fontSize(如 text-display / text-body / text-eyebrow)
const fontSize = Object.fromEntries(
  Object.entries(typography).map(([name, spec]) => [
    name,
    [
      spec.fontSize,
      {
        lineHeight: String(spec.lineHeight),
        fontWeight: String(spec.fontWeight),
        letterSpacing: spec.letterSpacing,
      },
    ] as [string, { lineHeight: string; fontWeight: string; letterSpacing: string }],
  ])
);

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // CareerOS 色板 + shadcn 语义槽(值经 src/styles/globals.css 的 HSL 变量映射到 DesignSystem)。
      // 6.9 深色模式:主题相关色经 hsl(var(--careeros-*)) 变量化(透明度修饰符由 Tailwind 转
      // <alpha-value> 形式);green-400~800 / violet-400·700 / chart.* / boxShadow 两主题一致保持静态。
      colors: {
        ...colors,
        green: {
          ...colors.green,
          50: "hsl(var(--careeros-green-50))",
          100: "hsl(var(--careeros-green-100))",
        },
        violet: {
          ...colors.violet,
          50: "hsl(var(--careeros-violet-50))",
        },
        ink: {
          DEFAULT: "hsl(var(--careeros-ink))",
          secondary: "hsl(var(--careeros-ink-secondary))",
          muted: "hsl(var(--careeros-ink-muted))",
          faint: "hsl(var(--careeros-ink-faint))",
        },
        canvas: "hsl(var(--careeros-canvas))",
        surface: "hsl(var(--careeros-surface))",
        sunken: "hsl(var(--careeros-sunken))",
        hairline: {
          DEFAULT: "hsl(var(--careeros-hairline))",
          strong: "hsl(var(--careeros-hairline-strong))",
        },
        success: {
          DEFAULT: "hsl(var(--careeros-success))",
          bg: "hsl(var(--careeros-success-bg))",
        },
        warning: {
          DEFAULT: "hsl(var(--careeros-warning))",
          bg: "hsl(var(--careeros-warning-bg))",
        },
        danger: {
          DEFAULT: "hsl(var(--careeros-danger))",
          bg: "hsl(var(--careeros-danger-bg))",
        },
        info: {
          DEFAULT: "hsl(var(--careeros-info))",
          bg: "hsl(var(--careeros-info-bg))",
        },
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: "hsl(var(--destructive))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          ...colors.chart,
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      fontSize,
      borderRadius: {
        ...borderRadius,
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      spacing,
      boxShadow,
      fontFamily,
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
