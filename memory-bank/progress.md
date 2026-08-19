# 项目进度

## 当前项目状态

- **阶段**:Phase 1(MVP 核心闭环),里程碑 M1(项目地基)**全部完成**
- **最近更新**:2026-08-19,任务 1.8 完成,commit `a2ebd41`
- **已完成任务**:1.1 – 1.8 全部完成(共 9 个 commit)
- **当前状态**:**M1 已实现,等待用户整体产品验收**。不开始 M2,不开始阶段 2。
- **测试基线**:91 个测试 / 19 个文件全部通过;typecheck / lint / build 零错误

## 已完成的工作

### 任务 1.1 项目脚手架与目录结构(2026-08-18,commit b463c2f + aee6d7d)

- Next.js 14.2.35 + React 18 + TypeScript 5 + Tailwind CSS 3.4 + ESLint,App Router、src/ 目录、@/* 别名
- shadcn/ui 2.3.0 init(new-york);按 technical-design 4.3 建立完整目录结构
- 测试基建:Vitest 4 + Testing Library;空白占位首页(遵守 DesignRules 禁止 webfont)
- 验证全部通过:dev server 200、lint/typecheck 零错误、测试全绿;用户已验收 ✅

### 任务 1.2 设计 token 落地(2026-08-18,commit 33d623c)

- `tailwind.config.ts`:DesignSystem.md 的全部颜色(green/violet/ink/canvas/surface/sunken/hairline/语义色/chart)、12 级字号(text-h1 → text-caption)、rounded(control/card/modal/pill)、spacing(space-1→20)、shadows(card/hover/popup/modal)、系统字体栈(零 webfont)
- `src/styles/globals.css`:shadcn 语义 CSS 变量全部重定向到 CareerOS token(primary=green-600 #0c8a5f、background=canvas #faf9f7、radius=8px 等)
- `src/lib/design/tokens.ts` + `src/app/dev/tokens/page.tsx`:token 展示页,production 构建时 `notFound()` 不进生产路由
- 验证:grep 确认业务代码无硬编码色值(仅 globals.css/tailwind.config 内定义)

### 任务 1.3 数据库 Schema 与迁移(2026-08-18,commit 5a809ee)

- winget 安装 PostgreSQL 16(EDB 安装器,需 `TEMP=C:\pgtmp` 规避中文用户名路径 bug);建库 `careeros` + 专用账号 `careeros`
- `prisma/schema.prisma`:User / CareerProfile(JSON 画像 + version/parentVersion 版本字段)/ CareerPath / Roadmap / Stage / Task / Resume / ResumeVersion / Optimization / AgentRun 共 10 张表;删 User 级联策略明确;迁移 `20260819073838_init`
- `prisma/seed.ts`:写入读回全部核心表;`src/lib/db/prisma.ts` PrismaClient 单例
- 验证:迁移执行成功、seed 跑通、DB 集成测试(CRUD + 级联 + 数据隔离)通过

### 任务 1.5 LLM 适配器 + Mock(2026-08-18,commit ec5d63f)

- `src/lib/llm/adapter.ts` 统一接口(complete / stream);4 个适配器:DeepSeek(默认,OpenAI 兼容)/ OpenAI / Anthropic / Mock(固定结构化内容 + 可配置延迟,零费用)
- `src/lib/llm/index.ts`:按 `LLM_PROVIDER` 环境变量工厂切换;`.env` 默认 `LLM_PROVIDER=mock`
- **按用户决策(2026-08-18)**:跳过 DeepSeek 真实连通测试,留作遗留验证项(见下)
- 验证:4 适配器同输入同结构测试通过、Mock 零 API 消耗

### 任务 1.4 邮箱注册登录(2026-08-18,commit cc7c14d)

- NextAuth v5(beta.32 精确锁定)+ Credentials + bcryptjs;密码只存 bcrypt 哈希(f|60|password)
- `src/lib/auth.config.ts`(edge 安全)+ `src/lib/auth.ts`;`trustHost: true`(生产构建必需,否则 UntrustedHost 500)
- `src/middleware.ts`(src/ 布局下根目录 middleware.ts 会被静默忽略):保护 /dashboard /profile /navigator /resume /settings,未登录 307 重定向带 callbackUrl
- tRPC v11 基建:context / appRouter(publicProcedure + protectedProcedure)/ createCaller / `/api/trpc/[trpc]` 端点 / React Query v5 provider
- user.register / user.me;登录/注册页(四态表单、错误通用提示「邮箱或密码错误」)
- 验证:register→登录→登出全流程 e2e 走通;接口测试(重复邮箱 CONFLICT、未登录 UNAUTHORIZED、密码哈希断言)+ 中间件重定向测试 + 组件测试

### 任务 1.6 Agent 基座(2026-08-18,commit 5c20efd)

- `src/lib/agents/`:BaseAgent 抽象基类(config=名称/描述/Prompt 路径/Zod 输入输出/模型/温度)+ AgentRegistry(registerIntent / findByIntent)+ 测试夹具 Agent
- 流式设计:executeStream 产出 5 个生命周期确定性进度事件(「正在理解你的背景与目标…」等中文文案)+ 最终一次性 JSON 结果(经 Zod 校验),非 LLM 逐字流
- `src/lib/orchestration/`:Orchestrator(意图路由、AgentRun 日志 running→succeeded/failed、非法输出→友好错误不崩溃)+ GlobalContext(version/sourceAgent/generatedAt)+ stream 处理器
- `src/lib/prompts/sample-analyst.md`:Prompt 以 Markdown 解耦(loadPrompt fs 读取 + 模块缓存);真实三 Agent Prompt 属 2.3/3.3/4.3
- 验证:执行过 schema、进度多条增量到达、Mock 非法结构→友好错误+AgentRun failed 记录、succeeded 记录落库

### 任务 1.7 应用布局骨架(2026-08-18,commit 7c92c47)

- `src/app/(dashboard)/layout.tsx`:64px 顶栏 + 1160px 容器(DesignRules 无侧栏)
- `src/components/shared/topbar.tsx`:logo + 工作台/职业画像/成长路线/简历优化 4 入口(当前项高亮 aria-current)+ 头像下拉(个人设置/退出登录);<768px 折叠为 Sheet 抽屉
- `src/components/shared/page-header.tsx` / `user-avatar.tsx`(首字母 + 名字哈希自动配色)/ `module-placeholder.tsx`
- 占位页:/dashboard 工作台 + /profile /navigator /resume /settings(M2–M5 填充);根首页占位保留给任务 5.2
- 验证:4 路由 200、组件测试(高亮/下拉/抽屉/头像)、grep 零渐变、焦点环可达、响应式人工走查

### 任务 1.8 个人设置页(2026-08-19,commit a2ebd41)

- `src/app/(dashboard)/settings/page.tsx` 真实页面:基本资料(昵称 1–30 字符 + 头像配色 5 色预设)/ 修改密码 / 简历文件管理空态
- tRPC:user.updateProfile(昵称/avatarColor hex 校验)、user.changePassword(旧密码 bcrypt.compare 校验)
- 头像 = 首字母 + 预设配色,存 `User.avatarColor` 单列,零文件存储;上传留待 4.1 存储抽象
- 顶栏同步:user.me 经 React Query,invalidate 后昵称/配色即时同步
- 验证:昵称改后顶栏同步、改密后旧失效新可用(接口测试断言 bcrypt.compare)、简历文件区块空态不报错、DesignRules 自检走查通过

## 已解决的问题

- EDB 安装器中文用户名路径 bug → `TEMP=C:\pgtmp` 后安装成功
- NextAuth v5 生产构建 UntrustedHost 500 → `trustHost: true`
- src/ 布局下根目录 middleware.ts 被 Next 14 静默忽略(/dashboard 404)→ 移到 `src/middleware.ts`,build 出现 Middleware 产物后正常
- Prisma 7 默认引擎变更与 schema 写法不兼容 → 锁定 Prisma 6(classic `url = env("DATABASE_URL")`)
- Vitest globals 未启用导致 RTL auto-cleanup 不触发(10 个测试失败)→ setup.ts 显式 `afterEach(cleanup)`
- Windows 下 TaskStop 只杀 npm 包装进程,node 子进程占用 :3000 → netstat + taskkill //PID
- tRPC v11 HTTP body 为裸输入 JSON(非 v10 的 `{json:...}` 信封)
- TS2802(es5 目标下 MapIterator 迭代)→ Array.from;TS18046(泛型推断)→ 测试中显式 cast
- psql 需 PGPASSWORD;camelCase 列(passwordHash)需加引号;authMethod 映射为 auth_method

## 未解决的问题(遗留)

1. **DeepSeek 真实连通验证待做**(用户决策跳过):4 适配器结构已测试,Mock 开发默认;待用户提供 Key 后改 `.env` 做一次最小真实请求
2. `npm audit` 8 个 high:来自 Next 14 / ESLint 8 / Prisma 传递依赖,是锁定版本的自然结果;**勿 `audit fix --force`**(会破坏锁定的 Next 14);随版本升级逐步消解
3. Windows CRLF 告警:git 层面噪声,无功能影响,忽略
4. Prompt 文件经 `fs` 从 `process.cwd()` 读取:本地开发无碍;若部署 Vercel Serverless 需调整为打包资源或 DB 存储(4.1 部署前评估)
5. Git Bash 终端 curl 发中文会 mojibake(终端 GBK 编码):浏览器端 e2e 不受影响,非产品缺陷
6. `backend/` `frontend/` 空目录保留不动(用户已确认);pgAdmin 未随安装器安装

## 下一步 Implementation Step

**用户整体产品验收**(M1 验收清单见 implementation-plan 阶段 1 / 计划文档第六节):

- token 页与 DesignSystem 对应、无硬编码色值 ✅
- 10 表迁移 + seed + 级联 ✅
- 注册→登录→登出全流程、受保护路由重定向、密码只存哈希 ✅
- 4 适配器同结构、Mock 零费用(DeepSeek 真实连通待验,遗留 #1)
- Agent 基座:过 schema / 增量进度 / 非法输出不崩溃留日志 / AgentRun 入库 ✅
- 应用外壳:4 路由 + 顶栏高亮/下拉/移动折叠 ✅
- 设置页:昵称/头像/密码修改生效、简历文件空态 ✅

验收通过后进入 M2(任务 2.1 起);**当前不开始 M2、不开始阶段 2**。
