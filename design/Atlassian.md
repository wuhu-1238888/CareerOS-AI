---
version: alpha
name: Atlassian-design-analysis
description: "A clarity-first enterprise SaaS design specification derived from the Atlassian Design System (ADS) — the reference framework behind Jira and Confluence, used by teams from 2 to 100,000 people. White neutral canvas (#ffffff) with a flat surface ladder, a signature 3px container radius, 14px UI type in a system font stack, and a single enterprise-blue accent (#0052cc) reserved for actions, links, and focus. Depth is carried by a four-level elevation model (sunken → surface → raised → overlay) with restrained layered shadows — never decorative color. Status is communicated through semantic tokens and badge semantics (added / removed / important), always paired with text or icon. The spec codifies ADS's enterprise UX method for CareerOS AI: information architecture, dashboard composition, dense-but-scannable data views, form discipline, empty/loading/error states, and keyboard-first accessibility. CareerOS AI keeps its own brand voice and visuals; this document inherits Atlassian's structure and method — not its logo, wordmark, or product identity."

colors:
  primary: "#0052cc"
  primary-hover: "#0065ff"
  primary-pressed: "#0747a6"
  primary-subtle: "#deebff"
  selected: "#e9f2ff"
  on-primary: "#ffffff"
  focus: "#2684ff"
  ink: "#172b4d"
  ink-subtle: "#42526e"
  ink-subtlest: "#6b778c"
  canvas: "#ffffff"
  sunken: "#f4f5f7"
  surface-raised: "#ffffff"
  surface-hovered: "#ebecf0"
  surface-pressed: "#c1c7d0"
  hairline: "#dfe1e6"
  hairline-strong: "#758195"
  blanket: "#091e42"
  semantic-success: "#00875a"
  semantic-success-bg: "#e3fcef"
  semantic-success-text: "#006644"
  semantic-warning: "#f5cd47"
  semantic-warning-bg: "#fff0b3"
  semantic-danger: "#de350b"
  semantic-danger-bg: "#ffebe6"
  semantic-danger-text: "#bf2600"
  semantic-discovery: "#6e5dc6"
  semantic-discovery-bg: "#eae6ff"
  accent-red: "#e2483d"
  accent-orange: "#e56910"
  accent-yellow: "#f5cd47"
  accent-green: "#22a06b"
  accent-teal: "#2898bd"
  accent-blue: "#388bff"
  accent-purple: "#6e5dc6"
  accent-magenta: "#da62ac"
  accent-lime: "#94c748"
  accent-gray: "#758195"

typography:
  display-xl:
    fontFamily: System Sans
    fontSize: 35px
    fontWeight: 600
    lineHeight: 1.14
    letterSpacing: 0
  display-lg:
    fontFamily: System Sans
    fontSize: 29px
    fontWeight: 600
    lineHeight: 1.10
    letterSpacing: 0
  display-md:
    fontFamily: System Sans
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.17
    letterSpacing: 0
  headline:
    fontFamily: System Sans
    fontSize: 20px
    fontWeight: 600
    lineHeight: 1.20
    letterSpacing: 0
  card-title:
    fontFamily: System Sans
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.50
    letterSpacing: 0
  subhead:
    fontFamily: System Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  body-lg:
    fontFamily: System Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0
  body:
    fontFamily: System Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: 0
  body-sm:
    fontFamily: System Sans
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.33
    letterSpacing: 0
  caption:
    fontFamily: System Sans
    fontSize: 11px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  button:
    fontFamily: System Sans
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.20
    letterSpacing: 0
  eyebrow:
    fontFamily: System Sans
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: 0.4px
  mono:
    fontFamily: System Mono
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.50
    letterSpacing: 0

rounded:
  xs: 3px
  sm: 6px
  md: 8px
  lg: 12px
  circle: 50%

spacing:
  space-025: 2px
  space-050: 4px
  space-075: 6px
  space-100: 8px
  space-150: 12px
  space-200: 16px
  space-250: 20px
  space-300: 24px
  space-400: 32px
  space-500: 40px
  space-600: 48px
  space-800: 64px
  space-1000: 80px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.xs}"
    padding: 6px 12px
    height: 32px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.xs}"
  button-primary-pressed:
    backgroundColor: "{colors.primary-pressed}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.xs}"
  button-default:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.xs}"
    padding: 6px 12px
    height: 32px
    border: 1px solid "{colors.hairline}"
  button-subtle:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.xs}"
    padding: 6px 12px
    height: 32px
  button-link:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.xs}"
    padding: 2px 4px
  button-icon:
    backgroundColor: transparent
    textColor: "{colors.ink-subtle}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    height: 32px
    width: 32px
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 8px 12px
    height: 36px
    border: 1px solid "{colors.hairline}"
  text-input-focused:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 8px 12px
    height: 36px
    border: 2px solid "{colors.focus}"
  text-input-error:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 8px 12px
    height: 36px
    border: 1px solid "{colors.semantic-danger}"
  checkbox:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    height: 16px
    width: 16px
    border: 2px solid "{colors.hairline}"
  select:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 8px 12px
    height: 36px
    border: 1px solid "{colors.hairline}"
  tab-default:
    backgroundColor: transparent
    textColor: "{colors.ink-subtle}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 8px 12px
    height: 40px
  tab-selected:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.xs}"
    padding: 8px 12px
    height: 40px
    borderBottom: 2px solid "{colors.primary}"
  table-header:
    backgroundColor: transparent
    textColor: "{colors.ink-subtlest}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xs}"
    padding: 8px 12px
    fontWeight: 600
    borderBottom: 2px solid "{colors.hairline}"
  table-row:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 10px 12px
    minHeight: 44px
    borderBottom: 1px solid "{colors.hairline}"
  table-row-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 10px 12px
    minHeight: 44px
  badge-added:
    backgroundColor: "{colors.semantic-success-bg}"
    textColor: "{colors.semantic-success-text}"
    typography: "{typography.body-sm}"
    fontWeight: 600
    rounded: "{rounded.circle}"
    padding: 2px 8px
  badge-removed:
    backgroundColor: "{colors.semantic-danger-bg}"
    textColor: "{colors.semantic-danger-text}"
    typography: "{typography.body-sm}"
    fontWeight: 600
    rounded: "{rounded.circle}"
    padding: 2px 8px
  badge-important:
    backgroundColor: "{colors.semantic-danger}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    fontWeight: 600
    rounded: "{rounded.circle}"
    padding: 2px 8px
  badge-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    fontWeight: 600
    rounded: "{rounded.circle}"
    padding: 2px 8px
  tag:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.circle}"
    padding: 2px 8px
    height: 20px
  banner-error:
    backgroundColor: "{colors.semantic-danger-bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 12px 16px
    border: 1px solid "{colors.semantic-danger}"
  banner-warning:
    backgroundColor: "{colors.semantic-warning-bg}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 12px 16px
    border: 1px solid "{colors.semantic-warning}"
  banner-announcement:
    backgroundColor: "{colors.primary-subtle}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 12px 16px
    border: 1px solid "{colors.primary}"
  flag:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 12px 16px
    width: 400px
  empty-state:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-subtle}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 48px 24px
  modal:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 24px
  tooltip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xs}"
    padding: 4px 8px
  side-nav-item:
    backgroundColor: transparent
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 6px 12px
    height: 32px
  side-nav-item-selected:
    backgroundColor: "{colors.selected}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.xs}"
    padding: 6px 12px
    height: 32px
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.xs}"
    height: 56px
    borderBottom: 1px solid "{colors.hairline}"
  page-header:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 24px 32px
  kpi-card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
    padding: 16px
    border: 1px solid "{colors.hairline}"
  skeleton:
    backgroundColor: "{colors.sunken}"
    textColor: transparent
    typography: "{typography.body}"
    rounded: "{rounded.xs}"
---

## Overview

Atlassian Design System is the specification layer behind Jira, Confluence, and Trello — enterprise collaboration software where a single screen must serve a 2-person startup and a 100,000-seat government agency, in 40+ languages, on 8-year-old hardware. That constraint set is exactly what CareerOS AI faces, and it is the method this document extracts: **clarity at scale**.

The ADS canvas is deliberately quiet — white and neutral grays do the structuring, `{colors.primary}` (#0052cc) does the acting, and semantic colors do the signaling. Depth comes from a four-level elevation model and hairline borders, not decorative color. The signature geometry is the 3px radius — the system's visual anchor across buttons, inputs, cards, and modals. UI text sits at 14px in the OS system font stack; hierarchy comes from size and weight, never letterspacing, never all-caps.

The method principles, condensed from ADS's product design principles, are the operating rules for every screen in CareerOS AI:

- **Build trust in every interaction** — predictable layout, reliable states, honest error handling. Every view has a defined empty, loading, error, and success state.
- **Connect people to collaborate better** — surfaces assume shared objects (resumes, jobs, applications) with clear authorship, timestamps, and status — not private, silent tooling.
- **Match purpose and feel familiar** — each screen follows the same page anatomy, the same component behaviors, the same microcopy conventions. Consistency is a feature, not a constraint.
- **Drive momentum from end to end** — every screen ends with a next step: a primary action, a progress indicator, or a "what's next" hint. Progress is visible and celebrated in place.
- **Guide mastery for greater value** — the first visit shows only the core path; depth (filters, shortcuts, advanced views) reveals itself progressively as the user's tasks grow.

**Key Characteristics:**

- **Neutrals structure, blue acts, semantics signal.** Chrome is white + gray; the only saturated color in the UI chrome is `{colors.primary}`; status colors only on status elements.
- **3px radius everywhere.** Buttons, inputs, cards, modals, popups — the system default. Pills exist only for badges and tags.
- **Four-level elevation model** (sunken → surface → raised → overlay) with two restrained shadow recipes — depth communicates layer, never decorates.
- **14px UI text in the system font stack.** No webfonts, no negative tracking, no all-caps. Sentence case everywhere.
- **Dense-but-scannable data views.** Tables, tabs, progressive disclosure — information density is achieved through organization, not by shrinking type.
- **Status is badge semantics + text.** `added` / `removed` / `important` carry meaning; color alone is never the only channel.
- **Empty, loading, and error states are first-class components**, not afterthoughts.
- **Keyboard-first, AA/AAA contrast, reduced-motion aware** — enterprise accessibility is non-negotiable.

This document is written for AI coding assistants (Claude Code, Codex) as a generation contract: the front matter is the token source of truth, each chapter ends in executable rules, and the Components chapter is the per-component spec. CareerOS AI is not an Atlassian product — its brand mark, product voice, and Chinese-first copy are its own. What transfers is the enterprise method.

## Colors

### Brand & Accent

- **Enterprise Blue** ({colors.primary} #0052cc): The single chromatic accent in the UI chrome. Reserved for: primary buttons, links, focus-related states, selected states, active indicators. One blue, no gradients.
- **Primary Hover** ({colors.primary-hover} #0065ff): Hovered state of brand-bold elements (primary button, filled toggle).
- **Primary Pressed** ({colors.primary-pressed} #0747a6): Pressed state of brand-bold elements.
- **Primary Subtle** ({colors.primary-subtle} #deebff): Tinted brand background — subtle buttons on hover, announcement banners, selected text.
- **Selected** ({colors.selected} #e9f2ff): Selected row / selected nav item background.
- **Focus** ({colors.focus} #2684ff): The focus ring. Exactly one focus color exists in the system.

### Neutral Surface Ladder

- **Canvas** ({colors.canvas}): Page background — pure white.
- **Sunken** ({colors.sunken} #f4f5f7): Regions recessed below the canvas — side navigation, table header backgrounds, skeleton placeholders.
- **Raised** ({colors.surface-raised}): Cards and floating panels — same white, lifted by shadow and border, not by tint.
- **Hovered** ({colors.surface-hovered} #ebecf0): Neutral hover background for list rows, menu items, subtle buttons.
- **Pressed** ({colors.surface-pressed} #c1c7d0): Neutral pressed background.
- **Hairline** ({colors.hairline} #dfe1e6): Default 1px borders — inputs, dividers, card edges.
- **Hairline Strong** ({colors.hairline-strong} #758195): Bold borders — inputs on hover, emphasized separators.
- **Blanket** ({colors.blanket} #091e42): Modal scrim base, applied at 54% opacity.

### Text

- **Ink** ({colors.ink} #172b4d): Default text — body, titles, table cells.
- **Ink Subtle** ({colors.ink-subtle} #42526e): Secondary text — descriptions, helper text, secondary buttons.
- **Ink Subtlest** ({colors.ink-subtlest} #6b778c): Meta text — timestamps, captions, table headers, placeholders.
- **Disabled**: `{colors.ink}` at 42% opacity — no dedicated disabled gray hex.

### Semantic

| Tone | Bold | Background | Text-on-bg | Use |
|---|---|---|---|---|
| Success | `{colors.semantic-success}` #00875a | `{colors.semantic-success-bg}` #e3fcef | `{colors.semantic-success-text}` #006644 | Completed, positive deltas, added content |
| Warning | `{colors.semantic-warning}` #f5cd47 | `{colors.semantic-warning-bg}` #fff0b3 | `{colors.ink}` (always dark) | Attention needed, pending review |
| Danger | `{colors.semantic-danger}` #de350b | `{colors.semantic-danger-bg}` #ffebe6 | `{colors.semantic-danger-text}` #bf2600 | Errors, deletions, destructive actions |
| Discovery | `{colors.semantic-discovery}` #6e5dc6 | `{colors.semantic-discovery-bg}` #eae6ff | `{colors.ink}` | New features, tips, AI-generated content |

### Status Semantics: Added / Removed / Important

ADS's core status insight: enterprise users do not need red and green — they need **added**, **removed**, and **important**. CareerOS AI maps these to career semantics:

- `added` (green): skill matched, interview secured, offer received — progress events.
- `removed` (red): application rejected, position closed, item deleted.
- `important` (solid red, always bold): action required, deadline missed, account risk — never used decoratively.
- `primary` (blue): active state, current selection, in-progress.

### Chart & Data Palette

Data visualization uses a categorical palette (used ONLY in charts, never in UI chrome):

`{colors.accent-blue}` #388bff · `{colors.accent-teal}` #2898bd · `{colors.accent-purple}` #6e5dc6 · `{colors.accent-orange}` #e56910 · `{colors.accent-magenta}` #da62ac · `{colors.accent-green}` #22a06b · `{colors.accent-yellow}` #f5cd47 · `{colors.accent-red}` #e2483d · `{colors.accent-gray}` #758195.

### Dark Theme

Dark mode is a token-level theme, not a new design. The surface ladder **inverts its logic**: raised surfaces get lighter, sunken regions get darker.

| Token | Light | Dark |
|---|---|---|
| Sunken | #f4f5f7 | #161a1d |
| Surface | #ffffff | #1d2125 |
| Raised | #ffffff | #22272b |
| Overlay | #ffffff | #282e33 |
| Ink / subtle / subtlest | #172b4d / #42526e / #6b778c | #b6c2cf / #9fadbc / #8c9bab |
| Primary (interactive) | #0052cc | #579dff |
| Hairline | #dfe1e6 | #39424a |

Dark-mode interaction states do not use darker colors — they overlay white at 8% (hovered) and 12% (pressed). Shadows are replaced by surface-lightening plus borders.

### Rules

- Neutral chrome + one blue accent. If a screen needs a fourth color in the chrome, a component is misclassified.
- Semantic colors appear only on semantic elements (banner, badge, delta, status icon) — never as card backgrounds or decorative fills.
- Status is always color + text or color + icon. Never color alone.
- All text/background pairs meet 4.5:1 contrast; text on tinted status backgrounds uses the dedicated text-on-bg token, not the default ink.
- Chart palette is for data. UI chrome must not borrow chart colors for emphasis.
- Warning surfaces always use dark text on the yellow tint — white on yellow fails contrast.

## Typography

### Font Family

- **System Sans** — `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`. Every text token uses this stack.
- **System Mono** — `'SFMono-Medium', 'SF Mono', 'Segoe UI Mono', 'Roboto Mono', 'Ubuntu Mono', Menlo, Consolas, 'Courier New', monospace`. Reserved for IDs, keys, and code: resume IDs, job requisition codes, API keys.

The system stack is an enterprise decision, not an aesthetic one: zero webfont payload, instant render, perfect CJK behavior (the OS ships the best Chinese font for the platform), and no font licensing.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 35px | 600 | 1.14 | 0 | Onboarding hero, product landing (rare in-app) |
| `{typography.display-lg}` | 29px | 600 | 1.10 | 0 | Dashboard page title, major workspace opens |
| `{typography.display-md}` | 24px | 600 | 1.17 | 0 | Page title — the page-header default |
| `{typography.headline}` | 20px | 600 | 1.20 | 0 | Card titles, modal titles, empty-state titles |
| `{typography.card-title}` | 16px | 600 | 1.50 | 0 | Card titles in dense grids |
| `{typography.subhead}` | 16px | 400 | 1.50 | 0 | Lead paragraphs, feature descriptions |
| `{typography.body-lg}` | 16px | 400 | 1.50 | 0 | Long-form content, comments, editor text |
| `{typography.body}` | 14px | 400 | 1.43 | 0 | Default UI text, table cells, menu items |
| `{typography.body-sm}` | 12px | 400 | 1.33 | 0 | Meta, timestamps, secondary table columns |
| `{typography.caption}` | 11px | 400 | 1.45 | 0 | Captions, fine print |
| `{typography.button}` | 14px | 500 | 1.20 | 0 | All button labels, selected tabs |
| `{typography.eyebrow}` | 12px | 600 | 1.33 | +0.4px | Section labels, KPI labels (the only tracked style) |
| `{typography.mono}` | 13px | 400 | 1.50 | 0 | IDs, codes, technical tokens |

### Principles

- **14px is the default UI size.** 16px only for long-form reading (comments, editor, docs). 12px is for meta, never for content.
- **Weight discipline: 400 / 500 / 600 only.** 500 marks interactive emphasis (button labels, selected tabs); 600 marks titles. No 700 in the UI.
- **Letter-spacing is 0 everywhere** except the eyebrow (+0.4px). Hierarchy comes from size and weight — this is the deliberate opposite of consumer-marketing typography.
- **Sentence case everywhere.** Buttons, tabs, headers, empty states, banners: "Create resume", never "CREATE RESUME". All-caps exists nowhere in the product.
- **Long-form line length ≤ 60ch** (≈ 640px at 14px). Forms cap field width at ~600px.
- **Truncation, not wrap, in data.** Table cells truncate with ellipsis and carry the full value in a `title` attribute or tooltip. Numbers right-align with tabular numerals.
- **Numerals for numbers.** "3 jobs matched", never "three jobs matched".

### Note on Font Substitutes

The system stack means **no substitutes are required** — Windows renders Segoe UI, macOS renders SF Pro, and Chinese text falls through to the platform's CJK face (Microsoft YaHei / PingFang SC) with correct glyph coverage. If a custom webfont is ever introduced for brand reasons, Inter at 400/500/600 is the closest neutral match and must be subset-loaded with `font-display: swap`.

## Layout

### Spacing System

- **Base unit**: 8px grid, with 4px and 2px half-steps for compact controls and icons.
- **Tokens (front matter)**: `{spacing.space-025}` 2px · `{spacing.space-050}` 4px · `{spacing.space-075}` 6px · `{spacing.space-100}` 8px · `{spacing.space-150}` 12px · `{spacing.space-200}` 16px · `{spacing.space-250}` 20px · `{spacing.space-300}` 24px · `{spacing.space-400}` 32px · `{spacing.space-500}` 40px · `{spacing.space-600}` 48px · `{spacing.space-800}` 64px · `{spacing.space-1000}` 80px.
- Card interior padding: `{spacing.space-200}` 16px default (KPI cards, chart cards).
- Modal padding: `{spacing.space-300}` 24px.
- Page gutter: `{spacing.space-400}` 32px desktop, 24px at small widths.
- Section rhythm: `{spacing.space-300}` 24px between content blocks, `{spacing.space-600}` 48px between major sections.

### Grid & Container

- Content is fluid within the viewport minus the 240px sidebar; gutters are 32px. Marketing-style pages may cap at 1280px centered.
- Card grids are 3-up at desktop, 2-up at tablet, 1-up at mobile, with 24px gutters.
- Forms are single-column with fields capped at ~600px width.

### Information Architecture

Enterprise SaaS pages follow a fixed anatomy, top to bottom:

1. **Top navigation (56px, global tier)** — product identity, global search, create action, profile. Never more than ~6 items.
2. **Side navigation (240px, context tier)** — the current workspace's sections, grouped under 12px/600 section labels. Max 7 top-level items per group; overflow goes behind a "More" menu. Selected item = `{colors.selected}` background + primary text.
3. **Page header (breadcrumbs + title + actions)** — breadcrumbs (12px, subtle) above a 24px/600 title; primary + default buttons right-aligned; the primary action is the one task this page exists for.
4. **Page-level navigation** — tabs (40px) or segmented control for views of the same object; breadcrumbs for hierarchy.
5. **Content** — cards, tables, and forms per the Components chapter.

Complex information is organized by the **progressive disclosure ladder**, in order of preference: summary view → expandable section → inline dialog → tab → modal → dedicated page. Always show the summary first; detail costs one interaction, never zero (a wall of everything on one screen is the failure mode).

### Density & Cognitive Load

ADS's density position is explicit: **clarity over cramming**. There are no compact/density modes — the system is designed at one comfortable density (14px text, 44px table rows, 32px controls) and density needs are solved by organization instead:

- **One primary action per view.** Every additional equal-weight button is a decision tax.
- **Consistent placement.** The primary action is always the rightmost element of the page header; destructive actions live in the "more" menu, never adjacent to the primary.
- **Grouping before emphasis.** Related controls sit in titled sections with 24px gaps; unrelated sections get 48px.
- **Defaults and undo.** Fields are prefilled with sensible defaults; destructive actions confirm, non-destructive ones undo.
- **Search-first.** Every enterprise screen is reachable from a command palette (Cmd+K) that covers pages, objects, and actions — power users navigate without the mouse; new users are never forced to.
- **Reduced motion.** All animation respects `prefers-reduced-motion`; skeletons fade, they don't bounce.

### Rules

- Any new screen must place its primary action in the page header, top right.
- Sidebar groups: ≤7 items, labeled by a 12px/600 section heading; anything deeper belongs in a sub-page, not a deeper menu.
- Never ship a density toggle. If a view feels crowded, remove or collapse content — do not shrink type or spacing.
- Card interior padding is 16px; never justify content by shrinking it to 8px.
- Layout shifts are bugs: skeletons and placeholders must reserve the exact dimensions of loaded content.

## Elevation & Depth

| Level | Token | Light | Dark | Use |
|---|---|---|---|---|
| 0 (sunken) | `elevation.surface.sunken` | #f4f5f7 | #161a1d | Sidebars, table header strips, skeleton, recessed canvases |
| 1 (surface) | `elevation.surface` | #ffffff | #1d2125 | Page background, default panels |
| 2 (raised) | `elevation.surface.raised` | #ffffff | #22272b | Cards, sticky headers, toolbars |
| 3 (overlay) | `elevation.surface.overlay` | #ffffff | #282e33 | Popups, dropdowns, modals, tooltips |

Shadow recipes (light theme — the only shadows in the system):

| Token | Value | Use |
|---|---|---|
| raised | `0 1px 1px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)` | Cards, sticky table headers |
| overflow | `0 8px 12px rgba(9, 30, 66, 0.15), 0 0 1px rgba(9, 30, 66, 0.31)` | Popups, dropdowns, tooltips |
| overlay | `0 4px 8px -2px rgba(9, 30, 66, 0.25), 0 0 1px rgba(9, 30, 66, 0.31)` | Modals, dialogs |

### Decorative Depth

- **Elevation is meaning, not ornament.** A shadow states "this layer floats above the page" — it never decorates a static card.
- **In dark mode, elevation inverts**: floating surfaces get *lighter*, and shadows are replaced by surface-lightening plus 1px `#39424a` borders.
- **Blanket**: modals sit on `{colors.blanket}` at 54% opacity; the scrim darkens the page, never blurs it.
- **No gradients, no glass, no noise.** The flat surface ladder plus hairline borders is the entire depth vocabulary.

### Rules

- Level 2 (raised) is the default card elevation; level 3 (overlay) is reserved for layers that demand focus — nothing else.
- One overlay at a time. Stacking modals is forbidden; multi-step flows use steps inside a single modal.
- Focused elements use the 2px `{colors.focus}` ring with a 2px offset — the focus ring replaces, not overlays, the element border.
- Never hand-tune a shadow. If none of the three recipes fits, the element does not float.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 3px | **The system default.** Buttons, inputs, cards, modals, popups, banners, tooltips, tabs |
| `{rounded.sm}` | 6px | Image tiles, larger containers |
| `{rounded.md}` | 8px | Image thumbnails |
| `{rounded.lg}` | 12px | Hero illustrations, oversized panels (rare) |
| `{rounded.circle}` | 50% | Badges, tags, avatars, toggle knobs |

The 3px radius is the system's geometric signature — tight, professional, and consistent across every container. Pills are reserved for status carriers (badges, tags), never for buttons or inputs.

### Icon & Illustration Geometry

- **Icons** sit on a 16px grid with 2px strokes, geometric construction, and square caps — outlined only; fills are reserved for status dots and toggle states.
- **Icon-only buttons** are 32×32px with a 16px glyph and an `aria-label` — never an unlabeled glyph.
- **Avatars** are circles at 24 / 32 / 40px; initials at 12px/600 white on a deterministic hue derived from the person's ID.
- **Illustrations** (empty states) are flat, single-hue line work ≤180px, and optional — text + action must work without them.

### Rules

- Default every new container to `{rounded.xs}` 3px; a larger radius requires a stated reason.
- Never pill a button or input. Never square a badge.
- Two glyph sizes exist: 16px (UI) and 24px (page-level status). Do not invent a third.

## Components

### Buttons

**`button-primary`** — The enterprise-blue CTA. The only filled button in a view.
- Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button}`, height 32px, padding 6px 12px, rounded `{rounded.xs}`.
- Hover `button-primary-hover` → `{colors.primary-hover}`; pressed `button-primary-pressed` → `{colors.primary-pressed}`.
- Large variant (40px height, 16px padding) for the single most important action of a page — e.g. "创建简历" on the dashboard. Maximum one large primary per view.

**`button-default`** — The standard secondary action.
- White background, `{colors.ink}` text, 1px `{colors.hairline}` border, height 32px. Hover background `{colors.surface-hovered}`.

**`button-subtle`** — Quiet action inside dense content (card footers, table headers, empty states).
- Transparent background, `{colors.primary}` text; hover background `{colors.primary-subtle}`.

**`button-link`** — Inline navigation or tertiary action.
- `{colors.primary}` text, transparent; underline on hover only; minimal padding (2px 4px).

**`button-icon`** — Row-level or header-level glyph action.
- 32×32px, transparent, 16px glyph, `{colors.ink-subtle}` glyph color; hover background `{colors.surface-hovered}`. `aria-label` required.

Disabled: `{colors.sunken}` background, `{colors.ink}` text at 42% opacity, no border, no shadow, `cursor: not-allowed`.

Rules:
- Labels are verb-led, sentence case, ≤3 words: "创建简历", "投递职位", "保存修改" — never "Submit", never "OK".
- One primary button per view. If a view has two filled blue buttons, one action is mis-scoped.
- Destructive actions (删除, 撤回) render as `button-default` with danger-colored label, or sit in the "more" menu; confirm in a modal before executing.
- Every button is reachable by Tab, activates on Enter/Space, and shows the 2px `{colors.focus}` ring.

### Badges, Tags & Status

**`badge-added` / `badge-removed`** — Delta and diff carriers.
- Pill radius, 12px/600 type, padding 2px 8px, height 20px.
- `added`: `{colors.semantic-success-bg}` background + `{colors.semantic-success-text}` text ("+3 面试邀请").
- `removed`: `{colors.semantic-danger-bg}` background + `{colors.semantic-danger-text}` text ("-2 已关闭").

**`badge-important`** — The attention signal; always solid.
- `{colors.semantic-danger}` background, white text. Reserved for deadlines, required actions, failures. If every row carries one, none of them matter — cap at a handful per view.

**`badge-primary`** — Active/in-progress state.
- `{colors.primary}` background, white text ("进行中", "当前").

**`tag`** — Object labels (skills, industries, filters).
- `{colors.sunken}` background, `{colors.ink-subtle}` text, 12px, pill, height 20px, removable with a 16px × glyph.

Rules:
- A status is badge + label text, never a bare colored dot — except in dense tables where a 8px status dot + text is the compact form.
- `added`/`removed` always appear as a pair or against a baseline; they describe deltas, not absolute states.
- Badge text is one short noun phrase; never a sentence.

### Banners, Flags & Messages

**`banner-*`** — Persistent, contextual system messages at the top of the content area, above the page header.
- Tinted background + 1px tone border + 16px tone icon + `{colors.ink}` message text + optional inline action link + close button.
- `banner-error` (`{colors.semantic-danger-bg}` / `{colors.semantic-danger}`): something failed and the user should know before proceeding.
- `banner-warning` (`{colors.semantic-warning-bg}` / `{colors.semantic-warning}`): attention needed, action optional.
- `banner-announcement` (`{colors.primary-subtle}` / `{colors.primary}`): system news, maintenance.
- Discovery variant (`{colors.semantic-discovery-bg}` / `{colors.semantic-discovery}`): new feature, AI suggestion. This is the tone for CareerOS AI's generated insights.
- Banner text is always `{colors.ink}` — including the error banner. Red is for the icon and border.

**`flag`** — Transient confirmation, bottom-right of the viewport.
- White surface, `overflow` shadow, 3px radius, 400px width, 12px 16px padding, 16px tone icon.
- Auto-dismisses after ~5s; carries one optional action link ("撤销"); never blocks input.

Rules (ADS notification discipline):
- A notification must be **actionable, relevant, timely** — if it fails any one test, don't show it.
- Banners persist (system-level); flags are transient (event-level). Never fire both for one event.
- Never interrupt an in-progress flow with a flag; confirmations appear as inline status text next to the action, not as popups.
- Error messages state what happened and how to fix it: "简历解析失败:PDF 已加密,请上传未加密的文件后重试."

### Cards

- Structure: raised surface + optional 1px `{colors.hairline}` border, `{rounded.xs}` 3px, 16px padding, `raised` shadow.
- Anatomy: optional header (16px/600 title + icon actions right) → body → optional footer (subtle links).
- Header actions are `button-icon` or a "more" (⋯) dropdown menu — never a full-size button in a card header.
- KPI cards (`kpi-card`) add: 12px/600 `{colors.ink-subtlest}` eyebrow (metric name), 24px/600 value, 12px delta as `badge-added`/`badge-removed` with a 16px trend icon, optional 40px sparkline in `{colors.primary}`.

Rules:
- A card holds one idea. Multi-idea cards become sections with 24px dividers, then become separate cards.
- Card hover lifts content affordance (row hover), never the card itself — cards do not animate on hover.

### Inputs & Forms

**`text-input`** — The default field.
- 36px height, 14px text, 1px `{colors.hairline}` border, `{rounded.xs}` 3px, padding 8px 12px, white background.
- Hover: border → `{colors.hairline-strong}`. Focus (`text-input-focused`): 2px `{colors.focus}` border, no glow, no background change.
- Error (`text-input-error`): 1px `{colors.semantic-danger}` border + error message below (12px, `{colors.semantic-danger-text}`, with 16px alert icon, 8px gap).
- Placeholder: `{colors.ink-subtlest}`; helper text: 12px `{colors.ink-subtlest}` below the field.

**`select`** — Same geometry as text-input, 16px chevron right, native dropdown on mobile.

**`checkbox`** — 16×16px, 2px `{colors.hairline}` border, `{rounded.xs}`; checked = `{colors.primary}` fill + white check. Label is the click target, not just the box.

**Toggle** — 24×16px pill track, 12px white knob; checked = `{colors.primary}` track, unchecked = `{colors.surface-pressed}`. For instant settings ("接收通知"), not for form submission.

Form rules:
- Single-column layout; labels above fields at 14px/600 `{colors.ink}`; required fields marked with a `{colors.semantic-danger}` asterisk.
- Validate on blur and on submit — never per keystroke. Errors appear under the field, and focus moves to the first invalid field on submit.
- Group related fields under section headings (16px/600) with 24px gaps; a form is a series of small titled groups, not one long list.
- Prefill defaults; autofocus the first field; Enter submits; Esc cancels.
- InlineEdit (rename in place): click text → input; Enter saves, Esc reverts; used for titles and names, never for critical fields.

### Tables

**`table-header`** — 12px/600 `{colors.ink-subtlest}` text, transparent background, 2px `{colors.hairline}` bottom border, 8px 12px padding.
- Sortable columns show a chevron and announce `aria-sort`; clicking toggles asc/desc/off.

**`table-row`** — 14px text, min-height 44px, 10px 12px padding, 1px `{colors.hairline}` row borders. Hover background `{colors.surface-hovered}`. Selected (`table-row-selected`): `{colors.selected}` background.

- Row actions (icon buttons) are hidden until row hover but always keyboard-reachable.
- Numeric columns right-align with tabular numerals; long text truncates with ellipsis + `title` attribute.
- Pagination: 25 / 50 / 100 rows per page (default 50), showing "1-50 of 312" with prev/next at 32px height.
- Multi-select adds a selection toolbar replacing the header actions: "已选 3 项" + batch actions, always including 取消选择.

Rules:
- Tables are for comparing many objects; cards are for browsing a few. Above ~8 rows of similar data, a table wins.
- Every table column header is a noun phrase (公司, 状态, 投递时间); never a sentence.
- Empty table = empty state component inside the table area, not a blank grid.

### Navigation

**`top-nav`** — 56px, white, 1px `{colors.hairline}` bottom border. Product identity left, global search center (opens the command palette), create action (primary button) and avatar right. Sticky.

**`side-nav-item`** — 32px height, 14px text, 6px 12px padding, 3px radius. Hover: `{colors.surface-hovered}` background. Selected (`side-nav-item-selected`): `{colors.selected}` background + `{colors.primary}` text at 14px/500. Collapsed state shows 16px glyphs only, with tooltips.

**Tabs** — `tab-default`: 40px height, 14px `{colors.ink-subtle}` text, transparent. `tab-selected`: `{colors.ink}` 14px/500 + 2px `{colors.primary}` bottom indicator. Left/right arrow keys move focus; Enter activates.

**Breadcrumbs** — 12px, `{colors.ink-subtle}` text, items separated by "/", current page last in `{colors.ink}`, intermediate items ellipsized in the middle when deep. Always in the page header, above the title.

**Command palette** — Cmd+K. Overlay surface + `overflow` shadow, ~600px wide, search input on top, results grouped (页面 / 操作 / 人物), keyboard navigable (↑↓ Enter Esc). Every major screen and action is indexed here.

Rules:
- Navigation tiers never mix: global stays in the top nav, context in the sidebar, page-level in tabs.
- Current location is always visible in all three tiers (active item in sidebar + selected tab + breadcrumb trail).
- The command palette is not a power-user extra; it is an accessibility requirement shipped with every page.

### Empty, Loading & Progress States

**`empty-state`** — Centered column, 48px 24px padding, max content width 400px.
- Optional illustration ≤180px → 20px/600 title ("还没有简历") → 14px `{colors.ink-subtle}` description ("创建第一份简历,开始匹配职位") → primary button + optional subtle link.
- The empty state's job is to move the user to their **first success**, not to decorate a void. The primary action must be the actual first step.

**`skeleton`** — `{colors.sunken}` blocks at `{rounded.xs}`, mirroring the exact layout of loading content (title bar → text lines → image block), pulsing opacity 0.5→1.0. Reserves real dimensions — zero layout shift.

**Spinner** — 24px (16px inline) rotating ring in `{colors.primary}`, with 12px subtle status text for waits over ~1s.

**Progress tracker** — Horizontal numbered steps: done = filled `{colors.primary}` circle with check, current = `{colors.ink}` 14px/600 label, future = `{colors.ink-subtlest}`. Used for multi-step forms (创建简历 → 填写经历 → 预览 → 完成).

**Progress bar** — 8px track (`{colors.sunken}`, 3px radius) with `{colors.primary}` fill; percentage text right-aligned at 12px when meaningful.

### Modal & Overlays

**`modal`** — Overlay surface, `overlay` shadow, `{rounded.xs}` 3px, 24px padding, scrim `{colors.blanket}` at 54%.
- Widths: 400px (confirmations) / 600px (simple forms) / 800px (complex forms) / 968px (full workflows).
- Header: 20px/600 title + close icon; body: 14px text; footer: `button-default` + `button-primary`, right-aligned, primary rightmost.
- Esc and scrim click close (unless dirty — then confirm); focus is trapped and returns to the trigger on close.
- Confirmations state the consequence: "删除这份简历?此操作无法撤销。"

**`tooltip`** — `{colors.ink}` background, white 12px text, 3px radius, 4px 8px padding, `overflow` shadow, 4px offset, ~300ms delay. For icon-only buttons and truncated values.

Rules:
- Never stack modals. Multi-step flows run inside one modal (with progress tracker) or become a dedicated page.
- A confirmation modal always names the object ("删除这份简历") — never "确认删除?".

### Dashboard (Composite Pattern)

CareerOS AI's dashboard composes the primitives above — this is the reference layout:

1. **Page header**: breadcrumbs (工作台) + 24px title (职业仪表盘) + primary action right (创建简历).
2. **KPI row** (3-5 `kpi-card`s, 3-up grid): 匹配率, 待投递职位, 本周面试, 简历完整度 — each with eyebrow, 24px value, added/removed delta, trend icon.
3. **Chart card** (full or 2/3 width): 16px/600 title + time-range tabs top-right (7天 / 30天 / 90天); charts use the chart palette only; every chart has an empty state.
4. **Data table card** (full width): 推荐职位 — sortable columns (匹配度, 公司, 薪资, 投递截止), row actions (收藏, 忽略), pagination 50/page.
5. **Sidebar modules** (right column, 1/3 width): 待办事项 (deadline-sorted list with `badge-important` on due-today), 最近动态 (12px timestamps).

Rules:
- ≤7 widgets above the fold. Below the fold is fine — the fold itself must not overwhelm.
- Every widget has all four states: content / empty / loading (skeleton) / error (inline message with retry).
- Deltas use `added`/`removed` badges with text ("+3" or "较上周 +12%"), never bare arrows.

## Do's and Don'ts

### Do

- Structure every screen with the page anatomy: top nav → sidebar → page header (breadcrumb + title + primary action) → tabs → content.
- Keep the chrome neutral; spend `{colors.primary}` only on the one action, the selected state, and links.
- Default every container to `{rounded.xs}` 3px.
- Write all UI text in sentence case, verb-led buttons, ≤3-word labels.
- Ship all four states (content / empty / loading / error) for every data view.
- Communicate status as badge + text; use `added`/`removed` for deltas, `important` sparingly for attention.
- Use the three shadow recipes only — raised, overflow, overlay — each for its named layer.
- Show a 2px `{colors.focus}` ring on every focused element; support full keyboard navigation.
- Put the command palette (Cmd+K) on every screen.
- Verify 4.5:1 contrast on every text/background pair, and honor `prefers-reduced-motion`.

### Don't

- Don't copy Atlassian brand assets — logo, wordmark, "Charlie Sans" typography, product names, or the Jira/Confluence color treatments. CareerOS AI's identity is its own.
- Don't use semantic colors as decoration: no red section headers, no green card backgrounds, no tinted canvases.
- Don't render status as color alone (a bare red dot) — always pair with text or icon.
- Don't ship a density toggle or shrink type below 14px to fit more content.
- Don't stack modals; don't interrupt flows with confirmation flags.
- Don't use all-caps, exclamation marks in system copy, or marketing adjectives ("智能", "强大") in UI labels.
- Don't mix the chart palette into UI chrome, or the UI blue into charts.
- Don't pill buttons or inputs; don't square badges and tags.
- Don't apply negative letter-spacing anywhere; don't hand-tune shadows.
- Don't show an unstyled blank area where data should be — an empty state with a next action or a skeleton always occupies it.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Desktop-XL | 1440px | Default desktop layout, 3-up card grids, sidebar expanded |
| Desktop | 1024px | Sidebar collapses to icons; card grids 3-up maintained |
| Tablet | 768px | Sidebar becomes off-canvas drawer; card grids 2-up; modals shrink one width step |
| Mobile | 480px | Single column; modals full-bleed; tables scroll horizontally |

### Touch Targets

- Primary controls hold 32px height on desktop, ≥40px in touch contexts; the large primary variant is 40px everywhere.
- Icon-only buttons are 32×32px minimum — never a bare 16px glyph as a hit target.
- Table row actions remain 24px glyphs inside 32px hit areas; on touch they stay visible (no hover-reveal).

### Collapsing Strategy

- **Sidebar**: full 240px ≥1024px → 64px icon rail at 768–1023px → off-canvas drawer (hamburger) below 768px.
- **Card grids**: 3-up → 2-up at 768px → 1-up below 480px.
- **Page header**: title truncates with ellipsis; secondary actions collapse into a "more" menu before the primary action ever moves.
- **Modals**: 968/800/600 → one step down at each breakpoint; full-bleed (100vw × 100vh) below 480px.

### Table & Data Behavior

- Tables keep their column semantics: horizontal scroll with a sticky header and a sticky first column; never stack columns into cards (that destroys comparison — the table's purpose).
- Dense numeric grids (KPI rows) wrap 3-up → 2-up → 1-up, never shrink.
- Charts resize fluidly but keep a minimum 280px height and re-render, never letterbox.

## Iteration Guide

1. Work on ONE component at a time and reference it by its `components:` token name from the front matter.
2. When introducing a screen, first place it in the page anatomy: which nav tier, what page header, what content pattern (cards / table / form).
3. Decide the elevation level before styling any container: static = surface, card = raised, floating = overlay. If it doesn't float, it gets no shadow.
4. Default all UI text to `{typography.body}` 14px/400; escalate to 500 only for interactive emphasis, 600 only for titles.
5. Default every new container to `{rounded.xs}` 3px and 1px `{colors.hairline}` borders; justify any deviation in the PR.
6. Every data view ships all four states: content / empty / loading / error. A view without them is incomplete.
7. Write the microcopy before the markup: sentence case, verb-led button ("创建简历"), error = what happened + how to fix.
8. Audit the finished view: one primary action? contrast ≥4.5:1? keyboard path to everything? focus ring visible? If any fails, fix before expanding scope.

## Known Gaps

- Token hex values are pinned to canonical ADS light/dark themes. ADS refreshed several values for readability (e.g. `color.text.subtle` #42526e → #44546f, focus #2684ff → #388bff); re-verify against `atlassian.design/tokens/all-tokens` once at implementation time and update the front matter — do not mix eras of tokens in one build.
- Dark-mode interaction states are documented as white opacity overlays (8% hover / 12% pressed); confirm the exact percentages against current ADS dark tokens when building dark mode.
- ADS ships no density variants by design; this spec deliberately inherits that single-density position.
- Chart colors are pinned to the ADS categorical palette; precise `color.chart.*` token values should be resolved from the token docs before building the analytics dashboard.
- ADS component behaviors (focus traps, `aria-sort` announcements, flag timing) are summarized here for generation purposes; implement full ARIA behavior per WAI-ARIA Authoring Practices.
- CareerOS AI's own voice guidelines (Chinese-first microcopy, brand tone) are authored separately; the sentence-case / verb-led rules here are the shared baseline they extend.
