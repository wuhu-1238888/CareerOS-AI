// CareerOS AI 设计 token —— 值的唯一事实来源(design/DesignSystem.md front matter,含深色值表)
// tailwind.config.ts 与开发专用 token 展示页均从此导入。
// 业务代码禁止硬编码偏离值,一律使用 Tailwind 工具类(如 bg-green-600 / text-ink / rounded-card)。
// 6.9 深色模式:主题相关色(下方 green-50/100、violet-50、ink 系、canvas/surface/sunken、hairline、
// 语义色)运行时经 globals.css 的 --careeros-* CSS 变量解析(浅色值 = 本文件 hex 转 HSL),
// 本文件保持浅色 hex 供 PDF 生成等非 DOM 消费者直接使用;green-400~800 / violet-400·700 /
// chart.* / boxShadow 两主题一致。

export const colors = {
  // 品牌绿:单一强调色,承载所有行动与成长语义
  green: {
    50: "#eaf7f0",
    100: "#d2efe2",
    400: "#17a673",
    600: "#0c8a5f",
    700: "#067647",
    800: "#05512f",
  },
  // AI 紫:只用于标记 AI 生成内容
  violet: {
    50: "#f1eeff",
    400: "#7c5cfc",
    700: "#5e3fd6",
  },
  // 暖中性色阶(暖纸白)
  ink: {
    DEFAULT: "#1f1d1a",
    secondary: "#57534b",
    muted: "#7d776c",
    faint: "#b0aa9e",
  },
  canvas: "#faf9f7",
  surface: "#ffffff",
  sunken: "#f3f1ec",
  hairline: {
    DEFAULT: "#e9e6df",
    strong: "#d6d2c8",
  },
  // 语义色
  success: { DEFAULT: "#0c8a5f", bg: "#eaf7f0" },
  warning: { DEFAULT: "#b45309", bg: "#fdf3e2" },
  danger: { DEFAULT: "#c93a3a", bg: "#fdecec" },
  info: { DEFAULT: "#2e6fe8", bg: "#eaf1fe" },
  // 图表色
  chart: {
    green: "#17a673",
    violet: "#7c5cfc",
    amber: "#f0a545",
    blue: "#4e9bf0",
    gray: "#a8a29a",
  },
};

export const typography = {
  display: { fontSize: "32px", fontWeight: 700, lineHeight: 1.35, letterSpacing: "0" },
  h1: { fontSize: "24px", fontWeight: 600, lineHeight: 1.4, letterSpacing: "0" },
  h2: { fontSize: "18px", fontWeight: 600, lineHeight: 1.5, letterSpacing: "0" },
  h3: { fontSize: "16px", fontWeight: 600, lineHeight: 1.5, letterSpacing: "0" },
  "body-lg": { fontSize: "16px", fontWeight: 400, lineHeight: 1.7, letterSpacing: "0" },
  body: { fontSize: "14px", fontWeight: 400, lineHeight: 1.6, letterSpacing: "0" },
  "body-sm": { fontSize: "13px", fontWeight: 400, lineHeight: 1.55, letterSpacing: "0" },
  caption: { fontSize: "12px", fontWeight: 400, lineHeight: 1.5, letterSpacing: "0" },
  button: { fontSize: "14px", fontWeight: 500, lineHeight: 1, letterSpacing: "0" },
  eyebrow: { fontSize: "12px", fontWeight: 600, lineHeight: 1.4, letterSpacing: "0.08em" },
  num: { fontSize: "32px", fontWeight: 700, lineHeight: 1, letterSpacing: "0" },
  mono: { fontSize: "13px", fontWeight: 400, lineHeight: 1.6, letterSpacing: "0" },
};

export const borderRadius = {
  control: "8px",
  card: "16px",
  modal: "20px",
  pill: "999px",
};

// DesignSystem spacing 标度(space-1 ~ space-20)
export const spacing = {
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
  20: "80px",
};

// 暖黑阴影(rgba(31,29,26) = ink)
export const boxShadow = {
  card: "0 1px 2px rgba(31,29,26,0.06), 0 1px 1px rgba(31,29,26,0.04)",
  hover: "0 4px 12px rgba(31,29,26,0.10)",
  popup: "0 8px 24px rgba(31,29,26,0.14)",
  modal: "0 16px 48px rgba(31,29,26,0.18)",
};

// 系统字体栈,零 webfont(中文 webfont 体积不可接受)
export const fontFamily = {
  sans: [
    "-apple-system",
    "BlinkMacSystemFont",
    '"PingFang SC"',
    '"Microsoft YaHei"',
    '"Segoe UI"',
    "Roboto",
    '"Helvetica Neue"',
    '"Hiragino Sans GB"',
    "sans-serif",
  ],
  mono: ['"SF Mono"', '"JetBrains Mono"', "Menlo", "Consolas", "monospace"],
};
