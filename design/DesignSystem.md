---
version: alpha
name: CareerOS-AI-DesignSystem
description: "CareerOS AI 自己的设计系统 —— 为 AI 编程助手(Claude Code / Codex)编写的可执行前端规范。面向大学生与职场新人的 AI 职业成长操作系统,视觉语言定义为「成长绿 + AI 紫 + 暖纸白」:单一绿色强调色 #0c8a5f 承载所有行动与成长语义,紫色 #7c5cfc 只用于标记 AI 生成内容,暖中性色阶替代冷灰让产品读起来像纸张而非管理后台。方法论吸收两套参考:来自 Linear 的极简高效(SaaS 产品感、内容优先、单一强调色、零装饰),来自 Atlassian 的企业级信息组织(页面解剖学、四态约定、状态语义、渐进披露)。布局为轻量顶栏 + 居中 1160px 内容容器 + 页面头模式;核心组件 Agent Card(多 Agent 顾问叙事)、Career Roadmap(纵向时间线)、Skill Dashboard(雷达图 + 技能标签)、Resume Analysis Card(前后对比 + AI 解释)。所有 token 定义于本 front matter,所有章节以可执行规则结尾。"

colors:
  green-50: "#eaf7f0"
  green-100: "#d2efe2"
  green-400: "#17a673"
  green-600: "#0c8a5f"
  green-700: "#067647"
  green-800: "#05512f"
  violet-50: "#f1eeff"
  violet-400: "#7c5cfc"
  violet-700: "#5e3fd6"
  ink: "#1f1d1a"
  ink-secondary: "#57534b"
  ink-muted: "#7d776c"
  ink-faint: "#b0aa9e"
  canvas: "#faf9f7"
  surface: "#ffffff"
  sunken: "#f3f1ec"
  hairline: "#e9e6df"
  hairline-strong: "#d6d2c8"
  success: "#0c8a5f"
  success-bg: "#eaf7f0"
  warning: "#b45309"
  warning-bg: "#fdf3e2"
  danger: "#c93a3a"
  danger-bg: "#fdecec"
  info: "#2e6fe8"
  info-bg: "#eaf1fe"
  chart-green: "#17a673"
  chart-violet: "#7c5cfc"
  chart-amber: "#f0a545"
  chart-blue: "#4e9bf0"
  chart-gray: "#a8a29a"

# 深色主题(6.9):仅覆盖「换肤变量」;静态色(green-400~800 / violet-400·700 / chart.* / boxShadow)两主题一致。
# 运行时经 globals.css 的 --careeros-* CSS 变量(tokens.ts 保持浅色 hex 供 PDF 等非 DOM 消费者)
darkColors:
  canvas: "#101316"
  surface: "#1d2125"
  sunken: "#161a1d"
  hairline: "#39424a"
  hairline-strong: "#454f59"
  ink: "#b6c2cf"
  ink-secondary: "#98a7b9"
  ink-muted: "#7b8ba3"
  ink-faint: "#626f86"
  green-50: "#11352a"
  green-100: "#164532"
  violet-50: "#241f45"
  success: "#2fbf88"
  success-bg: "#12352a"
  warning: "#f5cd47"
  warning-bg: "#3a2c10"
  danger: "#f87171"
  danger-bg: "#3c1f1f"
  info: "#579dff"
  info-bg: "#1d2c4d"

typography:
  display:
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: 0
  h1:
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0
  h2:
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0
  h3:
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: 0
  body-lg:
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: 0
  body:
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0
  caption:
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  button:
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0
  eyebrow:
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.08em
  num:
    fontSize: 32px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0
  mono:
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0

rounded:
  control: 8px
  card: 16px
  modal: 20px
  pill: 999px

spacing:
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-5: 20px
  space-6: 24px
  space-8: 32px
  space-10: 40px
  space-12: 48px
  space-16: 64px
  space-20: 80px

shadows:
  card: "0 1px 2px rgba(31,29,26,0.06), 0 1px 1px rgba(31,29,26,0.04)"
  hover: "0 4px 12px rgba(31,29,26,0.10)"
  popup: "0 8px 24px rgba(31,29,26,0.14)"
  modal: "0 16px 48px rgba(31,29,26,0.18)"

components:
  button-primary:
    backgroundColor: "{colors.green-600}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: 10px 20px
    height: 40px
  button-primary-hover:
    backgroundColor: "{colors.green-700}"
    textColor: "#ffffff"
  button-primary-pressed:
    backgroundColor: "{colors.green-800}"
    textColor: "#ffffff"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: 10px 20px
    height: 40px
    border: 1px solid "{colors.hairline-strong}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.green-600}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: 10px 16px
    height: 40px
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: 10px 20px
    height: 40px
  text-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: 9px 12px
    height: 40px
    border: 1px solid "{colors.hairline-strong}"
  text-input-focus:
    border: 2px solid "{colors.green-600}"
  text-input-error:
    border: 1px solid "{colors.danger}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: 24px
    border: 1px solid "{colors.hairline}"
    shadow: "{shadows.card}"
  badge-success:
    backgroundColor: "{colors.success-bg}"
    textColor: "{colors.success}"
    typography: "{typography.caption}"
    fontWeight: 600
    rounded: "{rounded.pill}"
    padding: 2px 10px
  badge-danger:
    backgroundColor: "{colors.danger-bg}"
    textColor: "{colors.danger}"
    typography: "{typography.caption}"
    fontWeight: 600
    rounded: "{rounded.pill}"
    padding: 2px 10px
  badge-warning:
    backgroundColor: "{colors.warning-bg}"
    textColor: "{colors.warning}"
    typography: "{typography.caption}"
    fontWeight: 600
    rounded: "{rounded.pill}"
    padding: 2px 10px
  ai-badge:
    backgroundColor: "{colors.violet-50}"
    textColor: "{colors.violet-700}"
    typography: "{typography.caption}"
    fontWeight: 600
    rounded: "{rounded.pill}"
    padding: 2px 10px
  tag:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-secondary}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: 4px 12px
  ai-insight:
    backgroundColor: "{colors.violet-50}"
    borderLeft: 3px solid "{colors.violet-400}"
    rounded: "{rounded.control}"
    padding: 12px 16px
  agent-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: 24px
    border: 1px solid "{colors.hairline}"
    shadow: "{shadows.card}"
  roadmap-node-done:
    backgroundColor: "{colors.green-600}"
    borderColor: "{colors.green-600}"
  roadmap-node-current:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.green-400}"
  roadmap-node-future:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.hairline-strong}"
  stat-value:
    typography: "{typography.num}"
    textColor: "{colors.ink}"
  empty-state:
    padding: 64px 24px
    textColor: "{colors.ink-muted}"
---

# CareerOS AI 设计系统

> 面向 AI 编程助手的前端生成规范。本文件是 CareerOS AI 视觉语言的唯一事实来源:所有颜色、字号、间距、阴影从 front matter 引用,禁止在代码中硬编码偏离值。

CareerOS AI 的用户是大学生与职场新人,产品是陪伴成长的 AI 职业操作系统。设计方法:用 **Linear 的极简高效**(内容优先、单一强调色、零装饰、快)包裹 **Atlassian 的信息组织**(页面解剖学、状态语义、四态约定、渐进披露),最终形成 CareerOS 自己的视觉语言:**成长绿 + AI 紫 + 暖纸白**。

---

## Brand Identity

### 品牌关键词

| 关键词 | 含义 | 设计上的体现 |
|---|---|---|
| **成长** | 核心价值闭环:自我认知 → 方向 → 规划 → 提升 → 表达 | 一切进度可见;增长值、阶段完成率、前后对比是界面主角 |
| **清晰** | 把模糊的职业困惑变成清晰的结构 | 强信息层级、页面头模式、分阶段叙事 |
| **陪伴** | "不是一次性工具,是陪伴成长的系统" | 暖中性色、温和文案、持续更新的画像 |
| **智能** | AI 原生、多 Agent 顾问 | Agent Card、AI 内容标记、分析过程可视化 |
| **可信** | 职业决策是高利害的,AI 输出必须可解释、可纠偏 | 每条 AI 结论附理由;全局「这不是我」纠偏入口 |
| **轻盈** | 年轻用户,首次到第一个价值 < 5 分钟 | 40px 大按钮、极短表单、居中容器、无管理后台感 |

**品牌人格**:一位靠谱又温暖的个人成长教练——专业但不冰冷,聪明但不炫技。

### 品牌标识概念

- 视觉母题:**向上的轨迹**(一条向右上攀升的折线)+ **节点**(轨迹上的圆形阶段点,对应路线图的阶段语义)。
- 标准配色:品牌绿 `{colors.green-600}` 节点 + 暖墨 `{colors.ink}` 线条,白/暖纸底。
- 产品内不使用 logo 装饰元素;节点轨迹仅出现在空状态插画、加载动画和分享卡片中。

### 品牌规则

- 不复制任何第三方品牌的标识、字体、色值或组件外观。本系统的全部 token 为 CareerOS 原创定义。
- 绿色是本系统唯一的品牌强调色;除语义色外,界面 chrome 中不允许出现第二种强调色。
- 文案永远以用户为中心,使用"你";AI 结论永远以"建议"而非"命令"的口气表达。
- 中文文案使用中文标点;数字与中文之间加 1/4 空格(如"完成 3 个任务")。

---

## Color System

### 品牌色:成长绿(Growth Green)

单色品牌系统——一个绿色,三种用法,贯穿全部界面:

| Token | 值 | 用途 | 对比度(白底) |
|---|---|---|---|
| `{colors.green-600}` | `#0c8a5f` | **主行动色**:主按钮、链接、选中态、完成态、进度条 | 4.75:1 ✓ |
| `{colors.green-700}` | `#067647` | 主按钮 hover | 6.2:1 ✓ |
| `{colors.green-800}` | `#05512f` | 主按钮 pressed | — |
| `{colors.green-400}` | `#17a673` | **装饰/图表**:进度环、趋势箭头、图表系列、当前节点 | 仅图形,不用于文字 |
| `{colors.green-100}` | `#d2efe2` | 大块图形填充(雷达图 20% 透明度替代) | — |
| `{colors.green-50}` | `#eaf7f0` | **选中/悬浮底**:选中行、hover 卡片底、成功徽章底 | 配 green-600 文字 |

### AI 语义色:AI 紫(Insight Violet)

产品的第二个强调色,语义被严格限定——**只标记 AI 生成的内容**:

| Token | 值 | 用途 |
|---|---|---|
| `{colors.violet-400}` | `#7c5cfc` | AI 徽章图标、AI 解释块左边条、AI 光标 |
| `{colors.violet-700}` | `#5e3fd6` | AI 徽章文字、AI 内容内链接(白底 7.4:1 ✓) |
| `{colors.violet-50}` | `#f1eeff` | AI 内容块底色(`ai-insight`) |

规则:紫色出现在界面上的任何位置,都意味着"这是 AI 说的"。用户自己输入/编辑的内容永远不用紫色。

### 暖中性色(Warm Neutrals)

替代冷灰的企业级中性阶——让界面读起来像纸张而不是管理后台:

| Token | 值 | 用途 |
|---|---|---|
| `{colors.canvas}` | `#faf9f7` | 页面背景(暖纸白) |
| `{colors.surface}` | `#ffffff` | 卡片、弹窗、输入框表面 |
| `{colors.sunken}` | `#f3f1ec` | 侧栏、标签底、骨架屏、表头底 |
| `{colors.hairline}` | `#e9e6df` | 默认 1px 分隔线、卡片描边 |
| `{colors.hairline-strong}` | `#d6d2c8` | 输入框描边、强调分隔线 |
| `{colors.ink}` | `#1f1d1a` | 主文本(暖近黑) |
| `{colors.ink-secondary}` | `#57534b` | 次级文本、描述 |
| `{colors.ink-muted}` | `#7d776c` | 元信息、时间戳、占位符 |
| `{colors.ink-faint}` | `#b0aa9e` | 禁用文字、装饰性符号 |

### 语义色

| Token | 值 | 底 | 用途 |
|---|---|---|---|
| `{colors.success}` | `#0c8a5f` | `{colors.success-bg}` | 完成、提升、达成(与品牌同族) |
| `{colors.warning}` | `#b45309` | `{colors.warning-bg}` | 待处理、需注意、ATS 良好 |
| `{colors.danger}` | `#c93a3a` | `{colors.danger-bg}` | 错误、下降、删除、ATS 需改进 |
| `{colors.info}` | `#2e6fe8` | `{colors.info-bg}` | 中性提示(仅提示,不用蓝做强调) |

### 图表色板(雷达图/趋势图)

`{colors.chart-green}` `#17a673` · `{colors.chart-violet}` `#7c5cfc` · `{colors.chart-amber}` `#f0a545` · `{colors.chart-blue}` `#4e9bf0` · `{colors.chart-gray}` `#a8a29a`

规则:最多 5 个系列;图表色只用于数据可视化,不回流到界面 chrome。

### 颜色使用规则

- **状态必须颜色 + 文字双通道**:徽章永远带文字(「已完成」「待处理」),不允许裸色点作为唯一信号(密表格内可用 8px 圆点 + 文字)。
- **增长/下降用绿色/红色 + 箭头 + 数值**(「+8% ↑」),参考 Atlassian 的 added/removed 语义,命名为「提升/下降」。
- 绿色只做行动与成长语义;红色只做错误与下降语义;蓝色只做中性提示——三者绝不互相替换。
- 主按钮绿与成功绿同族是刻意设计:在 CareerOS 里,"行动"和"成长"是同一件事。
- 所有文本/背景组合 ≥ 4.5:1;12px 以下文本用 `ink-secondary` 起步,禁用 `ink-faint` 承载信息。
- 无渐变、无玻璃拟态、无霓虹。深色模式已实现(任务 6.9),规则见下节「深色模式」——**两主题下所有文本/背景组合均须 ≥4.5:1**。

### 深色模式(任务 6.9)

三态主题:**跟随系统(system)/ 浅色(light)/ 深色(dark)**。入口 = 顶栏头像菜单「外观」组 + 设置页「外观」卡;`localStorage careeros-theme` 持久化(system 态监听 `prefers-color-scheme` 变化),首屏防 FOUC 由 layout `<head>` 内联脚本先行上 `.dark` 类。

**值表见 front matter `darkColors:`**(唯一事实来源)。设计规则:

| 规则 | 内容 |
|---|---|
| 阶梯反转 | 深色底为暖蓝灰阶梯(Linear 式深色 + 暖色适配):`canvas #101316` → `surface #1d2125` → `sunken #161a1d`(凹陷面比卡片面更深);hairline 提亮 `#39424a` / `#454f59`;文字四级 `ink #b6c2cf` → `ink-faint #626f86` |
| 叠加面变体 | green-50/violet-50/语义色 bg 不再是「浅色填充」,深色下改为对应色相的**深色叠加面**(green-50 `#11352a`、green-100 `#164532`、violet-50 `#241f45`、success-bg `#12352a` 等),其上文字用提亮语义色变体(success `#2fbf88`、warning `#f5cd47`、danger `#f87171`、info `#579dff`) |
| 静态色 | green-400~800 / violet-400·700 / chart.* / boxShadow **两主题一致**(暖黑 rgba 阴影在深色底自然成立;green-600 主按钮白字两主题同为 4.75:1);语义徽章选中文案配色需在深色下逐项走查 |
| color-scheme | `.dark` 设 `color-scheme: dark`(:root 设 `light`),原生控件/滚动条随主题 |
| 实现机制 | 主题相关 token 经 CSS 变量 `hsl(var(--careeros-x))` 包装(变量存「H S% L%」三元组,透明度修饰符编译为 `hsl(var(--careeros-x) / 0.5)`);组件类名零改动;tokens.ts 保持浅色 hex 供 PDF 等非 DOM 消费者 |
| JS 消费者 | Recharts 等 SVG 图表的 grid/tick 色经 `use-token-color` hook(getComputedStyle 读 `--careeros-*` + 监听 `themechange` 事件)随主题刷新 |
| shadcn 变量 remap | 深色下 `--destructive-foreground` 换 canvas 深色文字(白字对 `#f87171` 仅 2.77:1 不达标)、`--accent-foreground` 换 green-400(对 green-50 叠加面可达标) |

**验证纪律**:全站页面深色下四态与对比度逐页走查;grep 零新增硬编码色值;dev/tokens 页含「深色渲染效果」区(`.dark` 包裹预览容器)。

---

## Typography

### 字体族

- **界面正文**:系统栈,零 webfont——`-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, "Helvetica Neue", "Hiragino Sans GB", sans-serif`
- **等宽**:`"SF Mono", "JetBrains Mono", Menlo, Consolas, monospace`——用于 ATS 关键词、技能 ID、技术名(如 `Python / LangChain`)

理由:中文产品 webfont 体积不可接受(中文字体 5-10MB);系统栈让 macOS 得到苹方、Windows 得到微软雅黑,平台原生渲染最优。

### 字号层级

| Token | 字号/字重/行高 | 用途 |
|---|---|---|
| `{typography.display}` | 32px / 700 / 1.35 | 引导页标题、大数字之外的最大标题 |
| `{typography.num}` | 32px / 700 / 1(等宽数字) | **匹配度 85% 之类的大数字**——CareerOS 的签名元素 |
| `{typography.h1}` | 24px / 600 / 1.4 | 页面标题(页面头默认) |
| `{typography.h2}` | 18px / 600 / 1.5 | 区块标题、大卡片标题 |
| `{typography.h3}` | 16px / 600 / 1.5 | 卡片标题 |
| `{typography.body-lg}` | 16px / 400 / 1.7 | 长文阅读(AI 分析正文、解释文字) |
| `{typography.body}` | 14px / 400 / 1.6 | 默认 UI 文本、表格、菜单 |
| `{typography.body-sm}` | 13px / 400 / 1.55 | 元信息、次要说明 |
| `{typography.caption}` | 12px / 400 / 1.5 | 时间戳、徽章、标签 |
| `{typography.button}` | 14px / 500 / 1 | 全部按钮文字 |
| `{typography.eyebrow}` | 12px / 600 / 1.4 / +0.08em | 区块眉标(唯一使用字距的样式) |
| `{typography.mono}` | 13px / 400 / 1.6 | 代码、关键词 token |

### 中文排版规则(本系统特有)

- **中文行高比拉丁文 +0.2**:正文 1.6、长文 1.7。中文字符没有 x-height,1.4 以下的行高会显得拥挤。
- **中文无斜体**:强调一律用字重(400→600)或颜色(`ink` → `green-600`),禁止 `font-style: italic`。
- **中西文混排**:中文与拉丁字母/数字之间留 1/4 空格(`em` 单位:0.25em),由组件内 margin 实现,不写入文案字符串。
- **数字用等宽数字**:`font-variant-numeric: tabular-nums`——匹配度、百分比、时间轴数字必须纵向对齐。
- 全角标点用于中文句子;按钮、标签等短文本不加句号;不使用全大写。
- 截断统一省略号 + `title` 属性;长 AI 文本折叠为"展开全文"(见 Component System)。

### 字重纪律

- 400 正文 / 500 可交互强调(按钮、选中项)/ 600 标题 / 700 仅大数字与引导页。
- 13px 以下永远不用 700。

---

## Layout System

### 间距体系

4px 基准网格,升序:`{spacing.space-1}` 4 · `{spacing.space-2}` 8 · `{spacing.space-3}` 12 · `{spacing.space-4}` 16 · `{spacing.space-5}` 20 · `{spacing.space-6}` 24 · `{spacing.space-8}` 32 · `{spacing.space-10}` 40 · `{spacing.space-12}` 48 · `{spacing.space-16}` 64 · `{spacing.space-20}` 80。

- 卡片内边距 24px(`card`);区块间距 24px;大区块间距 48px;弹窗内边距 24px。
- 组件内部间隙以 4/8 为主,区块之间以 24/48 为主——间距即层级。

### 圆角体系

| Token | 值 | 用途 |
|---|---|---|
| `{rounded.control}` | 8px | 按钮、输入框、下拉、标签组 |
| `{rounded.card}` | 16px | 卡片、面板 |
| `{rounded.modal}` | 20px | 弹窗、抽屉 |
| `{rounded.pill}` | 999px | 徽章、标签、进度条、头像 |

比 Linear(8px 按钮)友好、比 Atlassian(3px)柔软——年轻用户产品的中间选择。**胶囊只属于徽章/标签/进度条,按钮永远 8px**。

### 阴影体系

| Token | 值 | 用途 |
|---|---|---|
| `{shadows.card}` | `0 1px 2px rgba(31,29,26,.06), 0 1px 1px rgba(31,29,26,.04)` | 默认卡片 |
| `{shadows.hover}` | `0 4px 12px rgba(31,29,26,.10)` | 卡片 hover 上浮 |
| `{shadows.popup}` | `0 8px 24px rgba(31,29,26,.14)` | 下拉、tooltip、flag |
| `{shadows.modal}` | `0 16px 48px rgba(31,29,26,.18)` | 弹窗 |

阴影只用暖黑 `rgba(31,29,26,·)` 作基底(与文字同色系),浮层才有阴影,静态卡片不悬浮。

### 页面解剖学(Page Anatomy)

```
┌────────────────────────────────────────────────────────┐
│ 顶栏 64px:logo │ 工作台 职业画像 成长路线 简历优化 │ CTA 头像 │
├────────────────────────────────────────────────────────┤
│        内容容器 max-width 1160px,水平居中,32px 边距      │
│  ┌──────────────────────────────────────────────────┐  │
│  │ 面包屑 12px(可选)                                │  │
│  │ 页面标题 24px/600 + 一句话描述 14px/ink-muted     │  │
│  │ [主行动按钮 40px 右对齐]                          │  │
│  ├──────────────────────────────────────────────────┤  │
│  │ 状态/标签行(徽章、更新时间)                       │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  内容区:卡片网格 3 列 / 2 列 / 单列宽(多步采集表单 640px) │
│                                                          │
└────────────────────────────────────────────────────────┘
```

- **顶栏 64px**:白底 + `hairline` 下边线,sticky。6 个一级入口(工作台/职业画像/成长路线/岗位匹配/简历优化/简历中心)——不需要侧栏(这是消费级产品的决定,不同于企业级三明治导航)。
- **居中容器 1160px**:个人工作台感,不是全屏管理后台。32px 边距(768px 以下 24px)。
- **页面头**:标题 + 描述 + 主行动按钮右对齐。每页一个主行动。
- **宽表单页**(如简历上传/简历核对修正):全宽(继承 1160px 内容容器),按字段类型组织——短字段 2 列、长描述与技能文本全宽(2026-08 修订:原「表单 640px」规则仅保留给多步采集表单,解决简历页核心内容区过窄的问题);**多步表单**(画像采集):640px + 顶部步进器 + 底部固定前后按钮。

### 信息组织(继承 Atlassian 方法)

- **渐进披露阶梯**:摘要 → 展开 → 内联弹层 → 标签页 → 弹窗 → 独立页。永远先给摘要,细节每层加一次点击成本。
- **四个状态(四态约定)**:每个数据视图必须实现 内容 / 空 / 加载 / 错误 四态;空状态必须有下一步行动;加载用骨架屏(布局零位移);错误给重试入口。
- **列表 vs 表格**:≤8 条相似数据用卡片,>8 条用表格;表格行高 44px 起、表头 12px/600 `ink-muted`。
- **大数字即导航**:匹配度、完成率用 `{typography.num}` 32px/700 渲染——它是用户最关心的信息,也是一切跳转的锚点。

### 布局规则

- 新页面先回答三个问题再写组件:它的主行动是什么(放页面头右侧)?它属于哪个一级入口(顶栏高亮)?它的四态分别长什么样?
- 一屏内只允许一个 40px 主按钮;次要动作用 `button-secondary`/`button-ghost`。
- 卡片内部 24px 边距,不因"放不下"缩小到 16px 以下——放不下就拆卡片。
- 布局位移是 bug:骨架屏必须预留与真实内容完全一致的尺寸。

---

## Component System

> 组件引用 front matter 的 `components:` token 与 `colors/typography/spacing/shadow` token。状态一律「颜色 + 文字」双通道。所有 AI 生成内容遵守「AI 内容约定」小节。

### 核心组件 1:Agent Card(Agent 顾问卡)

产品的叙事核心——"多个 AI 职业顾问共同服务你"。每个 Agent 一张卡:

```
┌────────────────────────────────────┐
│  [●] 画像顾问  Profile Agent        │  ← 48px 圆形图标(green-600 底白描线)
│  分析你的背景,生成职业画像          │  ← 13px ink-muted
│  [✓ 已完成]  [AI]                  │  ← badge-success + ai-badge
│  上次分析:昨天 20:14               │  ← 12px ink-faint
│  ████████████░░░░ 85% 画像完整度   │  ← 4px 进度条 green-600
└────────────────────────────────────┘
```

- 规格:`card` 底 + 24px 内边距 + `rounded.card`;hover 换 `{shadows.hover}` + 顶部 2px 上浮(transform 不改变布局)。
- 图标:48px 圆形,`green-600` 底 + 白色 24px 线性图标(画像=放大镜、规划=路线/罗盘、简历=文档),图标风格 2px 描边。
- 状态行:`badge-success`「已完成」/ `badge-warning`「分析中」(配 16px spinner)/ 中性「待命」。
- **分析中变体**:进度条动画 + 文案轮播("正在理解你的背景…"→"正在评估你的能力…"),是 PRD 要求的 AI 过程可视化载体。
- 点击 = 进入该模块;卡片可横向排列(3 列)或纵向列表(1 列)。

### 核心组件 2:Career Roadmap(成长路线图)

纵向时间线,阶段递进叙事——产品价值闭环的视觉化身:

```
概要条:从「数据分析」到「数据工程师」的 6 个月路径   总进度 42%
   ┌─ 阶段1 基础构建期(0-3个月)  [进行中] [8/12 任务]   ← 展开
   │    阶段目标:掌握 Python 与 SQL 基础
   │    ▸ 学习内容  [Python] [SQL] [统计学]
   │    ▸ 实践项目  用爬虫+SQL 完成一份行业分析报告(产出物可放入作品集)
   │    ▸ 检查点   ☑ 能独立完成数据清洗  ☐ 能写出可复用的 SQL
   │    ☑ 任务1 完成 Python 入门课程      ✓已完成
   │    ☐ 任务2 完成 3 个 SQL 练习        ○待开始
   │    [这个任务太难了] [我已经会了]      ← 反馈按钮(ghost,12px)
   ┌─ 阶段2 能力提升期(3-6个月)  [未开始]
   ┌─ 阶段3 实战积累期(6-9个月)  [未开始]
```

- 时间线节点:`roadmap-node-done` 绿实心 ✓ / `roadmap-node-current` 白底 + `green-400` 2px 环(可微脉冲)/ `roadmap-node-future` 白底 + `hairline-strong` 环。连线 2px:`green-600`(已完成段)/ `hairline`(未完成段)。
- 阶段卡:默认折叠(标题 + 时长 badge + 任务进度 badge);展开显示目标、内容、项目、检查点、任务列表。
- 任务状态:☑ 已完成(绿)、◐ 进行中(琥珀)、○ 待开始(灰)——勾选直接切换,支持撤销。
- 概要条(sticky):"从 X 到 Y 的 N 个月路径" + 总进度条 + 重新生成按钮。
- 每个任务附「太难了/已经会了」反馈(PRD 纠偏功能),点击触发 AI 调整,反馈后显示 `ai-badge` 确认。

### 核心组件 3:Skill Dashboard(能力仪表盘)

```
┌──────────────────────────────┐  ┌──────────────────────────────┐
│ 能力雷达                    │  │ 技能标签                      │
│ (5-6 维,绿填充 20%/绿描边)  │  │ Python ●●○ 熟练              │
│ 维度标签 12px ink-muted     │  │ SQL     ●○○ 基础              │
│                             │  │ 数据分析 ●●● 精通             │
└──────────────────────────────┘  └──────────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│ 优势分析                        │ 不足与建议                  │
│ ✓ 结构化思维:…(green-600 ✓)     │ ✗ 缺少项目经验:…(danger ✗)  │
└─────────────────────────────────────────────────────────────┘
```

- 雷达图:5-6 个维度(产品/技术/数据/沟通/项目/设计),`chart-*` 色板;填充 `green-100` 20% 透明度;当前能力与目标要求双线对比时第二线用 `chart-violet`。
- 技能熟练度用**三点系统**(●●○)+ 文字(基础/熟练/精通),不用颜色分级——色弱友好且省色。
- 匹配度大数字:`{typography.num}` 32px/700 + 右上方「较上次 +8% ↑」徽章(提升=绿/下降=红)。
- 优势/不足:两条纵向列表,✓ 绿 / ✗ 红图标 + 一句解释;每条可点击展开 AI 详情(`ai-insight`)。

### 核心组件 4:Resume Analysis Card(简历分析卡)

修改对比 + AI 解释——"让用户理解改了什么":

```
┌────────────────────────────────────────────────────┐
│ [AI] 简历优化分析            ATS 评分 72 [良好]      │
│ ┌────────────────────────────────────────────────┐ │
│ │ 修改前  负责校园公众号日常运营                    │ │
│ │ 修改后  通过用户行为分析和 A/B 实验,              │ │
│ │         将公众号互动率提升 40%                   │ │
│ │ ▾ 为什么这样改            [接受] [拒绝]          │ │
│ │   ┌──────────────────────────────────────────┐ │ │
│ │   │ AI 解释块:原句只描述动作,缺少方法与结果…   │ │ │
│ │   └──────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

- 修改前:灰色引用块(`sunken` 底 + 左 3px `hairline-strong` 边);修改后:`green-50` 底 + 左 3px `green-600` 边——**绿边 = 建议采纳的视觉语言**。
- 「为什么这样改」:折叠的 `ai-insight` 块(紫底紫边 + ai-badge)——AI 紫在此承担解释职责。
- 接受/拒绝:每条独立操作;接受后变绿 ✓,拒绝后恢复原文并记录(PRD FR-36);操作可撤销。
- ATS 评分:大数字 + 等级文字双通道(≥80 优秀·绿 / 60-79 良好·琥珀 / <60 需改进·红)+ 环形进度。
- 顶部工具条:全部接受 / 导出 PDF / 导出 Word(secondary);「重新分析」为 ghost。

### 基础组件

| 组件 | 规格要点 |
|---|---|
| Button | `button-primary` 40px 绿主按钮;`button-secondary` 白底 + `hairline-strong` 描边;`button-ghost` 绿字透明底(悬停 `green-50`);`button-danger` 红底仅删除。文字 14px/500,无图标按钮文字居中;图标按钮 40×40。禁用:白底 42% 透明度文字 |
| Card | 白底 + `hairline` 1px + `shadows.card` + `rounded.card` + 24px 内边距;hover 上浮(仅可点击卡) |
| Badge | pill,12px/600:success(绿)/warning(琥珀)/danger(红)/`ai-badge`(紫 + ✦ 图标)。状态永远徽章 + 文字 |
| Tag | `sunken` 底 pill,12px,可移除(16px ✕);技能、兴趣、关键词 |
| Input / Select | 40px 高、白底、`hairline-strong` 1px 描边、`rounded.control`;focus 换 `green-600` 2px 描边 + 0 外发光;error 红描边 + 12px 红错误文案(说明"发生了什么+怎么修")。label 14px/600 在上,必填红星;校验在失焦与提交时进行,不逐键打断 |
| Checkbox / Toggle | Checkbox 18px 圆角 4px,勾选 `green-600`;Toggle 40×22 胶囊,开启 `green-600` |
| Tabs | 40px 高,选中 14px/500 `ink` + 2px `green-600` 下划线;未选中 `ink-muted`;支持 ←→ 键切换 |
| Stepper(多步表单) | 顶部横向步骤:完成=绿 ✓ 圆、当前=`ink` 600 文字、未来=`ink-faint`;每步一个标题 + 一句话解释"为什么需要这个信息"(PRD 要求) |
| Modal | `rounded.modal` + `shadows.modal`,遮罩 `ink` 50%;宽 480/640/800 三档;标题 18px/600;底部 secondary+primary 右对齐;Esc/点遮罩关闭(脏数据先确认);焦点圈闭,关闭后焦点回到触发元素 |
| Banner / Toast | 页面顶部横幅:语义底 + 1px 语义边 + 图标 + 文案 + 动作链接 + 关闭;右下 Toast:白底 + `shadows.popup`,5s 自动消失,带可选「撤销」——横幅管系统级,Toast 管事件级,同一事件不重复发 |
| Empty State | 居中,节点轨迹插画 ≤180px + 18px/600 标题 + 14px `ink-muted` 描述 + 主按钮。文案给"下一步":「还没有简历——上传或从画像生成第一版」 |
| Skeleton | `sunken` 块 + `rounded.control`,尺寸与真实内容一致,透明度 0.5→1 呼吸动画;AI 分析页用 Agent 卡骨架 + 文案轮播 |
| Table | 表头 12px/600 `ink-muted` + `hairline` 2px 底边;行 44px,悬停 `green-50`;数字右对齐等宽;空表 = 表格内 Empty State |
| Stat Card | 眉标 12px/600 `ink-muted` → `{typography.num}` 大数字 → 13px 提升/下降徽章 + 16px 趋势图标;3-4 个一行 |
| Progress Bar | 4px 高胶囊,`sunken` 轨道 + `green-600` 填充;进度环(ATS)12px 描边 |

### AI 内容约定(AI 语义的全局纪律)

1. **一切 AI 输出必须可见地标记**:`ai-badge`(紫 + ✦ + 「AI」)或 `ai-insight` 紫底块。用户可能混淆的边界(哪段是 AI 写的)必须清晰。
2. **每条结论可展开解释**:AI 判断(推荐方向、改写理由、差距分析)附「为什么」折叠块;不做"黑箱建议"。
3. **全局纠偏入口**:画像页常驻「这不是我」ghost 按钮;反馈后显示 Toast「已记录,AI 将重新分析」,并触发重算。
4. **AI 过程可视化**:所有 >1s 的 AI 任务展示过程状态(Agent 卡进度 + 文案轮播),禁止无反馈等待。
5. 用户编辑过的内容不再显示 AI 标记;AI 徽章不属于用户生成内容。

### 组件规则

- 每个组件从 front matter token 取值;新增变体先在 front matter 增加 `components:` 条目再实现。
- 所有可交互元素:键盘可达、focus 时 2px `green-600` 描边(2px 偏移)、`prefers-reduced-motion` 时禁用全部动画。
- 触控目标 ≥40px;桌面 icon 按钮 40×40。
- 组件文案:动词开头、≤8 字(中文)、无句号:「创建画像」「上传简历」「重新生成」。

---

## Design Principles

### 1. 成长可视化 Growth, visualized

进度是产品本体。用户打开任何页面,2 秒内应看到自己的成长状态:阶段进度、任务完成、能力提升、匹配度变化。

→ 可执行:每个模块页必须有进度元素(进度条/大数字/时间线);所有变化用「提升/下降」徽章量化;空状态文案指向"第一步成长行动"。

### 2. AI 透明可信 AI, transparent and accountable

AI 建议的采纳率取决于信任。一切 AI 输出:可见标记、可展开解释、可纠偏、可撤销。

→ 可执行:遵守「AI 内容约定」五条;不接受"相信 AI"式的黑箱输出;删除/接受等高风险操作有撤销路径。

### 3. 极简高效 Minimal & efficient

内容优先,单一强调色,零装饰。界面只呈现决策所需信息,其余渐进披露。首次到第一个价值的路径 < 5 分钟。

→ 可执行:每屏一个主行动;chrome 中除绿色外不出现第二强调色;不因美观添加任何非信息元素(装饰性插画仅限空状态)。

### 4. 清晰组织 Enterprise-grade organization

继承 Atlassian 的信息架构方法:页面解剖学、四态约定、列表/表格分工、状态语义,让复杂数据(画像、路线图、简历对比)始终可扫读。

→ 可执行:新页面必须过「布局规则」三问;所有数据视图四态齐全;>8 条数据用表格;状态永远颜色+文字。

### 5. 温暖陪伴 A warm companion

产品是"陪伴成长的系统",不是冷冰冰的工具。暖中性色、第二人称文案、鼓励式反馈,让年轻的用户感到被支持而非被评估。

→ 可执行:文案用"你";AI 结论用建议口气;失败场景文案先安抚再给方案(「别担心,解析失败通常是因为 PDF 加密……」)。

### 6. 中文优先 Chinese-first

产品为中文用户设计,排版规则先服务中文:行高、混排间距、无斜体强调、系统字体栈。

→ 可执行:遵守「中文排版规则」五条;不做任何依赖拉丁字形特性的设计(如全大写眉标);UI 文案长度按中文 8 字内设计。

### 7. 人人可用 Accessible by default

对比度、键盘、动效偏好、色弱安全,是硬性门槛而非增强项。

→ 可执行:文本对比 ≥4.5:1;焦点环不可移除;`prefers-reduced-motion` 全站生效;熟练度三点系统等色弱安全方案优先于颜色方案。

---

## 迭代指南(Iteration Guide)

1. 一次只做一个组件,按 front matter 的 `components:` token 名引用。
2. 新页面先画解剖图(顶栏 → 页面头 → 内容区),确定主行动与所属一级入口,再写组件。
3. 默认正文 `{typography.body}` 14px/400;强调升字重不换色;只有链接与行动用绿色。
4. 出现紫色前自问:这是 AI 生成的内容吗?不是就不用。
5. 数据视图做完后过四态清单:内容/空/加载/错误,缺一不可。
6. 写完界面跑检查:一个主行动?对比度?键盘路径?焦点环?状态双通道?
7. 颜色与尺寸只从 front matter 引用,禁止硬编码新值;需要新值先改 front matter。
