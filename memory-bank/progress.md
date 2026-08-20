# 项目进度

## 当前项目状态

- **阶段**:Phase 1(MVP 核心闭环),里程碑 M1(项目地基)+ **M2(Career Profile,任务 2.1–2.7)全部完成**
- **最近更新**:2026-08-20,职业画像结果页 Desktop 布局优化(核心结论带 / 2 列网格 / 卡片层级)
- **已完成任务**:1.1 – 1.8、2.1 – 2.7 全部完成,另按验收反馈补齐「经历时长」、修复「提交卡 60%」并完成结果页 Desktop 布局优化(M1 已通过用户验收;M2 待用户整体验收)
- **当前状态**:**M2 已实现,等待用户整体产品验收**。不开始 M3,不开始阶段 3。
- **测试基线**:178 个测试 / 28 个文件全部通过;typecheck / lint / build 零错误

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

### 任务 2.1 画像数据与 API(2026-08-20,commit `1b9f8b3`)

- schema 两处阶段 1 微调(均有明确阶段 2 依赖,计划批准时已说明):`CareerPath.matchScore` Float 0~1 → **Int 0-100**(与 PRD/DesignRules 百分比口径同单位,迁移时零数据);`AgentRun` 新增 `progress Json?` 列(1.6 五阶段文案落库,2.4 轮询与刷新恢复依赖);迁移 `20260820024904_profile_progress_matchscore`
- `src/lib/profile/schemas.ts`:ProfileData / education / skill / experience / careerPath 输入 Schema(唯一的服务端输入校验源)
- tRPC `profile` 命名空间:get(最新版含 careerPaths 按匹配度降序)/ listVersions / getVersion / create(首版)/ update(更新最新数据列)/ delete(级联删除)+ careerPath.{list,create,delete};全部 protectedProcedure + `requireOwnedProfile` 归属校验(越权一律 NOT_FOUND「画像不存在」,不泄露存在性)
- **读取边界防御**:`parseProfileData` 对 5 个 Json 列 zod safeParse,损坏/缺失回退空数组(不直接信任 DB 原始 JSON);`serializeProfile` 统一对外形状
- 验证:13 个真实 DB 测试(CRUD/越权 userA→userB/未登录/CONFLICT/匹配度越界 BAD_REQUEST/版本倒序/级联删除)

### 任务 2.2 分步采集表单(2026-08-20,commit `47a08f7`)

- shadcn 补装 select/textarea/checkbox/dialog/skeleton(sonner 于 2.6 安装)
- `stepper.tsx` 四步(标题 + 一句「为什么需要」,aria-current);`skill-selector.tsx`(30 项预设 chips + 自由输入 + ●○○/●●○/●●● 三级熟练度,上限 20);`profile-form.tsx`(必填仅学历+专业+技能,经历/目标可跳过,失焦校验,固定底部操作栏)
- **草稿**:localStorage `careeros:profile-draft:{userId}` 随输入持久化、提交成功清除、优先级高于服务端数据(刷新不丢)
- 验证:10 个组件测试(步进/必填拦截/跳过载荷/草稿保存恢复/initialData 预填/返回保留/失败提示)

### 任务 2.3 Profile Agent(2026-08-20,commit `5c64419`)

- `src/lib/agents/profile.agent.ts`:ProfileAgent(config=career-profile-analyzer,promptPath=profile-analyst.md);输入 Schema = ProfileData + feedback?;输出 Schema 严格按 agent-design 2.1(summary 1-200 字 / abilityTags 3-10 分级 / strengths 3-5 / directions 2-4 含 matchScore 0-100+理由+优劣势 / 六维雷达 0-100 / suggestions 1-5 / confidence 高-中-低+说明)
- `src/lib/prompts/profile-analyst.md`:角色锚定 / 五步推理 / 边界限制(不编造能力、不做确定性判断、不替用户决策、不给无依据评分)/ 不确定性表达(信息完整度→置信度)/ 纠偏反馈段 / JSON 结构与数量约束
- `src/lib/agents/index.ts` 集中注册 + `registerIntent("analyze-profile")`
- **固定样例集**(真实 LLM 质量验证待 DeepSeek Key,遗留 #1):3 份手工标注输入(cs-grad 高置信 / liberal-to-ops 中 / minimal 低)+ 手工构造 Mock 输出;10 个测试(样例循环/schema 边界/非法 JSON→AgentOutputError/matchScore 150→输出错误/空 skills→输入错误/进度事件顺序/反馈透传/注册表路由)

### 任务 2.4 分析管线与过程页(2026-08-20,commit `63b1c06`)

- `src/lib/profile/pipeline.ts`:`analyzeProfile({userId, data, feedback?})` → Orchestrator(analyze-profile)→ 成功创建**新版本行**(version=max+1,parentVersion=上一版本 version,不可变快照)+ careerPaths 全量重建;失败返回友好错误 + AgentRun failed,**不创建新行**;不抛业务异常
- 进度落库:`Orchestrator.run` 新增 `onRunProgress` 回调;pipeline 串行化写 `AgentRun.progress`(读-改-写排队,防事件连发覆盖丢失);返回前等待全部落库
- tRPC:`profile.analyze`(等待执行完成返回新版本)/ `profile.retry`(失败重试:服务端从 AgentRun.input 重放,刷新后无需客户端回传)/ `profile.getRun`(按 runId,越权 NOT_FOUND)/ `profile.latestRun`(最近一次 analyze-profile);**stale 判据**:running 且 updatedAt > 2 分钟 → 视为中断,序列化为 failed「分析中断,请重试」
- `analysis-view.tsx`(Agent 卡 48px 圆形图标 + 状态 badge + 4px 进度条 + 文案轮播,纯展示)+ `ai-badge.tsx`(AI 紫 pill);`profile-hub.tsx` 状态机(表单/分析中/失败/结果),轮询 latestRun 700ms,失败态「重试/修改信息」,刷新按最近 run 恢复
- 验证:3 个管线真实 DB 测试(成功落版本+方向+AgentRun succeeded 含 5 事件/纠偏重算 version=2 旧版不可变/非法输出 failed 不落行)+ 5 个 router 护栏测试 + 5 个 AnalysisView + 7 个 hub 状态机测试

### 任务 2.5 画像结果页(2026-08-20,commit `ee7c2a6`)

- 安装 recharts 2.x(React 18 兼容)
- **Schema 客户端安全化**:`analysis-schemas.ts` 从 profile.agent.ts 抽出输出 Schema(agent 模块经 base.ts 引入 node:fs 不能进客户端包);结果页渲染前对 aiAnalysis zod 校验,非法 → 「分析数据异常,请重新分析画像」
- `profile-result.tsx`:概要卡(AiBadge + 摘要 + 能力标签分级色 + 置信度 badge)→ 优势/不足双列(优势 ✓ 绿可展开 ai-insight;不足 ✗ 红来自方向 weaknesses 并标注来源方向,2.3 Schema 无顶层不足字段)→ 六维雷达(Recharts chart.green 20% 填充 + HTML 图例文本替代)→ 推荐方向卡 2-4 张(text-num 32px 匹配度 + 理由 + 优劣势)→ 发展建议;版本选择器(>1 版本,listVersions + getVersion 查看旧版本);页面头:更新信息(2.7)/优化简历→/resume/这不是我(2.6)/规划成长路线→/navigator
- 验证:11 个组件测试(渲染/展开/不足来源/雷达图例/方向卡/建议/版本切换/数据异常守卫/动作按钮);grep 无硬编码色值无渐变;setup.ts 补 ResizeObserver polyfill(recharts ResponsiveContainer jsdom 必需)

### 任务 2.6 纠偏流程(2026-08-20,commit `6f38c8d`)

- `correction-dialog.tsx`(shadcn dialog):方向/能力/优势三组 checkbox + 补充说明(≤500 字)→ 提交 → 关闭弹窗 → Toast「已记录,AI 将重新分析」(sonner 全局 Toaster 挂 root layout)→ `analyze(feedback)` 全量重算 → 新版本(implementation-plan 2.6「不采用增量重算」优先于 DesignRules Toast-only)
- hub 纠偏状态机:重算期间展示分析过程视图(优先级高于旧结果);重算失败 → 失败视图重试**携带反馈**(会话内 lastInput 重放);刷新后 retry 从 AgentRun.input 重放(含 feedback)
- 验证:5 个弹窗组件测试(必选拦截/载荷 note 去空格/空 note undefined/失败不关闭/取消)+ 2 个 hub 纠偏流程测试(Toast+带反馈重算+进度视图/失败重试携带反馈);管线纠偏版本测试已在 2.4 覆盖

### 任务 2.7 画像主动更新 + Dashboard 提示(2026-08-20,commit `6d7b8e1`)

- 结果页「更新信息」ghost → 表单预填最新版本数据(标题「更新画像信息」)→ 提交走同一分析管线 → 新版本
- `src/components/dashboard/profile-hint.tsx`(PRD 5.2):问候行「你好,{name}」+ 画像更新状态(「画像 v2 · 已更新于 X」;无画像 → 去创建引导);最新画像 createdAt **> 7 天** → 「建议更新画像」提示(计划决策 5,常量可调);`dashboard/page.tsx` 最小接入(完整工作台属 5.1,未扩功能)
- 验证:4 个 hint 三态测试(无画像/新鲜 6 天/过期 8 天/加载)+ hub 更新流程测试(预填→修改→提交载荷断言→invalidate);版本递增语义由 2.4 管线测试覆盖

### 任务 2.2 补遗:经历时长(2026-08-20,commit `3de300c`)

- 用户验收发现:PRD 3.1.3 实习/工作经历要求「公司、岗位、时长、主要职责」,2.2 实现漏了「时长」→ 按 PRD 补齐,范围外不改
- `experienceEntrySchema` 增加 startDate/endDate(YYYY-MM 月份精度,endDate=null 表示「至今」)与 duration;`computeExperienceDuration` 系统自动计算「X年Y个月」,至今时按当前月份计算并标注「 · 至今」;用户不手动填写时长
- 表单经历卡:开始/结束月份 Input +「至今」checkbox(勾选后结束时间禁用)+ 实时「时长:X」展示;逐条校验(请选择开始时间/请选择结束时间或勾选「至今」/结束时间不能早于开始时间)
- 时长随经历数据落库(JSON 列,无迁移,旧数据兼容)并经管线进入 Agent 输入;profile-analyst.md 提示 AI 用时长度量经验深度与稳定性、不得据此编造细节
- 仅实习/工作经历含时长;项目经历按 PRD 保持名称/角色/成果
- 验证:表单测试 19 项(含时长计算 5 项、至今、校验顺序、项目不受影响);全套 176 测试/28 文件、typecheck/lint/build 全绿

### 任务 2.5 补遗:结果页 Desktop 布局优化(2026-08-20,commit `1f6961f`)

- 验收反馈:640px 窄列嵌 1160px 容器,左右留白大、页面纵向过长、6 处重复「AI 分析」badge、视觉层级单一
- 根容器放宽至容器全宽;Hero 动作区(左 AiBadge + 版本信息,右版本选择器 + 动作按钮,主行动位于页面头右侧)
- 新增核心结论带 `profile-glance.tsx`(综合评价=置信度 badge / 核心优势 / 主要短板 / 最推荐方向)——**仅聚合已有数据,aiAnalysis 无全局综合分,不伪造评分**
- 概要卡内部 2 列(摘要+置信度 | 能力标签);优势/不足改 sunken 轻量面板(保留展开交互与来源标注);六维雷达左图右分值条(同源数据,图例即分值条);推荐方向 lg 2 列 Grid;发展建议步骤时间线;底部「下一步」轻量行动区(仅复用 /resume、/navigator 已实现入口,不新增功能)
- AI 标识收敛:6 处 → Hero + 概要卡 2 处;页面描述文案更新;Toast 位置 top-center → bottom-right(验收清单 P2-2 修复)
- 表单/过程页保持 640px 聚焦布局(DesignRules 规格);业务逻辑 / AI 分析 / 数据结构零改动
- 验证:结果页测试 11 → 13;全套 178 测试/28 文件、typecheck/lint/build 全绿;grep 零硬编码色值零渐变

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
- 提交成功后卡在分析过程视图(典型 60%)、刷新才出结果(用户验收实测)→ 根因:analyze mutation 等服务端跑完全管线才返回,invalidate 后 hasResult=true 使 latestRun 轮询查询禁用,缓存里残留的 running 状态把视图钉在过程页;修复:`recovering` 判定增加 `!hasResult` 前置(commit 5468f81),并新增回归测试(已有结果 + 缓存 running → 渲染结果视图)

## 未解决的问题(遗留)

1. **DeepSeek 真实连通验证待做**(用户决策跳过):4 适配器结构已测试,Mock 开发默认;待用户提供 Key 后改 `.env` 做一次最小真实请求
2. `npm audit` 8 个 high:来自 Next 14 / ESLint 8 / Prisma 传递依赖,是锁定版本的自然结果;**勿 `audit fix --force`**(会破坏锁定的 Next 14);随版本升级逐步消解
3. Windows CRLF 告警:git 层面噪声,无功能影响,忽略
4. Prompt 文件经 `fs` 从 `process.cwd()` 读取:本地开发无碍;若部署 Vercel Serverless 需调整为打包资源或 DB 存储(4.1 部署前评估)
5. Git Bash 终端 curl 发中文会 mojibake(终端 GBK 编码):浏览器端 e2e 不受影响,非产品缺陷
6. `backend/` `frontend/` 空目录保留不动(用户已确认);pgAdmin 未随安装器安装
7. **服务端进程被杀会致 run 卡 running**:查询层将 `running 且 updatedAt > 2 分钟` 序列化为 failed「分析中断,请重试」,用户可重试恢复;跨实例持久化进度依赖 DB 轮询(production 可用),非缺陷
8. **Recharts 在 jsdom 无尺寸**:组件测试改用 HTML 图例文本断言(已 polyfill ResizeObserver);雷达图真实渲染与响应式需浏览器人工走查
9. **真实 DeepSeek 分析质量未验证**:样例集与 Mock 输出已固化,管线正确性已测;待用户提供 Key 后改 `.env` 做真实请求(与遗留 #1 同源)

## 下一步 Implementation Step

**用户对阶段 2(M2)的整体产品验收**(验收标准见 implementation-plan M2 节 / 计划文档第六节):

- 四步表单 → AI 分析(进度可视)→ 画像结果(概要/优势不足/六维雷达/2-4 方向含匹配度/发展建议)全流程可走通;首次到画像概要 < 5 分钟
- 「这不是我」纠偏 → 全量重算 → 新版本,旧版本可查看;「更新信息」同样生成新版本且版本号递增
- Dashboard 问候行按决策 5 显示更新状态与提示
- 未登录/越权访问画像数据被拒绝;所有数据视图四态齐全;DesignRules 自检清单通过;无硬编码色值/零渐变/无聊天式界面
- 现有 91 测试不回归,新增测试全绿(基线 178/28 文件)
- 浏览器人工走查项:雷达图真实渲染、四步表单移动端、纠偏新旧版本切换(工程测试非验收门槛)

**验收通过后进入 M3(任务 3.1 起);当前不开始 M3、不开始阶段 3。**
