# CareerOS AI — 技术方案设计

> 版本：v1.0 | 最后更新：2026-07-26

---

## 一、技术需求分析

### 1.1 需求全景

在决定用什么技术之前，先明确 CareerOS AI 到底需要技术解决哪些问题。

### 1.2 前端交互需求

| 需求 | 说明 | 复杂度 | 技术含义 |
|------|------|--------|----------|
| 分步表单 | Profile 信息采集（教育→技能→经历→目标），每步3-5个字段 | 中 | 需要表单状态管理、步骤间数据保持、输入验证 |
| 数据可视化 | 能力雷达图、匹配度环形图、成长时间线 | 中 | 需要图表库，雷达图是非标准图表 |
| AI流式输出 | 画像分析、简历优化的结果流式展示 | 中 | 需要 SSE/Stream 处理，逐字渲染 |
| 修改对比视图 | 简历"改前 vs 改后"左右对比 | 中 | Diff 视图组件，逐条接受/拒绝交互 |
| 文件上传 | 简历 PDF/Word 上传 + 拖拽 + 进度 | 低 | 标准文件上传组件 |
| 响应式布局 | PC 为主，平板可访问 | 低 | CSS 框架 + 媒体查询 |
| 加载与空状态 | AI 分析进度动画、各模块空状态引导 | 低 | 动效 + 状态管理 |

### 1.3 后端服务需求

| 需求 | 说明 | 复杂度 | 技术含义 |
|------|------|--------|----------|
| 用户系统 | 注册/登录/会话管理 | 低 | Auth 框架 + Session/Token |
| 用户数据 CRUD | Profile、简历、路线图数据的增删改查 | 低 | RESTful API + ORM |
| 文件处理 | 简历 PDF/Word 上传、存储、文本提取 | 中 | 文件存储 + 文档解析库 |
| 简历导出 | 优化后的简历导出为 PDF/Word | 中 | 服务端/客户端 PDF 生成 |
| API 路由与鉴权 | 保护用户数据，防止越权访问 | 低 | 中间件 + API 鉴权 |

### 1.4 AI 能力需求

| 需求 | 说明 | 复杂度 | 技术含义 |
|------|------|--------|----------|
| 结构化分析 | 将用户非结构化输入 → 结构化画像 JSON | 高 | LLM + Structured Output / JSON Mode |
| 职业方向推荐 | 基于画像推理2-4个方向 + 匹配度计算 | 高 | LLM 推理 + Prompt Engineering |
| 路线图生成 | 生成3-4阶段学习计划（含任务、时间、资源） | 高 | LLM 生成长结构化内容 |
| 简历解析 | 从 PDF/Word 提取结构化信息 | 中 | LLM Vision / 文档解析 + LLM 提取 |
| 简历重写 | 根据目标方向重新叙事每段经历 | 高 | LLM + 保留事实约束 |
| ATS 评分 | 评估简历关键词覆盖和格式友好性 | 中 | LLM 评估 / 规则引擎 |
| 流式响应 | 长内容生成时的流式输出改善体验 | 中 | SSE / WebSocket |

### 1.5 数据存储需求

| 数据类型 | 特征 | 存储要求 |
|----------|------|----------|
| 用户账户 | 结构化、固定 schema | 关系型 |
| 职业画像 | 半结构化 JSON（能力标签、方向推荐、雷达图数据） | 关系型 + JSON 列 |
| 成长路线图 | 嵌套结构（路线图→阶段→任务） | 关系型（关联表） |
| 简历数据 | 原始文件 + 解析后的结构化数据 + 优化版本 | 文件存储 + 关系型 |
| AI 生成内容 | 每次Agent调用的输入/输出，用于调试和迭代 | 关系型 / 日志 |

### 1.6 Agent 能力需求

| 需求 | 说明 | 技术含义 |
|------|------|----------|
| Multi-Agent 调度 | 根据用户意图路由到对应 Agent | Agent 注册 + 路由逻辑 |
| Agent 上下文共享 | Agent 之间读取上游产出数据 | 共享上下文对象 |
| Prompt 管理 | Agent 的 System Prompt 从代码解耦 | Prompt 模板引擎 / 配置文件 |
| 结构化输出 | Agent 返回结构化 JSON，而非自由文本 | JSON Schema 约束 |
| 流式输出 | Agent 支持流式返回长内容 | Stream 接口 |
| 可观测性 | Agent 调用日志、耗时、成功率监控 | 日志 + 基础指标 |

---

## 二、技术方案评估

---

### 2.1 前端框架

#### 方案对比

| 维度 | Next.js 14 (App Router) | React SPA (Vite) | Vue 3 (Nuxt) |
|------|------------------------|-------------------|--------------|
| **SSR/SSG** | ✅ 原生支持 | ❌ 需额外配置 | ✅ Nuxt 支持 |
| **API Routes** | ✅ 内置，可做 BFF | ❌ 需独立后端 | ✅ Nuxt server routes |
| **生态** | React 生态最大 | React 生态最大 | 生态较小但稳定 |
| **学习曲线** | 中（App Router 新范式） | 低（标准 React） | 低（中文文档好） |
| **部署** | Vercel 一键部署 | 需额外配置 | 需额外配置 |
| **AI 侧渲染** | ✅ 流式 SSR 天然适合 AI 内容 | ⚠️ 纯客户端 | ✅ 支持 |
| **TypeScript** | ✅ 一等支持 | ✅ 支持 | ✅ 支持 |
| **个人开发效率** | 高（全栈能力） | 中（需额外后端） | 高 |
| **作品集价值** | 高（业界主流） | 中 | 中 |

#### 评估结论

| 方案 | 是否适合 |
|------|----------|
| **Next.js 14** | ✅ **推荐**。全栈能力让个人开发者在一个项目中搞定前后端；流式SSR天然适合AI内容展示；Vercel部署零配置；React生态成熟 |
| React SPA (Vite) | ❌ 缺少后端能力，需额外搭建API服务，增加个人开发负担 |
| Vue 3 (Nuxt) | ⚠️ 备选。中文社区好，但AI/LLM生态（SDK、示例）以React为主，选Vue会增加对接成本 |

---

### 2.2 后端方案

#### 方案对比

| 维度 | Next.js API Routes (BFF) | Python FastAPI | Node.js Express/Fastify |
|------|--------------------------|----------------|------------------------|
| **与前端一致性** | ✅ 同一项目、同语言 | ❌ 异构，需跨语言协调 | ✅ 同语言 |
| **AI/LLM SDK** | ⚠️ OpenAI/Anthropic 有官方 TS SDK | ✅ 最完善的 AI 生态 | ⚠️ 同左 |
| **文件处理** | ⚠️ PDF解析库较弱 | ✅ PyPDF2, python-docx 成熟 | ⚠️ 同左 |
| **开发效率（个人）** | ✅ 一个项目，一套类型 | ❌ 两套语言、两个服务 | ✅ 一个项目 |
| **部署复杂度** | ✅ 一体化部署 | ❌ 需独立部署Python服务 | ✅ 一体化部署 |
| **扩展性** | 中（Vercel Serverless 限制） | 高（独立服务可独立扩容） | 中 |
| **作品集价值** | 中（全栈TS能力） | 高（展示异构系统设计） | 中 |

#### 关键判断

这是整个技术方案中最重要的决策。两种路线：

**路线A：纯 TypeScript 全栈（推荐）**

```
Next.js → API Routes (BFF) → LLM SDK 直接调用
```

- 适合个人开发：一个语言、一个项目、一个部署
- LLM 调用本质是 HTTP 请求，TS 完全胜任
- 文件解析有 pdf-parse, mammoth 等 npm 包（虽不如 Python 成熟，但够用）
- 当 Agent 逻辑极其复杂时，可以后期抽离 Python 服务

**路线B：Next.js + Python Agent 服务**

```
Next.js → API Routes (BFF) → Python FastAPI (Agent层) → LLM
```

- 架构更"企业级"，作品集展示价值更高
- 但个人维护两套语言和两个服务成本高
- 文件处理更强（Python 生态优势）

#### 评估结论

| 方案 | 是否适合 |
|------|----------|
| **纯 TypeScript 全栈** | ✅ **推荐**。MVP 阶段个人开发的最优解。Agent 逻辑在当前阶段不会复杂到必须用 Python。保留未来拆出 Python 服务的架构空间。 |
| Next.js + Python FastAPI | ⚠️ 过度设计。MVP 阶段两套服务增加开发负担。可在 Phase 2 时引入。 |
| 纯 Python 全栈（Django/Flask + 模板） | ❌ 前端交互体验差，不适合 AI SaaS 产品形态 |

---

### 2.3 AI / LLM 接入方案

#### 方案对比

| 维度 | 直接 SDK 调用 | LangChain | Vercel AI SDK |
|------|-------------|-----------|---------------|
| **复杂度** | 低 | 高 | 低 |
| **学习成本** | 低 | 高（概念多：Chain/Agent/Tool/Memory） | 低 |
| **灵活性** | 高（完全控制） | 中（框架约束） | 中 |
| **流式支持** | 原生支持 | 支持但复杂 | ✅ 一等支持 |
| **多模型切换** | 手动适配 | ✅ 统一接口 | ✅ 统一接口 |
| **Agent 抽象** | 需自行设计 | ✅ 内置 | ⚠️ 基础 |
| **调试难度** | 低（直接看请求） | 高（黑盒层层嵌套） | 低 |
| **打包体积** | 极小 | 大 | 小 |
| **适合场景** | 自定义 Agent 架构 | 复杂 Chain 编排 | AI SDK 快速集成 |

#### 评估结论

| 方案 | 是否适合 |
|------|----------|
| **直接 SDK + 自建 Agent 抽象** | ✅ **推荐**。CareerOS 的 Agent 模式（Profile/Navigator/Resume）是结构化的输入→分析→结构化输出，不是复杂的 Chain 编排。直接调用 SDK 更灵活、更可调试、更轻量。自建轻量 Agent 层反而比 LangChain 更适合这个场景。 |
| LangChain | ❌ 过度设计。LangChain 擅长的是"Chain 编排 + Tool 调用 + Memory 管理"的复杂场景。CareerOS 的每个 Agent 本质是"精心设计的 Prompt + Structured Output"，不需要 Chain。引入 LangChain 增加复杂度和调试成本，降低灵活性。 |
| Vercel AI SDK | ⚠️ 备选。如果前端用 Next.js + Vercel 部署，AI SDK 的流式支持开箱即用。但它的 Agent 抽象较弱，且与 Vercel 平台耦合。可作为流式响应的工具库，Agent 层仍自行设计。 |

---

### 2.4 数据库方案

#### 方案对比

| 维度 | PostgreSQL | Supabase (托管PG) | MongoDB | SQLite (Turso/LibSQL) |
|------|-----------|-------------------|---------|----------------------|
| **数据结构匹配** | ✅ 用户/画像/路线图适合关系型 | ✅ 同左 | ⚠️ 嵌套数据适合文档，但关联查询弱 | ✅ 关系型 |
| **JSON 支持** | ✅ JSONB 列，适合半结构化画像 | ✅ | ✅ 原生 JSON | ⚠️ 基础支持 |
| **托管服务** | 需自行选择 | ✅ 自带（含 Auth + Storage） | Atlas | ✅ Turso 边缘部署 |
| **个人开发友好** | 中（需自己搭或找托管） | ✅ 高（免费额度够用） | 中 | 高 |
| **迁移工具** | Prisma/Drizzle | Prisma/Drizzle | Mongoose/Prisma | Prisma/Drizzle |
| **生态成熟度** | ★★★★★ | ★★★★ | ★★★★ | ★★★ |
| **与 Next.js 配合** | 好 | ✅ 优秀（官方适配） | 好 | 好 |

#### 评估结论

| 方案 | 是否适合 |
|------|----------|
| **PostgreSQL + Prisma** | ✅ **推荐**。关系型完美匹配 CareerOS 的数据结构（用户-画像-路线图-简历是典型关联关系）；JSONB 列容纳半结构化 AI 产出；Prisma 提供类型安全的 ORM，对个人开发效率极高。托管选 Supabase（免费额度 + 自带 Auth + Storage）或 Neon（Serverless PG）。 |
| MongoDB | ❌ 不适合。CareerOS 的核心数据之间有强关联（User→Profile→Resume→Roadmap），文档型数据库在处理关联查询时需要 populate 或 $lookup，不如关系型自然。 |
| SQLite | ⚠️ 备选。极其简单、零配置。适合"我只想快速跑起来"的场景。但 MVP 就要处理并发请求 + AI 调用，SQLite 的并发写入限制可能成为瓶颈。不推荐。 |

---

### 2.5 文件存储方案

| 维度 | 本地文件系统 | Vercel Blob | Supabase Storage | Cloudflare R2 |
|------|------------|-------------|-----------------|---------------|
| **MVP 成本** | 零配置 | Vercel 集成好 | 免费额度 | 免费额度大 |
| **扩展性** | 无 | ✅ | ✅ | ✅ |
| **PDF 处理配合** | 方便（本地路径直接读） | 需下载后再处理 | 需下载后再处理 | 需下载后再处理 |
| **推荐阶段** | MVP 开发阶段 | 生产部署 | 如果用 Supabase 全家桶 | 低价方案 |

#### 评估结论

**MVP 阶段：本地文件系统**（零成本，开发效率最高）。部署时切换为 Vercel Blob（如果前端部署在 Vercel）或 Supabase Storage（如果用 Supabase）。

---

### 2.6 CSS / UI 方案

| 维度 | Tailwind CSS | Ant Design | shadcn/ui | 自写 CSS |
|------|-------------|-----------|-----------|----------|
| **开发速度** | 高 | 高（组件开箱即用） | 高（组件可复制） | 低 |
| **定制性** | 高 | 低（Ant Design 风格明显） | 高（源码可控） | 最高 |
| **作品集展示** | 中（常见） | 低（千篇一律） | 高（现代、专业） | 高 |
| **体积** | 小（按需） | 大 | 小 | 最小 |
| **学习成本** | 中 | 低 | 中 | 低 |

#### 评估结论

**Tailwind CSS + shadcn/ui**。Tailwind 提供原子化样式的开发效率；shadcn/ui 提供可定制的组件（表单、对话框、Tabs 等），源码在项目中可自由修改——既能快速开发，又能保证作品的视觉独特性。

---

## 三、推荐技术栈

### 3.1 技术栈总览

```
┌─────────────────────────────────────────────────────────────┐
│                     推荐技术栈                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Frontend       Next.js 14 (App Router)                     │
│                 TypeScript, Tailwind CSS, shadcn/ui          │
│                                                             │
│  Backend/BFF    Next.js API Routes + tRPC (类型安全API)      │
│                                                             │
│  AI Agent       TypeScript 自建轻量 Agent 框架               │
│                 (封装 LLM SDK + Structured Output)           │
│                                                             │
│  LLM            OpenAI GPT-4o / Anthropic Claude            │
│                 (Adapter Pattern 支持切换)                   │
│                                                             │
│  Database       PostgreSQL + Prisma ORM                     │
│                 (托管: Supabase / Neon)                      │
│                                                             │
│  Auth           NextAuth.js v5 (Auth.js)                    │
│                                                             │
│  File           MVP: 本地文件系统                           │
│                 Prod: Vercel Blob / Supabase Storage        │
│                                                             │
│  Charts         Recharts (雷达图/环形图/时间线)              │
│                                                             │
│  PDF            pdf-parse, mammoth (解析)                   │
│                 @react-pdf/renderer (生成)                   │
│                                                             │
│  Validation     Zod (Schema 验证 + TypeScript 类型推导)       │
│                                                             │
│  Deployment     Vercel (统一部署)                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 为什么选择这套组合

#### 核心理由：最大化个人开发者的杠杆

```
"用最少的语言、最少的服务、最少的配置，
构建出具备真实 AI SaaS 架构的作品。"
```

| 维度 | 说明 |
|------|------|
| **一语言** | TypeScript 贯穿前后端 + Agent 层。不需要切换 Python/TS 上下文 |
| **一项目** | Next.js 单仓库包含前端 + BFF + API。不需要微服务编排 |
| **一部署** | `git push` → Vercel 自动部署。不需要 Docker/K8s |
| **类型安全贯穿** | Zod schema → Prisma → tRPC → React props，全链路类型安全 |
| **AI 适配器** | LLM Provider 通过 Adapter 抽象，未来切换模型零改动 |
| **架构可演进** | Agent 层当前在 TS 中，但接口设计支持未来拆为独立 Python 服务 |

#### 为什么不选其他方案

| 没选的方案 | 原因 |
|-----------|------|
| Python 后端 | MVP 阶段个人维护两套语言+两个服务成本高。LLM API 就是 HTTP 请求，TS 完全能胜任。保留未来拆出 Python 服务的接口设计。 |
| LangChain | 过度抽象。CareerOS 的 Agent 是"精心 Prompt + Structured Output"，不是 Chain 编排。自建 200 行 Agent 抽象比引入 LangChain 更可控。 |
| MongoDB | 数据之间强关联，关系型更自然。PostgreSQL 的 JSONB 兼具文档灵活性。 |
| 微服务架构 | 个人开发，单体优先。Agent 间通过接口调用而非网络调用，足够清晰。 |

### 3.3 后续扩展能力

| 当...时可以... | 扩展方式 |
|---------------|----------|
| Agent 逻辑变复杂（RAG、Tool use） | 将 Agent 层拆为独立 Python FastAPI 服务，前端通过 BFF 转发 |
| 用户量和数据量增长 | PostgreSQL 迁移到 Supabase/Neon 高配实例，API 加缓存层 |
| 需要多模型切换 | Adapter Pattern 已支持，加新 Provider 只需实现接口 |
| 简历处理需要 OCR | 引入 Python OCR 微服务（单一职责，不影响其他模块） |
| 实时协作需求 | Next.js 迁移到实时框架（WebSocket），或引入 Replicache |
| 移动端需求 | API 层已就绪，前端加 React Native 或 PWA |

---

## 四、System Architecture

### 4.1 系统架构全景图

```
┌─────────────────────────────────────────────────────────────────┐
│                          用户层                                  │
│                                                                  │
│   PC Browser  │  Tablet Browser  │  (未来: Mobile / 小程序)      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                        Frontend (Next.js)                        │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Landing  │  │  Profile │  │Navigator │  │  Resume  │        │
│  │  Page    │  │  Builder │  │   View   │  │  Editor  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐           │
│  │              Shared Components                    │           │
│  │  RadarChart │ DiffViewer │ Timeline │ FileUpload  │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                    Backend / BFF (Next.js API Routes)            │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Auth    │  │  User    │  │  File    │  │  Export  │        │
│  │  Routes  │  │  Routes  │  │  Routes  │  │  Routes  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐           │
│  │            AI Orchestration Layer                 │           │
│  │  · Agent Router (根据 intent 路由到 Agent)        │           │
│  │  · Context Builder (组装 Agent 上下文)            │           │
│  │  · Stream Handler (流式响应管理)                  │           │
│  │  · Agent Logger (调用日志与观测)                  │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                       Agent Layer                                │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Profile  │  │Navigator │  │  Resume  │   ← MVP              │
│  │  Agent   │  │  Agent   │  │  Agent   │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Matching │  │  Coach   │  │Interview │   ← Phase 2/3        │
│  │  Agent   │  │  Agent   │  │  Agent   │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     Infrastructure Layer                         │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │   LLM    │  │ Database │  │  File    │  │  Auth    │        │
│  │ Provider │  │PostgreSQL│  │ Storage  │  │ Service  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 核心数据流

#### 4.2.1 用户请求完整链路

```
用户在浏览器操作
        │
        ▼
┌──────────────────┐
│  React Component │  用户点击"生成画像" / "优化简历"
│  (Client)        │
└────────┬─────────┘
         │ HTTP POST (with credentials)
         ▼
┌──────────────────┐
│  Next.js API     │  鉴权、参数验证、限流
│  Route (BFF)     │
└────────┬─────────┘
         │ tRPC procedure call (类型安全)
         ▼
┌──────────────────┐
│  AI Orchestrator │  识别意图 → 选择 Agent → 组装上下文 → 调用 Agent
└────────┬─────────┘
         │ Agent.execute(input, context)
         ▼
┌──────────────────┐
│  Agent Instance  │  加载 System Prompt → 注入上下文 → 调用 LLM
│  (Profile/       │  → 解析结构化输出 → 返回结果
│   Navigator/     │
│   Resume)        │
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌──────┐  ┌──────────┐
│ LLM  │  │ Database │  LLM: 发送 Prompt + 用户数据 → 接收结构化响应
│ API  │  │  读写    │  DB: 保存 Agent 产出 → 关联用户
└──────┘  └──────────┘
    │
    ▼ (Stream)
┌──────────────────┐
│  SSE Response    │  流式返回给前端 → React 逐字渲染
└──────────────────┘
```

#### 4.2.2 Agent 调用流程（以 Resume Agent 为例）

```
┌─────────────────────────────────────────────────────────┐
│                   Orchestrator                           │
│                                                         │
│  1. 接收请求: { userId, resumeFile, targetDirection }   │
│  2. Intent 识别: "resume_optimize"                     │
│  3. Route → ResumeAgent                                │
│  4. Build Context:                                     │
│     · 从 DB 读取 User Profile                          │
│     · 从 DB 读取用户的能力标签                            │
│     · 组装为 Agent 可用的上下文对象                       │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Resume Agent                           │
│                                                         │
│  1. 简历解析 (调用 LLM Vision / 文本提取)                 │
│     Prompt: "提取这份简历中的结构化信息"                   │
│     Output: { name, education, experiences[], ... }     │
│                                                         │
│  2. 内容理解 (调用 LLM)                                  │
│     Prompt: "分析每段经历体现的能力和可迁移技能"            │
│     Output: [{ exp, skills[], level }]                  │
│                                                         │
│  3. 方向重写 (调用 LLM，逐段处理)                         │
│     Prompt: "目标方向是{target}，重写以下经历"             │
│     Context: 用户画像数据 + 能力标签                       │
│     Output: [{ original, rewritten, reason }]           │
│                                                         │
│  4. 质量检查 (调用 LLM)                                  │
│     Prompt: "评估优化后简历的ATS友好性和可读性"            │
│     Output: { atsScore, suggestions[] }                 │
│                                                         │
│  5. 组装最终结果                                         │
│     → 返回给 Orchestrator                               │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                   Orchestrator                           │
│                                                         │
│  6. 保存结果到 Database                                 │
│  7. 通过 SSE 流式返回给前端                              │
│  8. 记录 Agent 调用日志                                 │
└─────────────────────────────────────────────────────────┘
```

### 4.3 项目目录结构

```
careeros-ai/
├── src/
│   ├── app/                    # Next.js App Router 页面
│   │   ├── (landing)/          # 首页/落地页
│   │   ├── (dashboard)/        # 用户控制台
│   │   │   ├── profile/        # 职业画像
│   │   │   ├── navigator/      # 成长路线图
│   │   │   ├── resume/         # 简历优化
│   │   │   └── settings/       # 个人设置
│   │   ├── api/                # API Routes (BFF)
│   │   │   ├── auth/           # 鉴权
│   │   │   ├── profile/        # 画像 CRUD
│   │   │   ├── navigator/      # 路线图 CRUD
│   │   │   ├── resume/         # 简历处理
│   │   │   └── agent/          # Agent 调用入口
│   │   └── layout.tsx
│   │
│   ├── components/             # React 组件
│   │   ├── ui/                 # shadcn/ui 基础组件
│   │   ├── profile/            # 画像相关组件
│   │   ├── navigator/          # 路线图组件
│   │   ├── resume/             # 简历编辑器组件
│   │   └── shared/             # 通用组件 (RadarChart, DiffViewer...)
│   │
│   ├── lib/                    # 核心库
│   │   ├── agents/             # ⭐ Agent 层
│   │   │   ├── base.ts         # Agent 基类
│   │   │   ├── types.ts        # Agent 类型定义
│   │   │   ├── registry.ts     # Agent 注册表
│   │   │   ├── profile.agent.ts
│   │   │   ├── navigator.agent.ts
│   │   │   └── resume.agent.ts
│   │   ├── llm/                # LLM Provider 适配层
│   │   │   ├── adapter.ts      # LLM Adapter 接口
│   │   │   ├── openai.ts       # OpenAI 实现
│   │   │   ├── anthropic.ts    # Anthropic 实现
│   │   │   └── index.ts
│   │   ├── orchestration/      # Agent 调度层
│   │   │   ├── orchestrator.ts # 调度器
│   │   │   ├── context.ts      # 上下文构建器
│   │   │   └── stream.ts       # 流式处理
│   │   ├── prompts/            # Prompt 模板管理 (Markdown/YAML)
│   │   │   ├── profile/
│   │   │   ├── navigator/
│   │   │   └── resume/
│   │   ├── db/                 # 数据库
│   │   │   ├── prisma.ts       # Prisma Client
│   │   │   └── schema.prisma   # 数据模型
│   │   ├── auth.ts             # Auth 配置
│   │   ├── file/               # 文件处理
│   │   │   ├── parser.ts       # PDF/Word 解析
│   │   │   └── generator.ts    # PDF 导出
│   │   └── utils/              # 工具函数
│   │
│   └── styles/                 # 全局样式
│
├── public/                     # 静态资源
├── prisma/
│   └── schema.prisma           # Prisma Schema
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
└── package.json
```

> **4.3 落地偏差记录(2026-08-18,任务 1.1 实施确认,以实际代码为准)**:
> - `src/app/api/` **不建** REST 式子目录(auth/profile/navigator/resume/agent)——API 层统一走 tRPC Router(见 6.2);仅 NextAuth 回调、文件上传等框架必需端点以 Route Handler 形式落在 api/ 下(随任务 1.4、4.1 建立),当前为空占位目录。
> - 配置文件实际为 **`next.config.mjs`**(Next.js 14 不支持 TypeScript 配置文件,非 next.config.ts)。
> - `prisma/schema.prisma`(根目录 prisma/)为**唯一** schema 位置;树上 `src/lib/db/schema.prisma` 不建,`src/lib/db/` 仅放 prisma.ts(Prisma 官方惯例)。
> - 补充文件:全局样式为 `src/styles/globals.css`(shadcn 主题 CSS 变量所在,components.json 已指向);测试基建为 `vitest.config.mts` + `src/test/setup.ts`(Vitest + Testing Library,树上未列)。

---

## 五、MVP 技术范围

### 5.1 必须实现

| 层级 | 能力 | 具体内容 |
|------|------|----------|
| **Frontend** | 页面与组件 | Landing Page, Profile Builder（分步表单）, Navigator View（时间线）, Resume Editor（上传+对比视图） |
| | 可视化 | 能力雷达图（Recharts）、匹配度环形图、成长时间线 |
| | 交互 | 流式AI内容渲染、修改对比Diff视图、文件拖拽上传 |
| **Backend/BFF** | API | 用户CRUD、Profile CRUD、Resume CRUD、Navigator CRUD |
| | Auth | 邮箱注册/登录、Session管理 |
| | File | 简历文件上传、PDF文本解析（pdf-parse）、Word文本解析（mammoth） |
| | Export | 简历导出PDF（@react-pdf/renderer，客户端生成） |
| **AI Agent** | Agent 框架 | Agent 基类、Agent 注册表、结构化输出约束 |
| | Profile Agent | System Prompt + 画像生成逻辑 |
| | Navigator Agent | System Prompt + 路线图生成逻辑 |
| | Resume Agent | System Prompt + 简历解析/重写逻辑 |
| | Orchestrator | Agent路由、上下文组装、流式响应 |
| **LLM** | Provider | OpenAI GPT-4o 或 Anthropic Claude（至少一个） |
| | Adapter | LLM Adapter 接口 + 一个实现 |
| **Database** | Schema | User, Profile, Roadmap, Stage, Resume (5张核心表) |
| | ORM | Prisma Client + Migrations |
| **Infra** | Dev | 本地 PostgreSQL (Docker) 或 Supabase 免费实例 |
| | Deploy | Vercel (Hobby Plan) |

### 5.2 可以 Mock / 简化

| 能力 | MVP 做法 | 未来做法 |
|------|----------|----------|
| 微信登录 | 不做，仅邮箱登录 | Phase 2 接入微信开放平台 |
| ATS 深度评分 | LLM 简单评估（Prompt 中说明评估标准） | 规则引擎 + ML 模型 |
| 能力雷达图动态对比 | 静态渲染当前画像数据 | 支持"历史vs现在"动态对比 |
| 路线图任务进度追踪 | 本地状态，手动标记 | 服务端持久化 + 推送提醒 |
| 简历多版本管理 | 单一最新版本 | 版本历史 + diff |
| 岗位数据源 | 用户手动粘贴 JD | 接入招聘平台 API / 爬虫 |
| 用户行为分析 | 不做 | Google Analytics / PostHog |
| Agent 调用日志 | console.log | 结构化日志 + 监控面板 |

### 5.3 明确不做（留给 Phase 2/3）

| 能力 | 归入阶段 |
|------|----------|
| Matching Agent（岗位匹配） | Phase 2 |
| Coach Agent（技能差距+90天计划） | Phase 2 |
| Interview Agent（模拟面试） | Phase 3 |
| Python 微服务（Agent 拆离） | Phase 2（按需） |
| 企业端功能 | Phase 3 |
| 移动端适配（完整响应式） | Phase 2 |
| RAG / 向量数据库 | Phase 2（按需） |
| 多租户 / 团队版 | 不规划 |

---

## 六、关键设计决策

### 6.1 为什么自建轻量 Agent 框架而非用 LangChain

```
LangChain 提供的                     CareerOS 实际需要的
─────────────────                   ──────────────────
Chain 编排（A→B→C→D）               不需要。Agent 独立运行，Orchestrator 串流程
Tool 调用（搜索/计算/API）           不需要。MVP 阶段 Agent 纯推理，不调外部工具
Memory 管理（长对话）                不需要。每次调用独立，上下文由 Orchestrator 组装
RAG（向量检索）                      不需要。MVP 阶段没有知识库检索需求
Prompt Template                     需要。但这是字符串模板，不需要框架
Structured Output                   需要。用 Zod + LLM JSON Mode 即可
Multi-Provider                      需要。用 Adapter Pattern（~50行代码）
```

**结论**：CareerOS 的 Agent 模式是"精心设计的 Prompt + 结构化输入 → LLM 推理 → 结构化输出"。LangChain 90% 的能力用不上，但100%的复杂度要承担。自建一个 200-300 行的 Agent 基础层更合适。

```typescript
// Agent 基类的核心抽象（概念示意，不是代码实现要求）
// 整个 Agent 框架的核心就这么多

interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;       // 从 prompts/ 目录加载
  inputSchema: ZodSchema;     // 输入校验
  outputSchema: ZodSchema;    // 输出校验
  model?: string;             // LLM 模型选择
  temperature?: number;
}

abstract class BaseAgent {
  constructor(config: AgentConfig);
  async execute(input: unknown, context: UserContext): Promise<AgentResult>;
  protected abstract buildMessages(input: unknown, context: UserContext): Message[];
  protected parseOutput(raw: string): unknown;  // JSON Schema 校验
}
```

### 6.2 为什么用 tRPC 而不是 REST/GraphQL

| 方案 | 是否适合 |
|------|----------|
| **tRPC** | ✅ 推荐。TypeScript 前后端类型共享，API 调用像本地函数。个人开发不需要写 API 文档（类型即文档）。Next.js 集成好。 |
| REST | ⚠️ 标准方案。但需要手动维护前后端类型一致，个人开发易出错。 |
| GraphQL | ❌ 过度设计。CareerOS 的查询模式简单，不需要 GraphQL 的灵活性。 |

### 6.3 为什么用 Prisma 而不是 Drizzle 或纯 SQL

| 方案 | 是否适合 |
|------|----------|
| **Prisma** | ✅ 推荐。Schema-first 声明式设计，Migration 自动化，类型生成完善。学习曲线平缓，适合个人开发。 |
| Drizzle | ⚠️ 新兴方案，更轻量。但生态不如 Prisma 成熟，文档和示例较少。 |
| 纯 SQL | ❌ 类型安全缺失，手动维护 schema 和类型映射，个人开发易出错。 |

---

*本文档定义了 CareerOS AI 的技术方案，回答"用什么技术、为什么、怎么组织"。与 [architecture.md](./architecture.md)（产品架构）配合阅读，前者描述"能力如何组织"，本文档描述"能力如何技术实现"。*

---

## 七、M1 实施架构决策补记(2026-08-19,任务 1.2–1.8 落地确认)

M1(项目地基)实施中形成的新架构决策,以实际代码为准:

### 7.1 Agent 进度流设计:确定性生命周期事件 + 一次性 JSON

任务 1.6 确定:流式输出**不做 LLM 逐字流**。`BaseAgent.executeStream` 产出 5 个**确定性**生命周期进度事件(start → prompt → llm → parse → done,中文文案如「正在理解你的背景与目标…」)+ 最终**一次性 JSON 结果**(经 Zod 校验)。理由:MVP 阶段进度文案由 Agent 生命周期确定性产出即可满足体验,LLM 逐字流增加解析与渲染复杂度,收益低;结构化为最终一次性 JSON 使「非法输出→友好错误+日志不崩溃」可精确处理。若后续(2.4 等)确需逐字流,Adapter 层已预留 `stream` 接口,可增量演进。

### 7.2 头像方案:首字母 + 预设配色,零文件存储

头像 = 昵称首字符 + 自动配色(名字哈希 mod 5,5 个预设色:松绿 #0c8a5f / 罗兰紫 #7c5cfc / 琥珀 #b45309 / 湖蓝 #2e6fe8 / 石板灰 #57534b),仅存 `User.avatarColor` 单列(用户显式选择的颜色,无值则回退哈希色)。零文件上传、零存储成本,满足 M1「修改头像」;**头像图片上传留待 4.1 存储抽象就绪后升级**(届时加 avatarUrl 列)。

### 7.3 tRPC 端点位置与直连测试

API 层统一走 tRPC,HTTP 端点为 `/api/trpc/[trpc]`(src/app/api/ 下**不建** 4.3 树中的 auth/profile/navigator/resume/agent REST 目录——树上偏差已记录)。`appRouter` 导出 `createCaller`,`src/lib/trpc/__tests__/` 接口测试用 createCaller 直连调用(真实 Prisma + 真实 PG),不依赖 HTTP 层,可稳定测试鉴权(publicProcedure/protectedProcedure)与业务错误码。

### 7.4 环境变量约定

`.env`(gitignored)/ `.env.example`(提交):`DATABASE_URL`(postgresql://careeros:<本地密码>@localhost:5432/careeros?schema=public)、`NEXTAUTH_SECRET`、`NEXTAUTH_URL=http://localhost:3000`、`LLM_PROVIDER=mock`(开发默认,生产改 deepseek)。Provider 切换仅改环境变量,零代码改动。

### 7.5 next-auth v5 锁定与 trustHost

next-auth 锁定 **5.0.0-beta.32**(beta API 会漂移,精确锁定写入 package.json);Credentials + jwt session(用户 id 注入 token,session 增补)。`trustHost: true` 为生产构建必需(否则 UntrustedHost 500)。`auth.config.ts`(edge 安全,无 providers)与 `auth.ts`(Credentials + bcrypt)拆分;受保护路径匹配逻辑(isProtectedPath:精确或 `${path}/` 前缀)在 `auth.config.ts` 的 `authorized` 回调,纯函数可单测。

### 7.6 Prisma 6 锁定

锁定 **Prisma 6**(7 的默认引擎变更与当前 schema 写法不兼容;`prisma/schema.prisma` 用 classic `url = env("DATABASE_URL")`)。升级 Prisma 7 需迁移配置写法,随后续版本评估。

### 7.7 路由:工作台 /dashboard 与 (dashboard) 组冲突规避

工作台落在 `/dashboard`:`src/app/(dashboard)/dashboard/page.tsx`。原因:Next 14 路由组内 `(dashboard)/page.tsx` 会与根 `app/page.tsx`(首页,属任务 5.2,占位保留)冲突;用子路径 /dashboard 显式命名规避。受保护路径列表 = /dashboard /profile /navigator /resume /settings。

### 7.8 middleware 位置(src/ 布局)

Next.js 14 在 src/ 布局下会**静默忽略根目录 middleware.ts**(无编译产物,/dashboard 直接 404)。middleware 必须在 `src/middleware.ts`,导出 `NextAuth(authConfig).auth`,matcher 覆盖 5 条受保护路径。此为本项目 + src/ 布局 + Next 14 组合的坑,后续任务勿再移动。

### 7.9 顶栏资料同步:user.me + React Query invalidate

顶栏昵称/头像配色经 `trpc.user.me`(React Query)拉取;updateProfile 成功后 `utils.user.me.invalidate()` 即时同步,无需刷新页面。会话(session)只作登录态判定与回退展示,资料以 user.me 为准(单一数据源)。

### 7.10 Prompt 以 Markdown 解耦 + fs 加载(部署注意)

Agent System Prompt 存 `src/lib/prompts/*.md`,经 `loadPrompt` 以 `fs` 从 `process.cwd()` 读取 + 模块级缓存。本地开发零成本;**若部署 Vercel Serverless,fs 读取打包内文件可能失效,需改为 import 资源或读打包产物**(4.1 部署前评估,已记入 progress.md 遗留)。

## 八、M2 实施架构决策补记(2026-08-20,任务 2.1–2.7 落地确认)

M2(Career Profile)实施中形成的新架构决策,以实际代码为准:

### 8.1 画像版本模型:每分析一行,不可变快照

每次分析(首建 / 纠偏 / 更新信息)在 CareerProfile 表创建**新行**:`version = 当前最大 version + 1`,`parentVersion = 上一版本的 version 数值`(非 id——Schema 为 Int 存储版本号,读取时按 version 定位父行),数据列与 aiAnalysis 写入后**不再修改**(不可变快照);活跃版本 = 该用户最大 version。CareerPath 随每次分析全量重建(deleteMany + createMany,数据量小、保证与快照一致)。版本选择器(listVersions + getVersion)供查看旧版本。纠偏/更新失败时**不创建新行**,旧版本完好可读。

### 8.2 分析管线:进度落库 + 客户端轮询 + stale 判失败

`profile.analyze` 为一次等待执行完成的 tRPC mutation:创建 AgentRun(running)→ Orchestrator 执行,进度事件经新增的 `onRunProgress` 回调**实时写入 `AgentRun.progress`(Json)**(管线内以 promise 链串行化读-改-写,防事件连发覆盖丢失;返回前等待全部落库)→ 完成写 succeeded/failed 并返回结果。客户端轮询 `profile.latestRun`(约 700ms)渲染进度条与文案轮播;页面刷新后按 run 恢复。**stale 判据**(4.9 修订):`running 且 updatedAt > LLM_TIMEOUT_MS + 60s`(单次 LLM 调用已统一 3 分钟超时,超时即落 failed;健康 run 停更间隙不会超过超时,超过阈值仍 running 只可能是进程死亡)在查询层序列化为 failed「分析中断,请重试」,保证任何中断都有恢复路径。失败重试双通道:会话内用最近一次提交数据重放;刷新后 `profile.retry` 从 AgentRun.input 服务端重放(无需客户端回传数据)。

**4.9 修订(简历改写状态卡死修复)**:mutation 响应不再是完成信号,视图完成判定改由轮询权威数据驱动(run 终态 + 落库版本,`resume-hub.tsx`);mutation 仅作触发与本次会话错误提示(且仅在权威无终态时展示)。`adapter.complete` 非流式阻塞调用统一 3 分钟超时(`createTimeoutSignal`,SDK 中止错误转 `LlmTimeoutError`「AI 响应超时,请重试」)。

### 8.3 纠偏交互:弹窗选择 + Toast + 全量重算(合并两文档要求)

2.6 弹窗(方向/能力/优势多选 + 补充说明 ≤500 字)与 DesignRules Toast 并存:弹窗提交 → 关闭 → Toast「已记录,AI 将重新分析」→ `profile.analyze(feedback)` **全量重算**并生成新版本(implementation-plan 2.6「不采用增量重算」为权威)。纠偏重算期间展示分析过程视图(优先级高于旧结果);失败则失败视图重试并**携带 feedback**(会话内 lastInput 重放 / 刷新后 AgentRun.input 重放)。

### 8.4 Agent 框架扩展:onRunProgress 回调

`Orchestrator.run` 的 RunAgentParams 新增 `onRunProgress?: (runId, progress) => void`,在既有 `onProgress` 链路上挂接,由 runId 定位 AgentRun 行写进度(见 8.2)。此为 Agent 框架面向「进度持久化」的最小扩展点;后续模块(3.x/4.x)复用同一机制。


## 九、M4 补记:简历模块顺序保真(2026-08-22,任务 4.10)

**设计原则(用户确认)**:Schema 定义「模块是什么」;sectionOrder/originalIndex 定义「用户原本放在哪里」;AI 决定「内容如何优化」;最终文本生成器「按用户原始顺序输出」。最终文本顺序严格 = 用户原始简历模块顺序,Schema 顺序只用于内部结构定义,不用于排序。

**三层各司其职**:

1. **顺序权威 = 原文物理顺序**:`buildFinalResumeText` 在 originalText 上按位置升序原位替换 —— 顺序构造性保真,零排序逻辑,AI 输出不参与顺序判定。
2. **检测层(纯函数,确定性)**:`src/lib/resume/section-order.ts` —— `detectSections` 行级扫描(整行标题 + 同行冒号前缀两种形式;归一化后精确匹配词典,防「办公软件技能」类误判;自定义模块词典 + 原文逐字切片)→ `buildSectionPlan`(无标题模块用字段值经 findRawRange 在原文锚定;条目按内容位置归组到各出现;锚定失败 UNLOCATED 哨兵置尾)。
3. **存储与读取**:`Resume.sectionOrder` Json 快照(3 入库点:upload/createFromText/pasteText 写入检测结果);`resume.get` 读取时派生 `sectionPlan`(防御解析,快照非法 → 现场重算兜底)。content/items/锚定均为读取时派生,快照只存结构。

**前端消费**:核对表单按 sectionPlan 顺序渲染(工作/实习分开、自定义模块只读、缺失 kind → 虚拟分区置于已定位模块之后/目标方向之前);结果页「最终文本预览」直接渲染 version.finalText(与复制/导出同字符串)。plan 为 null 时回退固定 Schema 顺序(向后兼容)。

**防乱序纪律**:finalText 合成内部按位置重排;sectionOrder 全程有序数组,不经过 Object.entries/Map 中转;顺序判定不依赖任何异步结果与 DB 查询顺序。

**canonical 单一构造入口(4.10-layout)**:`buildFinalTextForVersion(originalText, optimizations)` —— serializeVersion(预览/复制/PDF 导出)与 scoreAts(ATS 评分)共用同一函数与同一批 DB 行,ATS 分析对象构造性等于「最终文本预览」渲染的字符串;结果页信息层级:优化结果对比卡 → 最终文本预览(卡内复制按钮)→ ATS 评分。

**重新上传入口(4.11→4.12 修订)**:4.11 初版在已有简历时于上传视图展示「当前文件卡 + 更换简历」按钮,验收被否(观感 = 文件列表 + Replace)。4.12 起产品模型为**「重新上传 = 新增一份独立简历」**:上传视图拖拽区常显、有已有简历时标题「上传新简历」并声明「不会修改或删除已有简历」,「更换简历」按钮与旧文件卡彻底移除(上传链路自始就是 `prisma.resume.create` 建新行,不存在 Replace API)。**活跃简历 = URL 参数 `?resumeId=`**:`resume.get` 增加可选 `resumeId` 输入(未传/越权/已删回退最新行),hub 经 `useSearchParams` 读取(resume/page.tsx 包 Suspense);上传成功后 `onUploaded` → `router.replace("/resume")` 清参 → get 回落最新行(新行)→ 既有行 id 变化 effect 复位会话状态并进入新简历。设置页「简历文件管理」逐行「查看」(→ `/resume?resumeId=`)+ 页面级「+ 新增简历」(→ `/resume?upload=1`,hub 置 uploadMode 并去参);`?resumeId` 失效护栏:数据行 ≠ 参数行时去参。无文件去重策略(每次上传=新行,即「多份简历并存」语义)。

**简历中心(4.13 修订)**:4.12 后入口仍割裂(简历管理藏在 设置→简历文件管理,重新上传与列表互不相通)。4.13 起**简历 = 核心业务对象**:设置页「简历文件管理」整体迁移为顶级导航一级页面**「简历中心」`/resumes`**(组件改名 `resume-center.tsx`,卡片 = 继续优化/查看[均 `/resume?resumeId=`,切换活跃行]+ 下载 + 删除 + 页面级新增)。结果页工具条:按钮改名「上传新简历」+ 新增「查看全部简历」(→ `/resumes`)+ Hero 左区「当前简历:{fileName}」。上传视图新增**「从已有简历继续」**列表(`resume.list`,extractError 行标「待补全」):点击 → hub `handleSelectResume` 显式 `setUploadMode(false)` + `router.replace("/resume?resumeId=<id>")` —— 显式退上传视图是关键(选当前行时 id 不变、行切换 effect 不触发)。DB 无改动。

## 十、M4 修订:提取层视觉排序(2026-08-22,任务 4.10 验收修复)

**验收发现(真实 .docx)**:用户以真实 Word 简历验收,「最终文本预览」仍与原始简历模块顺序不一致。端到端定位证实:**乱序发生在提取层 A(originalText),sectionPlan/finalText/表单/复制/导出全部忠实继承**——构建链路无罪,是输入本身已乱序。

**PDF 根因**:pdf-parse 默认 render_page 按内容流(z-order)顺序遍历 items,只在 y 精确相等时换行,无坐标排序;模板生成的 PDF 内容流与视觉顺序不一致 → 提取乱序。

**DOCX 根因(实锤)**:简历模板用绝对定位文本框(wp:anchor)排版,document.xml 中文本框按反视觉顺序书写;mammoth 按文档顺序读 txbxContent → 乱序。真实文件解包:13 个 wp:anchor 文本框、XML 首框 y=10.49in(页面底部),按坐标排序后与视觉完全一致。

**修复(提取层按视觉坐标重建阅读顺序,两种格式同构一次完成)**:

- `src/lib/resume/parser.ts`:`sortPdfItemsByPosition`(y 降序、同行 x 升序、容差 3pt、CJK 相邻不补空格)+ 自定义 `pagerender` 传入 pdf-parse。
- `src/lib/resume/docx-extract.ts`(新增):jszip 解包 + saxes 单遍解析 document.xml;每个 wp:anchor 记录 positionV/H(EMU 坐标),按 y 升序、x 升序组装;mc:Fallback 诱饵文本忽略;锚点前流式段落保持在文本框之前;无文本框 → no-textboxes → 回退 mammoth(既有行为不变)。
- 依赖:jszip / saxes 显式写入 package.json dependencies(零新装)。

**验证**:新增 20 个测试(pdf-position-sort 7 + docx-extract 8 + parser 集成 3 + upload 链路 2),全套 490/490(55 文件);真实 .docx spike 验证输出 = 视觉顺序(13 boxes、无重复、无 DECOY)。

**已知取舍**:仅按框级坐标排序,框内多行按文档序(文本框内部分行罕见);align 型无 posOffset → y=null 置尾按文档序兜底;存量乱序行(4.10-fix 前上传)originalText 已落库乱序,不迁移,需重新上传。
