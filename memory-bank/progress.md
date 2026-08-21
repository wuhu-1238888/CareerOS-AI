# 项目进度

## 当前项目状态

- **阶段**:Phase 1(MVP 核心闭环),里程碑 M1(项目地基)+ M2(Career Profile)+ M3(Career Navigator)+ **M4(Resume Intelligence,任务 4.1–4.7)全部完成**
- **最近更新**:2026-08-21,阶段 4 任务 4.7(一键复制最终文本 + PDF 导出)完成并推送(commit `f96806b`)
- **已完成任务**:1.1 – 1.8、2.1 – 2.7、3.1 – 3.5、4.1 – 4.7 全部完成(M1 已通过用户验收;M2、M3、M4 待用户整体验收)
- **当前状态**:**Stage 4 已实现,等待人工验收**。不开始阶段 5。
- **测试基线**:426 个测试 / 52 个文件全部通过(连续两次全套);typecheck / lint / build 零错误;dev server 下 6 个页面登录态 200、未登录 307 中间件保护正常

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

### 任务 3.1 路线图数据与 API(2026-08-20,commit `ef29591`)

- schema 三处最小调整(计划批准的阶段 3 必要变更,迁移 `20260820141231_roadmap_owner_summary` 含 SQL 回填):`Roadmap.userId` 必填直连 User(级联删 + 索引,无画像路线图的所有权链路)/ `profileId` 改可空(3.2 手动输入路径的硬前提)/ 新增 `summary Json?`(AI 概要:总时长/阶段数/最终目标);seed 与 DB 集成测试同步补 userId
- tRPC `navigator` 命名空间:`roadmap.get`(最新路线图嵌套 stages/tasks 按 order 升序)/ `roadmap.create`(空路线图,3.1 验证用)/ `stage.create` / `task.create`(order 缺省 max+1)/ `task.updateStatus`(三态 zod 校验);`requireOwnedRoadmap`/`requireOwnedTask` 归属校验,越权一律 NOT_FOUND(不泄露存在性)
- 验证:10 个真实 DB 测试(创建→追加阶段→追加任务→更新状态→嵌套读取→越权 userA→userB→未登录→CONFLICT→隔离)+ typecheck/lint + seed 跑通

### 任务 3.2 目标方向选择页(2026-08-20,commit `f10b63d`)

- `direction-form.tsx`:目标方向(画像推荐卡 2-4 张含匹配度 + 自定义输入始终可用)→ 每周可投入时间(1–80 整数校验)→ 当前阶段自评三选一 chips;固定底部栏主按钮「生成成长路线」(640px 单列,同画像表单规格)
- 方向双状态模型:自定义输入优先、其次选中推荐卡(互斥切换,选中态 ✓ + aria 双通道);错误文案「请选择或输入目标方向 / 目标方向最多 30 字 / 请输入 1–80 之间的整数 / 请选择当前阶段」
- 验证:10 个组件测试(推荐卡渲染/选中互斥/自定义切换/周时边界与非法值/阶段 chips/提交载荷/服务端错误)

### 任务 3.3 Navigator Agent(2026-08-20,commit `ae74713`)

- 双 Agent 共用同一 Prompt `navigator/navigator.md`(mode 字段区分,防两文件阶段结构漂移):`NavigatorAgent`(全量,intent `generate-roadmap`,输出 roadmapAnalysisSchema:概要 + 3-4 阶段)与 `NavigatorStageAgent`(单阶段重生成,intent `regenerate-stage`,输入附 stageName/stageContent/feedback,输出 roadmapStageSchema)
- Prompt:职业规划师角色锚定 + 5 步推理(目标拆解→针对化调整→内容填充→项目设计→时间校准)+ 边界(不保证就业/不推荐付费课程/不替用户决策/不评估用户/不编造能力)+ 输出 JSON 结构与数量约束
- 阶段 Schema:名称 1-30/目标 1-200/学习内容 3-5/实践项目 1-2 **含产出物**/资源 ≤8/检查点 ≤5/预估时长;`superRefine` 保证 summary.stageCount === stages.length
- 验证:5 份固定样例(3 全量 + 2 单阶段)+ 14 个测试(样例循环/结构一致/周时变化→时长变化/单阶段只返回该阶段/非法输出/进度事件/注册路由);全套 212/212

### 任务 3.4 路线图时间线页(2026-08-20,commit `8491dac`)

- `pipeline.ts` 生成管线(镜像画像管线):progressChain 串行化进度落库 + `generateRoadmap` 替换式落库(`$transaction` 内 deleteMany 旧路线图 + 嵌套 create 阶段/任务,失败整体回滚);`parseStageContent`/`parseRoadmapSummary` 防御解析(损坏/缺失 → null,不直接信任 DB Json);任务派生 = 学习内容(type 学习)在前 + 实践项目(type 实践项目,description=标题)在后,产出物留 content Json
- tRPC:`roadmap.generate`(BAD_GATEWAY)/ `roadmap.retry`(从 AgentRun.input 重放,刷新恢复)/ `roadmap.latestRun`(intent 隔离,与画像不串台);`serializeRoadmap` 防御解析
- `roadmap-timeline.tsx`(按 DesignSystem「Career Roadmap」):sticky 概要条(「成为「方向」的 N 路径」+ finalGoal 副行 + 总进度 + 重新生成)+ 纵向时间线(节点三态 done 绿实心✓/current 白底 green-400 环/future 灰环;连线完成段绿/未完成段灰)+ 阶段卡默认折叠(标题 + 时长 badge + 任务进度 badge),展开显示目标/学习内容 Tag/实践项目含产出物/检查点(静态 ☐)/任务列表(符号+文字双通道)
- `navigator-hub.tsx` 镜像 profile-hub 状态机:表单 → 生成中(复用 AnalysisView 参数化,职业规划师/Compass/专属文案)→ 时间线;失败重试双通道(会话内 lastInput / retry runId)+ 修改信息回表单;刷新恢复(latestRun 轮询 700ms + finishedRef 防重入);「重新生成」→ 预填表单
- `analysis-view.tsx` 仅新增带默认值的可选 props(agentName/icon/runningDescription/failedDescription),既有行为零变化
- 验证:pipeline 真实 DB 测试(成功落库/无画像/二次生成替换/失败不落行/防御解析/护栏)+ timeline 8 测试 + hub 10 测试;AnalysisView 既有 5 测试零退化;全套 239/239 + typecheck/lint/build

### 任务 3.5 任务状态标记与反馈(2026-08-20,commit `a8da5fb`)

- 任务三态切换:点击状态符号按 待开始 → 进行中 → 已完成 → 待开始 循环(可撤销),`task.updateStatus` 服务端持久化(刷新保留),mutation 在途该任务禁用(pendingTaskId)
- 任务反馈:「太难了/已经会了」ghost 小按钮 → `regenerateStage` 管线(NavigatorStageAgent,intent `regenerate-stage`)→ 该阶段**原地更新**(名称/目标/时长/content + 任务全量替换,任务状态重置 pending——重生成的固有语义),其余阶段不动;调整中阶段显示 ai-badge「调整中」+ 反馈按钮禁用,成功 toast + 刷新,失败 toast 恢复可点
- 护栏:越权 NOT_FOUND、阶段不属于该路线图 NOT_FOUND、非法反馈 BAD_REQUEST、3.1 空路线图(无周时/阶段自评)→ BAD_REQUEST「路线图信息不完整,请重新生成后再试」(管线前抛出,不产生 run)
- 验证:管线测试(仅目标阶段变化/任务 7 条全替换全 pending/其余阶段不动/失败不落行/护栏)+ timeline pendingTaskId 禁用 + hub 接线 3 测试(切换载荷/反馈载荷+成功 toast/失败 toast 不刷新);全套 246/246 + typecheck/lint/build;dev server 登录态 5 页面 200、未登录 307 中间件保护正常

### 成长路线 UI/UX 优化(2026-08-21)

纯 UI/UX/Layout 优化:**业务逻辑 / 数据逻辑 / 任务逻辑 / AI 生成逻辑零改动**(仅 RoadmapTimeline 视图层重排 + hub 骨架宽度 1 行 + 页面描述文案 1 行)。顶部概览 = 单条 sticky 概览带(经用户确认)。阶段折叠初版为手风琴式(一次展开一个),用户试用后反馈改回**多阶段可同时展开**(展开新阶段不收起已展开阶段,点击已展开阶段才收起)。

- **页面宽度优化**:时间线(结果视图)从 640px 窄列放宽至容器全宽(1160px 容器 → 实际内容 1112px,与画像结果页先例一致);表单/生成过程保持 640px 聚焦布局(DesignSystem 表单规格);hub 骨架同步放宽防布局位移;PageHeader description 改为「从当前能力到目标岗位的个性化成长路径」
- **Timeline 优化**:纵向时间线完整保留(32px 节点轨道 + 2px 连线,节点三态/连线双色原样);`gap-3` → `gap-4`,阶段卡吃满剩余 ~1040px;当前阶段卡 `border-hairline-strong` 强调,已完成/未开始保持 `border-hairline`
- **阶段展开/折叠优化**:默认展开首个未完成阶段、其余折叠;点击各阶段头独立展开/收起,**多阶段可同时展开**(初版手风琴经用户试用反馈改回多开),展开/收起互不影响
- **信息层级优化**:概览带两区(目标岗位:路径文案 + finalGoal + 每周投入/当前自评 meta;整体进度:总进度 + 4px 进度条 + 当前阶段名 + 重新生成),sticky 吸顶;阶段卡头部增加「阶段 N」眉标 + 阶段名升 `text-h3`;卡内 Section 小标题统一 `text-caption font-semibold text-ink-secondary`;任务行去卡片化(去掉 bg-surface 底色 → `divide-y divide-hairline` 行式列表)+ 任务区顶部 4px 阶段进度条
- **Grid 优化**:阶段卡内 `lg:grid-cols-2`(左列 = 学习内容 + 能力检查点;右列 = 实践项目 + 推荐资源);阶段目标与任务列表全宽单列;不硬拆单列内容
- **响应式优化**:Desktop 全宽 2 列;lg 以下卡内回落单列;md 以下概览带堆叠;移动端时间线轨道保留、卡片占余宽;全流式宽度 + min-w-0/truncate 保证无横向滚动
- **测试结果**:新增 4 个用例(多阶段展开/概览带两区/全部完成不显示当前阶段/阶段序号与任务计数),全套 250/250(34 文件)+ typecheck/lint/build 零错误;grep 自检零硬编码色值零渐变;dev server 登录态 5 页面 200、未登录 307 中间件保护正常;临时检查用户与脚本已清理
- 说明:DesignRules 行 140 与 DesignSystem 行 507 的 ☑/○ 任务状态符号在文档间含义不一致(实现遵循 DesignSystem:☑=完成、○=待开始);本次未改文档,留待用户裁决

## 阶段 4(M4:Resume Intelligence)

### 任务 4.1 简历数据模型与文件上传 + 4.2 文本解析(2026-08-21,commit `607f288`)

- **Schema 迁移**(计划批准的列调整):Resume 加 `fileName/mimeType/sizeBytes/storageKey/extractError` + `originalText` 改可空 + `@@index([userId])`;Optimization 加 `order/status(pending|accepted|rejected)/updatedAt`;ResumeVersion 加 `atsReport Json?/atsScoredAt`(ATS stale 判定列);全部加列/改可空,现有数据无损
- **存储三层** `src/lib/file/`:BlobStorage 接口 + EncryptedStorage 装饰器(AES-256-GCM,信封 MAGIC 2B+IV 12B+TAG 16B+密文,IV 随机)+ LocalFSStorage(rootDir 注入,键防穿越,delete 幂等);factory 按 `FILE_STORAGE_PROVIDER` 返回;生产缺 `FILE_ENCRYPTION_KEY` → 首次使用抛错 fail closed,开发缺 key → SHA-256(NEXTAUTH_SECRET) 派生;`.env.example` 增量三行、`.gitignore` 加 `/storage/`
- **上传/下载**:`handleResumeUpload` 纯业务函数(扩展名 .pdf/.docx ≤10MB 校验、.doc 明确文案、建行失败补偿删文件);Route Handler `/api/resume/upload`(auth 自鉴权,413/400 分码)与 `/api/resume/download`(归属校验 + 解密流式 + `filename*=UTF-8''`)
- **文本提取** `parser.ts`:pdf-parse 子路径导入 + 3 次重试退避 / mammoth(.docx);图片型 PDF(无文本层)→ `no-text` 引导粘贴;next.config `serverComponentsExternalPackages: ["pdf-parse"]`;fixture 生成脚本(pdfkit+jszip,devDependencies)+ 中文 PDF/docx/图片型 PDF 三份 fixture 产物
- **tRPC `resume` 子 router**:get/list/createFromText(粘贴建行)/pasteText(提取失败后补文本清 extractError)/delete(级联 + 存储清理);`requireOwnedResume` 归属校验
- **组件**:`resume-upload.tsx`(640px 拖拽+粘贴+Banner,40px 主按钮,无画像提示);`resume-files.tsx` 设置页真实列表(下载/删除确认);resume/page 接入 ResumeUpload
- 验证:storage 13 / parser 7 / upload 9 / resume tRPC 8 / resume-upload 9 / resume-files 5 = 51 新增;全套 302/302 + typecheck/lint/build 全绿

### 任务 4.3 解析 Agent + 核对修正 UI(2026-08-21,commit `275f5d3`)

- **Prompt** `resume-parse.md`:简历解析师角色,只提取不评价不改写、description 逐字摘抄原文语句、禁虚构、时间格式「YYYY-MM」/「YYYY」/「至今」、JSON 结构与数量约束(教育≤10/技能≤30/经历≤15/项目≤15)
- **Schema** `analysis-schemas.ts`(客户端安全,仅 import zod):`parsedResumeSchema`(basicInfo + education/skills/experiences/projects 全带 `.default([])`)+ 预置 rewrite/ats schema(4.4/4.6 用)
- **Agent** `resume.agent.ts`:ResumeParseAgent(intent `parse-resume`,inputSchema 只收 resumeText ≤20000)+ ResumeRewriteAgent/ResumeAtsAgent 类(注册 4.4/4.6 追加);`agents/index.ts` 注册 parse agent
- **管线** `pipeline.ts`(镜像画像管线):progressChain 串行进度落库 + adapter 测试注入 + 成功才写 Resume.parsedData/失败不落行 + 送 LLM 文本截断 20000(DB 存全文);AgentRun.input 存 `{ resumeText, resumeId }` 供 retryParse 重放定位
- **tRPC**:`parse`(原文缺失 → BAD_REQUEST 友好文案)/ `retryParse`(run 不存在/非本人/垃圾 input/已删简历护栏)/ `saveParsedData`(核对结果保存)/ `latestRun({ intent: parse-resume|rewrite-resume|score-ats })` 参数化隔离;get 加 `parsedData`(防御解析回退 null)
- **前端状态机** `resume-hub.tsx`(镜像 profile-hub):无简历→ResumeUpload;提取失败行→粘贴降级;待解析卡(「开始解析」)→ 解析中 AnalysisView(简历解析师/FileText/专属文案,`editLabel="重新上传"`)→ 失败恢复(会话内重跑 parse / 刷新后 retryParse 重放)→ 核对视图;latestRun 轮询 700ms + finishedRef + 简历行切换重置会话痕迹
- **核对表单** `resume-review.tsx`(640px):基本信息/教育/技能(行或逗号拆分)/工作实习(类型切换)/项目 分区逐项编辑增删;「保存核对结果」(saveParsedData)+ 目标方向(画像 careerPaths chips 默认首选 + 自定义)+ 40px「开始优化」(4.4 起触发改写,当前保存+提示);careerPaths 深递归类型经 `as unknown as` 桥接(镜像 navigator-hub,TS2589)
- `analysis-view.tsx` 仅新增可选 `editLabel` prop(默认「修改信息」),画像/路线图既有行为零变化
- 验证:Agent 样例集 3 份手工标注(后端/前端应届/产品)+ 9 测试;管线真实 DB 9 测试(成功落库/失败不落/截断/防御解析/router 护栏/latestRun intent 隔离);review 8 + hub 10 组件测试;全套 338/338 + typecheck/lint 全绿

### 任务 4.4 改写 Agent(2026-08-21,commit `a82fb39`)

- **Prompt** `resume-rewrite.md`:简历优化师角色;硬约束优先级最高——①originalText 必须逐字摘抄原文连续片段(系统逐字校验,失败丢弃全部建议)②不改事实只重建叙事 ③无量化数据时禁止虚构数字(原文已有数字可复用,不得改变数值)④不夸大不杜撰不承诺就业;category 六类(基本信息/教育经历/技能/工作经历/实习经历/项目经历);3-8 条
- **final-text.ts**(纯函数无 node 依赖,前后端共用):`validateModifications`(逐字存在/空白归一化/区间互不重叠/按位置升序)与 `buildFinalResumeText`(原文中按 status=accepted 片段精确替换,pending/rejected 保持原文;空白归一化定位 + 重叠防御跳过;未命中回退原文)——对比视图/ATS/导出全链路共用,杜绝三份推导漂移
- **ResumeRewriteAgent**(intent `rewrite-resume`):输入 = 核对后 parsedData + 画像能力标签(router 侧 readAbilityTags)+ 目标方向;`agents/index.ts` 注册
- **rewriteResume 管线**:原文缺失兜底失败;Agent 输出 → validateModifications 失败整次不落行;事务内建不可变 ResumeVersion(targetDirection/changes 摘要)+ Optimization 批量(order 按原文位置升序,status 默认 pending)——重新分析 = 新版本
- **tRPC `resume.rewrite`**:归属校验 → 原文缺失 BAD_REQUEST → rewriteResume → BAD_GATEWAY;返回 versionId/runId
- 验证:改写样例集 3 份(含「无量化数据不虚构数字」边界标注)+ Agent 9 测试;final-text 12 纯函数测试(全 pending/全 accepted/混合/乱序/空白归一化替换/未匹配回退/重叠防御);管线 5 新增测试(事务落库/二次改写新版本快照/校验失败不落行/原文缺失/router 护栏);全套 364/364 + typecheck/lint 全绿

### 任务 4.5 修改对比视图 + 状态持久化(2026-08-21,commit `45ccbf5`)

- **`resume-analysis-card.tsx`**(DesignSystem Resume Analysis Card 规格):修改前 sunken 底 + 左 3px hairline-strong 边(灰色引用块);修改后 green-50 底 + 左 3px green-600 边(绿边 = 建议采纳视觉语言),已拒绝态回灰(sunken + hairline-strong,恢复原文态);「为什么这样改」折叠 ai-insight(紫底 violet-50 + 左 3px violet-400 + AiBadge);状态徽章 待处理/已采纳/已拒绝;操作:待处理 → 接受(primary)/拒绝(ghost),已采纳/已拒绝 → 撤销(回 pending);AI 标记仅待处理态显示(DesignSystem L582 用户采纳后不再展示);全态零 danger 色/删除线
- **`resume-result.tsx`**(全宽,画像结果页先例):Hero 行(AiBadge + 目标方向 + 更新时间)+ 采纳计数 + 工具条(全部接受 secondary,全部已采纳时禁用 / 重新分析 ghost / 修改信息 ghost);对比卡列表;单条状态变更与全部接受均走 mutation + 失效 resume.get,失败 toast
- **tRPC**:`updateOptimization({ optimizationId, status: pending|accepted|rejected })`(归属链 optimization→resumeVersion→resume 校验,NOT_FOUND「修改建议不存在」)/ `acceptAll({ versionId })`(updateMany 整版 accepted,NOT_FOUND「优化版本不存在」);`get` 加 `version` 字段(最新 ResumeVersion + optimizations 按 order 升序,serializeVersion 防御序列化,Json 列保持原样读取方防御解析)
- **状态机接入** `resume-hub.tsx`:开始优化 = saveParsedData + rewrite 触发改写 AnalysisView(简历优化师/Sparkles/editLabel「返回核对」);latestRun(intent: rewrite-resume) 独立轮询;会话内失败重试 = lastOptimizeInput 重跑改写;刷新后失败 run 重试无会话输入 → 返回核对表单(无 retryRewrite 端点,计划已定);「重新分析」用已保存核对结果 + 当前版本 targetDirection 再跑改写生成新版本;`resume-review.tsx` 加 `initialDirection` prop(返回核对时回填当前版本方向)
- 验证:analysis-card 8 测试(三态/折叠 ai-insight/接受拒绝撤销回调/AI 标记时机/全态无红删除线与 danger 色);result 7 测试(渲染/全部接受成功失败/全部已采纳禁用/重新分析修改信息回调/单条接受/失败 toast);hub 新增 4 测试(开始优化→改写中/失败重试重跑/返回核对回填方向/结果视图/刷新恢复);管线 router 护栏 2 新增(updateOptimization 三态 + 越权、acceptAll + get.version 同步);全套 385/385 + typecheck/lint 全绿

### 任务 4.6 ATS 评分(2026-08-21,commit `42317bd`)

- **规则引擎** `ats-rules.ts`(纯 TS 确定性,不依赖 LLM):6 子分各 0-100——分节完整性(五节各 20 分)/ 量化密度(数字+单位行占比,30% 以上满分)/ 关键词覆盖(8 个方向词典 × 15 词,方向名与词典键做包含匹配——「后端开发工程师」命中「后端开发」词典;未命中回退 23 词通用词典)/ 动词开头(去项目符号后以 29 个动作动词开头的行占比)/ 长度篇幅(500-1200 字符满分带,带外线性衰减)/ 格式可解析性(可疑字符按 Unicode 代码点 ×5、3+ 连续空行 ×10、Tab ×5 扣分,下限 0);固定权重 sections/quantified/keywords 各 0.2 + actionVerbs 0.15 + length 0.1 + parseability 0.15
- **合成**:`final = round(0.6×规则分 + 0.4×LLM 分)`,LLM 两子分(contentQuality/relevance,1-5 整数)平均后 ×20 量化;等级 ≥80 优秀 / 60-79 良好 / <60 需改进。稳定性:规则侧纯函数方差 0;LLM 侧温度 0 + 5 分档(MockAdapter 两次评分分差恒 0,远低于「分差 ≤10」验收线)
- **ResumeAtsAgent**(intent `score-ats`,temperature 0):输入 = 最终采纳文本 + 目标方向;`atsLlmAnalysisSchema` 输出(llmSubscores 1-5 整数 + suggestions 2-5 条 title≤50/detail≤300);prompt `resume-ats.md` 只评内容质量与岗位相关度,硬指标由系统确定性计算不重复评
- **scoreAts 管线**:runner.run(intent score-ats)→ 规则分 + LLM 分项合成 → ResumeVersion 落库 atsScore/atsReport(含 ruleSubscores/llmSubscores/suggestions/level)/atsScoredAt;成功才落库,LLM 失败不覆盖旧评分
- **tRPC `resume.scoreAts`**:requireOwnedVersion(NOT_FOUND「优化版本不存在」)→ 原文缺失 BAD_REQUEST → 目标方向缺失 BAD_REQUEST「优化版本缺少目标方向,请重新分析」→ accepted 片段合成最终文本(buildFinalResumeText,单一事实源)→ 管线 → BAD_GATEWAY;返回 { versionId, total, level, runId }
- **`resume-ats-card.tsx`**(接 result 工具条之下):未评分空态 = sunken 说明块 + primary「生成 ATS 评分」(显式按钮触发,用户拍板决策);评分中卡内进度态(Loader2 + aria-live);报告态 = 12px 描边进度环(DesignSystem)+ typography.num 大数字 + 等级徽章(优秀 bg-green-100/text-green-700、良好 bg-warning-bg/text-warning、需改进 bg-danger-bg/text-danger)+ 规则/LLM 分项说明 + 建议列表;stale(建议 updatedAt > atsScoredAt)→ text-warning「修改后需重新评分」+ ghost「重新评分」;报告防御解析(zod safeParse 损坏回退空态)
- **stale 判定**:`atsScoredAt` 持久化列比较(评分后接受/拒绝/撤销任一建议 → 提示重评,刷新后仍准确;atsScoredAt 已在 4.1 迁移中建列)
- 验证:ats-rules 10 测试(同输入两次恒等/六子分边界/方向词典包含匹配与通用回退/权重合成/三档等级边界 80-60);ATS Agent 样例集 3 份手工标注(后端高分/前端中等/跨行低分)+ 9 测试(分档一致/建议数/输入透传/温度 0 传给适配器/非法 JSON/违反 Schema/5 事件/注册);管线 3 新增(合成落库 + 两次评分分差 0 + LLM 失败不覆盖旧评分)+ router 护栏 1(未登录/越权/无方向/原文缺失);ats-card 7 组件测试(空态触发/评分中/报告渲染/stale 重评/失败 toast/损坏报告回退);全套 417/417 + typecheck/lint 全绿
- 测试驱动修正 2 处实现:①关键词词典由精确匹配改为方向名包含匹配(否则「后端开发工程师」等真实方向永远落通用词典)②可疑符号按 Unicode 代码点计数(emoji 代理对原计 2,现计 1)
- 测试基建:`vitest.config.mts` 加 `testTimeout: 15000`——全套并行负载(真实 DB 用例 + 51 文件)下,阶段 2 既有 profile-hub 慢用例(userEvent 多步交互,单文件稳定通过)偶发逼近默认 5000ms 上限导致超时;仅放宽失败上限,不影响通过时长

### 任务 4.7 导出(复制 + PDF)(2026-08-21,commit `f96806b`)

- **最终文本单一事实源下沉服务端**:`serializeVersion` 加 `originalText` 参数,get 端点 select `originalText: true`,序列化时经 `buildFinalResumeText(originalText, accepted 片段)`(4.4 唯一实现)合成 `finalText` 返回——复制/PDF 导出共用,客户端不再重复推导
- **`resume-pdf-document.tsx`**(仅经动态 import 加载):`Font.register` Noto Sans SC(public/fonts 两个 .otf ~8MB×2,OFL 许可;react-pdf 默认字体无 CJK 字形);克制专业排版(姓名 22 bold / 联系信息 muted / 分节标题 11.5 bold + hairline 下边线 / 内容行 lineHeight 1.6),颜色全取设计 token(colors 导入),无渐变无装饰;`parseBlocks` 轻量分段(首行=姓名,空行前连续行=联系信息,空行分块、块首行=分节标题);A4 + `wrap={false}`
- **`resume-export.tsx`**:`@react-pdf/renderer` 与 PDF 文档组件仅经 useEffect 动态 import(react-pdf 引 window/canvas,SSR 路径 import 即崩;加载失败回退禁用占位);复制 = `navigator.clipboard.writeText`,失败回退 textarea + `document.execCommand("copy")`,再失败 error toast;`PDFDownloadLink` 函数子节点(loading「准备导出…」/ 就绪 `<a href>` 下载,fileName「简历-优化版.pdf」);**零采纳(或 finalText 空)禁用复制与 PDF + 「尚未采纳任何修改」提示**(4.7「空简历导出禁用」落为「零 accepted」语义,拒绝=恢复原文,零采纳导出与原文无差异)
- **接线** `resume-result.tsx`:ResultVersion 加 `finalText: string | null`;工具条在「全部接受」与「重新分析」之间插 `<ResumeExport finalText={version.finalText} canExport={acceptedCount > 0} />`
- 类型桥接:react-pdf 3.4.5 自身 d.ts 的 children 类型(ReactNode | ReactElement<BlobProviderParams>)不接纳函数子节点(其实现即函数子节点)→ `as unknown as ReactNode` 桥接(项目先例)
- 验证:resume-export 7 组件测试(clipboard 成功/execCommand 回退成功与失败/零采纳与空文本禁用+提示/PDF 加载与就绪两态/最终文本透传文档组件——mock 动态 import 的 react-pdf 与 PDF 文档、PDFDownloadLink 捕获 document prop);result 新增 2 测试(导出工具条 props 透传 + 零采纳 canExport=false);hub 版本 fixture 加 finalText + 导出 stub 断言;全套 426/426 ×2 + typecheck/lint 全绿
- 测试基建备忘:`userEvent.setup()` 会安装自己的剪贴板桩覆盖 navigator.clipboard → clipboard/execCommand 必须在 setup 之后 stub;sonner toast store 是模块级单例跨用例存活 → 同文案 toast 用例需 afterEach `toast.dismiss()`

### 任务 4.8 简历优化页面功能修复与布局优化(2026-08-21,commit `0fe2de1` + `0b59d80` + `4e66ca1`)

用户报告:①核心内容区过窄两侧留白过多 ②点「开始优化」后显示「分析未完成」+「改写结果与简历原文不一致」。先排查功能链路再改 UI(Plan Mode 批准)。

- **根因 = 改写 Agent 输入契约不一致**:rewriteResume 调 LLM 的 input 只含 parsedData/abilityTags/targetDirection,**不含 originalText**,而 prompt 硬约束要求「originalText 逐字摘抄原文」→ LLM 收不到原文只能从结构化数据重构引用 → 校验必失败。修复:runner input 改 `{ resumeId, originalText(截断 20000), parsedData, abilityTags, targetDirection }`;agent schema 加 `originalText: z.string().min(1).max(20000)`;buildMessages 把原文发给 LLM(resumeId 被 zod strip 剔除不进消息,与 parse 先例同构);prompt 输入描述同步,强调引用只来自提供的原文
- **校验合理修正(不删除不绕过,用户授权)**:`validateModifications` 从「任一条不逐字命中 → 整次失败」改为**逐条过滤**——每条空白归一化后在原文找最早且不与已接受区间重叠的命中(`findRawRange` 加 `fromRawStart` 参数,统一原始下标空间定位,顺带修复同短语多处出现时 indexOf 首次命中导致的误报重叠);空白引用/未命中/重叠 → 丢弃该条;≥1 条有效 → 成功落库有效子集;0 条 → 失败,文案不变。产品目标不变:展示的「修改前」必逐字来自原文
- **状态流转修复(B2)**:0 条有效时 `prisma.agentRun.update({status:"failed", error})` 再返回——此前校验失败 run 保持 succeeded 且 error 不写,刷新后失败视图静默消失
- **行归属护栏(B3)**:`serializeRun` 从 run.input 防御解析透出 `resumeId`/`targetDirection`;hub 派生 `parseRun`/`rewriteRun`(`!run.resumeId || run.resumeId === resume.data?.id`,旧 run 无 resumeId 视为当前行向后兼容),恢复/失败判断全部改读——此前 latestRun 只按 userId+intent 查,重新上传建新行后旧行失败 run 驱动新行失败视图,重试还把 parsedData 写回旧行形成死循环
- **方向回填(B4)**:initialDirection 兜底链 = `version?.targetDirection ?? lastOptimizeInput.current?.direction ?? rewriteRun?.targetDirection ?? undefined`(会话内 + 刷新后自定义方向均不丢)
- **防双击(B5)**:hub 新增 `optimizing` state(handleStartOptimize 全程 try/finally),传给 review;「开始优化」disabled = `optimizing || saveParsed.isPending`——此前按钮 disabled 绑定表单自身 saveParsed 实例,与 Hub 实际执行实例脱节,双击并发两次保存 + 两次 LLM 改写
- **布局(docs-first)**:DesignSystem.md:437/445 表单 640 规则修订为「宽表单页(简历上传/核对)全宽继承 1160 壳,按字段类型组织——短字段 2 列、长描述与技能文本全宽;多步采集表单保持 640」;upload/review/hub 骨架与就绪卡 wrapper `max-w-[640px]` → `w-full`;对比卡改 lg 断点「左旧右新」双列(PRD 3.3.7,小屏回退上下);p-5 → p-6 对齐卡片 token;**不新建 1200-1280 容器**——「统一」是硬要求,1160 是全站既有统一值;AnalysisView 保持 640(画像/路线图过程页同规格)
- 验证:新增 11 测试(final-text 3:同短语多处/部分过滤/空白差异;管线 4:成功 input 断言、全部无效 → run failed+error 端到端、部分过滤 = 3 条版本、latestRun 加 resumeId;改写 agent 3:原文透传 + 缺 originalText 边界;hub 5:解析/改写跨行护栏、刷新与会话方向回填、optimizing 防双击;review 1:optimizing 禁用);全套 **437/437(52 文件)** + typecheck/lint/build 零错误
- 已知取舍:校验部分无效仍建版本(≥1 条);retryParse 服务端仍按旧行重放(客户端护栏已断死循环,记为后续服务端加固项);「重新分析」失败且已有旧版本时刷新后显示旧结果(不新增 banner,旧结果仍可用)

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
- 阶段 3:`.superRefine()` 使 roadmapAnalysisSchema 变 ZodEffects 无 `.shape` → `parseRoadmapSummary` 崩溃;修复:summary 提取为独立 `roadmapSummarySchema` 导出,两处共用
- 阶段 3:tRPC 序列化 Prisma Json 列(careerPaths)后为深递归类型,`.map` 触发 TS2589 → `as unknown as SuggestedDirection[]` 桥接;DirectionFormInput.currentStage 收窄为 `(typeof STAGE_OPTIONS)[number]` 消除 TS2345;es5 目标下 `Array.entries()` 触发 TS2802 → 经典 for 循环
- 阶段 3:3.1 早期行的 content Json 缺 practiceProjects 字段被防御解析判 null → 读取侧 `stageContentSchema` 补 `.default([])`(旧行兼容),roadmap.test 断言同步到新序列化契约

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

**用户对阶段 3(M3)的整体产品验收**(验收标准见 implementation-plan M3 节 / 计划文档第八节):

- 方向选择(有画像 → 推荐卡含匹配度;无画像 → 手动输入)→ AI 生成进度可视 → 时间线主视图(概要条/节点三态/阶段卡折叠展开)全流程可走通
- 任务三态切换刷新保留(服务端持久化);「太难了/已经会了」→ 单阶段重生成仅该阶段变化,调整中提示与成功/失败 toast
- 全量重新生成 = 替换式(旧路线图删除);阶段全完成 → 节点变绿 + badge「已完成」
- 未登录/越权访问路线图被拒绝;所有数据视图四态齐全;DesignRules 职业路线页 4 禁令(无横向甘特图/一屏 ≤4 阶段/无完成庆祝弹窗/无课程商城引导)+ 无硬编码色值/零渐变
- 现有 178 测试不回归,新增测试全绿(基线 246/34 文件);typecheck/lint/build 零错误
- 浏览器人工走查项(工程测试非验收门槛):方向选择 → 生成进度 → 时间线展开折叠 → 任务三态切换刷新保留 → 反馈后阶段更新 → Desktop/Mobile 布局 → Console 无报错
- **成长路线 UI/UX 优化走查**:内容区扩大与左右留白、Timeline 清晰度、多阶段独立展开/收起、概览带吸顶与两区信息、任务行扫描性、Desktop/Tablet/Mobile 三档布局、无横向滚动、无 Console 报错

**验收通过后进入阶段 4(M4);当前不开始阶段 4。**

---

# Stage 4 完成(M4:Resume Intelligence,2026-08-21)

## 完成情况表

| 任务 | 内容 | 状态 | commit |
|---|---|---|---|
| 4.1 | 简历数据模型(originalText 可空 + 文件列 + 索引)与文件上传(存储抽象三层 + AES-256-GCM 加密 + 上传/下载端点 + 粘贴路径 + 设置页文件管理) | ✅ | `607f288`(含 4.2 起步) |
| 4.2 | 文本解析(pdf-parse + mammoth 同步提取、图片型 PDF → no-text 引导粘贴、失败 Banner 降级) | ✅ | `275f5d3` + `875e059` |
| 4.3 | 解析 Agent(ResumeParseAgent)+ 结构化核对修正 UI + 目标方向选择 | ✅ | `275f5d3` |
| 4.4 | 改写 Agent(ResumeRewriteAgent,逐字摘抄硬约束)+ final-text 单一事实源 + rewriteResume 管线(不可变版本快照) | ✅ | `a82fb39` |
| 4.5 | 修改对比视图(Resume Analysis Card 三态/折叠 ai-insight/接受拒绝撤销)+ 状态服务端持久化 | ✅ | `45ccbf5` |
| 4.6 | ATS 评分(规则 6 子分 60% + LLM 40% 合成、显式按钮触发、stale 重评提示) | ✅ | `42317bd` |
| 4.7 | 导出(一键复制最终文本 + 客户端 PDF 生成,Noto Sans SC 中文、零采纳禁用) | ✅ | `f96806b` |
| 4.8 | 简历优化页面修复与布局:改写 Agent 输入契约修复(原文入参)+ 校验逐条过滤 + 状态机修复(失败落库/行归属护栏/方向回填/防双击)+ 表单全宽 + 左旧右新对比卡 | ✅ | `0fe2de1` + `0b59d80` + `4e66ca1` |
| 4.9 | 简历改写状态卡死修复:完成判定改由轮询权威数据驱动 + LLM 3 分钟超时(可重试失败)+ stale 阈值 = 超时 + 1 分钟余量 | ✅ | `4834aa3` + `847f651` |
| 4.10 | 简历模块顺序保真:detectSections/buildSectionPlan 确定性检测 + Resume.sectionOrder 快照 + 表单按原文顺序渲染(自定义只读/工作实习分开)+ 结果页最终文本预览面板 | ✅ | `30de79b` + `70f8bb1` + `47d2eb7` |
| 4.10-fix | 提取层视觉排序:验收发现真实 .docx(文本框模板)与 z-order PDF 的 finalText 乱序 → 断点在提取层 → parser 按坐标重建阅读顺序(PDF items y/x 排序 + DOCX wp:anchor positionV/H 排序) | ✅ | (见本次提交) |

## 主要修改

- **Schema**:Resume 加 fileName/mimeType/sizeBytes/storageKey/extractError、originalText 可空、userId 索引;Optimization 加 order/status/updatedAt;ResumeVersion 加 atsReport/atsScoredAt
- **存储**:`src/lib/file/` 三层(storage 接口 / local-fs / encrypted AES-256-GCM,IV 随机信封格式,delete 幂等)
- **Agent 三个**:parse-resume / rewrite-resume / score-ats(温度 0),prompt 三份,样例集 9 份手工标注
- **管线**:parseResume / rewriteResume(validateModifications 逐条过滤——4.8 修订,0 条有效落 run failed+error 不落行;≥1 条落有效子集 + 事务快照)/ scoreAts(成功才落库),progressChain + adapter 注入镜像既有先例
- **tRPC**:resume 子 router 11 端点(get/list/upload 流程经 Route Handler/createFromText/pasteText/delete/parse/retryParse/saveParsedData/latestRun/rewrite/updateOptimization/acceptAll/scoreAts + 下载端点),全部归属链校验
- **前端**:resume-hub 五阶段状态机 / resume-upload / resume-review / resume-result / resume-analysis-card / resume-ats-card / resume-export + resume-pdf-document
- **最终文本单一事实源**:`buildFinalResumeText`(4.4)由对比视图/ATS/导出三处共用,永不漂移
- **模块顺序保真**(4.10):`detectSections` 行级标题检测(整行 + 同行冒号前缀,归一化精确匹配词典)/ `buildSectionPlan`(无标题模块按字段值锚定 + 条目归组)/ `Resume.sectionOrder` Json 快照(3 入库点)/ 表单按 plan 渲染 / 结果页最终文本预览面板(与复制同字符串)

## 修改文件

新增 32 个文件(组件 7 / 管线与工具 8 / prompt 3 / 测试 10 / 端点与类型 2 / 字体 2);修改 12 个既有文件(prisma schema + 迁移 / router.ts / agents index / next.config / package.json / .env.example / .gitignore / resume 页面 / 设置页 resume-files / analysis-view 可选 prop / vitest 超时 / progress.md)。阶段 1–3 既有文件仅最小追加式修改。

## 测试结果

- 全套 **490/490(55 文件)全绿**(4.10-fix 修订后);typecheck / lint 零错误
- 4.10 新增 27 个测试:section-order 22(标准顺序/归一化/同行标题/自定义切片/同形误判/无标题锚定/工作实习拆分/合并标题/多项目分区/stored 优先/兜底)+ 数据层 2(sectionOrder 入库 + sectionPlan 返回)+ review plan 模式 3 + result 预览面板 2
- 4.10-fix 新增 20 个测试:pdf-position-sort 7(PDF 内容流 z-order → 视觉坐标排序)+ docx-extract 8(文本框 XML 逆序 → 坐标排序 / DECOY 忽略 / 流式段定位 / 无框退化)+ parser 集成 3(乱序 PDF / 文本框 DOCX / 无框 DOCX 回退 mammoth)+ upload 链路 2(乱序 PDF 与文本框 DOCX 上传 → originalText 以视觉顺序落库)
- 4.9 新增 6 个测试:适配器超时映射 1 / orchestrator 超时落库 1 / latestRun stale 阈值(真实 DB)1 / hub 权威状态驱动 3
- 4.1–4.7 新增 176 个测试:存储加解密 5 / 上传纯函数 5 / 数据层与端点 12 / parser 6 / Agent 样例集 27 / 管线(真实 DB)17 / final-text 12 / ats-rules 10 / 组件 52(上传 8、files 8、review 8、hub 14、card 8、result 9、ats-card 7、export 7);4.8 新增 11 个(final-text 3 / 管线 4 / 改写 agent 3 / hub 5 / review 1)
- 测试驱动修正 3 处实现:方向词典包含匹配、Unicode 代码点计数、userEvent.setup 剪贴板桩时序
- grep 红线:变更文件零硬编码色值、零渐变

## 已知问题

1. `.doc` 不支持(mammoth 只解析 .docx)→ 上传返回明确文案「请另存为 .docx 或 PDF」
2. 导出禁用语义 = 「零条 accepted」→ 禁用 + 提示(拒绝=恢复原文,最终文本=原文非空;零采纳导出无意义)
3. Noto Sans SC ~8MB×2 字体 commit(中文 PDF 渲染必需,OFL 许可,MVP 取舍,后续可子集化)
4. 上传无流式(Route Handler formData 全量进内存,≤10MB 兜底)
5. 真实 DeepSeek 连通与简历分析质量验证待用户提供 Key 后进行(与既有遗留 #1/#9 同源)

## 2026-08 修订:简历改写状态卡死修复(任务 4.9)

### 现象与根因

「开始优化」后进度事件停在「正在分析…」不完成,刷新浏览器后结果正常出现。排查结论:

1. **直接卡点**:rewrite 端点同步等待整条管线(`router.ts` `await rewriteResume` → Orchestrator → BaseAgent → `adapter.complete()` 非流式阻塞,base.ts:101 第 3 条事件「正在分析…」在调用前发出、之后无事件无心跳)。DeepSeek 大请求(20K 字输入 + 3-8 条长 JSON 输出)需数分钟,且 openai SDK 默认 10 分钟超时 + 2 次重试。
2. **状态不同步机制**:完成信号唯一绑定 mutation promise(`rewriteSubmitted` 钉死分析视图分支);轮询有权威数据却只渲染进度、不参与完成判定。
3. **刷新后正常的原因**:刷新 abort 前端请求,但 Next dev route handler 不监听 request.signal → 服务端管线继续跑完并落库;新页面从 DB 读最新 run/版本 → 恢复视图。时序证据(刷新时事件仍在轮播)表明管线在刷新时仍在执行,而非「早已完成但响应丢失」。
4. **连带隐患**:serializeRun 固定 2 分钟 stale 阈值会把健康长 LLM 任务误报「分析中断」(只改显示不改 DB)。

### 修复(方案 A 1+2+3)

- **A1 权威状态驱动完成判定**(`resume-hub.tsx`):视图判定改由轮询数据驱动——run succeeded + 版本落库 → 结果视图;run failed → 权威失败视图(不等 mutation 返回);会话内 mutation 错误仅在权威无终态时展示;mutation 仅作触发。
- **A2 LLM 超时**(`adapter.ts` + 三个适配器):`LLM_TIMEOUT_MS = 3 分钟`,`createTimeoutSignal`(AbortController + finally 释放),SDK 中止错误(APIUserAbortError/AbortError/TimeoutError)统一转 `LlmTimeoutError`(文案「AI 响应超时,请重试」)→ Orchestrator 映射 → run 落 failed 可重试。
- **A3 stale 阈值**(`router.ts`):`RUN_STALE_MS = LLM_TIMEOUT_MS + 60s`。健康 run 的 updatedAt 停更间隙不会超过 LLM 超时(超时即落 failed),超过阈值仍 running 只可能是进程死亡。

### 已知取舍(后续项)

1. parse 流程(解析)沿用同一模式(submitted 驱动),本轮未对称修复,列为后续对称加固项
2. A4 流式心跳(LLM 调用期间持续更新 run.updatedAt / 推送事件)未做——3 分钟超时内前端仍无新进度事件,靠超时 + stale 兜底
3. 重新分析起点:旧 succeeded run + 版本存在时,点击「重新分析」到新 run 落库 running 之间,视图会短暂显示旧结果(≤1 个轮询周期,已接受)
4. 测试发现:JS Date 经 Prisma `$executeRaw` 参数会在 UTC+8 机器上被按本地时区序列化(+8h 偏移);stale 测试改用 SQL 区间运算(相对行自身回拨)规避

## 2026-08 修订:简历模块顺序保真(任务 4.10)

### 现象与根因

简历优化完成后点「复制最终文本」,复制出的模块顺序与用户原始简历不一致(如原始 基本信息→教育→技能→工作/实习→项目,复制出来变成 项目→工作/实习→技能→教育)。排查结论:

1. **复制文本顺序 = originalText 原文顺序**:`buildFinalResumeText` 在原文上按位置升序原位替换(构造性保序);顺序错乱来自 PDF 提取阶段(pdf-parse 按内容流顺序,可能≠视觉顺序)。
2. **页面表单顺序 = parsedData 固定 Schema 顺序**:核对表单按 schema 写死顺序渲染;两套数据源互不约束 → 脱节。AI 层/后端排序层无罪(validateModifications 按位置排序,不改变模块相对顺序)。
3. 附带发现:目标方向不入 finalText、表单修正不回写 originalText。

### 产品规则(用户确认)

Schema 定义「是什么」;originalIndex/sectionOrder 定义「用户原本放在哪里」;AI 决定「如何优化内容」;最终文本生成器「按用户原始顺序输出」。最终文本顺序必须严格 = 用户原始简历模块顺序,Schema 顺序不用于排序。

### 修复(方案 A′)

- **finalText 零改动**:继续原文原位替换,顺序天然保真。
- **确定性检测(纯函数,不靠 AI 报顺序)**:`detectSections`(行级扫描,整行 + 同行冒号前缀两种标题形式,归一化后精确匹配词典防「办公软件技能」误判;自定义模块词典 + 原文切片)→ `buildSectionPlan`(无标题模块按字段值 findRawRange 锚定;条目按内容位置归组到各出现;锚定失败置已定位模块之后 UNLOCATED 兜底)。
- **落库快照**:`Resume.sectionOrder` Json 列,3 个入库点(upload/createFromText/pasteText)写入;`resume.get` 读取时派生 `sectionPlan`(快照非法 → 现场重算兜底,`parseStoredSections` 防御解析)。
- **表单按 plan 渲染**:`resume-review.tsx` buildBlocks 按 plan 顺序(缺失 kind → 虚拟分区置于已定位模块之后、目标方向之前,唯一例外已文档化);自定义模块只读(标题 + 原文);工作/实习经历分开展示(条目按 plan.items 归组,index-groups 本地 state:删除平移/添加追加);多技能分区合并为单编辑器置首个出现;多基本信息取首个出现;plan 为 null → 回退固定 Schema 顺序(向后兼容)。
- **结果页预览面板**:`resume-result.tsx` Hero 下新增「最终文本预览」直接渲染 `version.finalText`(与复制/导出同一字符串,用户复制前可见实际输出)。

### 已知取舍(后续项)

1. 同一学校/公司/项目名在原文多次出现(如同一大学两段学历)时,归组取首次命中位置 —— 罕见且仅影响表单分区归属,不破坏原文顺序
2. 两个同 type 经历分区(如两段「工作经历」标题)罕见场景:条目按 type 归入首个同 type 分区,后一分区为空编辑器 —— 分区卡片仍按原文位置渲染,顺序不破坏
3. 多技能分区合并为单编辑器(置于首个出现),多基本信息取首个出现 —— 已文档化简化
4. parse 阶段(解析)状态机沿用 submitted 驱动(4.9 遗留,未对称修复)

## 2026-08 修订:提取层视觉排序(任务 4.10 验收修复)

### 现象与根因(真实数据定位)

用户以真实 `.docx`(七牛云上的真实简历,仅本地诊断、不入库不落仓库)验收:「最终文本预览」模块顺序仍与原始简历不一致。用真实文件端到端定位(解包 DB 落库原文 + 本地存储解密原件 + 逐环节顺序指纹):

1. **断点在最上游提取层,不在 finalText 构造**:`buildFinalResumeText` 原位替换构造性保序,已核无固定字段拼接;指纹显示 originalText(提取产物)本身即乱序,sectionPlan / finalText / 预览 / 复制全部忠实继承。
2. **DOCX 根因 = 文本框模板 XML 逆序**:该 .docx 是绝对定位文本框排版(24 个 mc:AlternateContent 绘制对象、13 个 wp:anchor 文本框),文本框在 document.xml 中按反视觉顺序书写(第一个绘制对象位于页面底部 10.49 英寸);mammoth 按文档顺序提取(body-reader.js 按序读 txbxContent)→ 输出近似视觉倒序(荣誉证书在前、基本信息在末尾)。
3. **PDF 同构根因**:pdf-parse 默认 pagerender 按内容流顺序拼接 items(无坐标排序)→ z-order 写入的 PDF 提取乱序。
4. 修复方向确认:两种格式统一在提取层按视觉坐标重建阅读顺序;下游(sectionOrder/sectionPlan/finalText)零改动。

### 修复

- **PDF**(`parser.ts`):`sortPdfItemsByPosition` 纯函数 —— items 按 y 降序(PDF y 向上)、同行按 x 升序,同行 y 容差 3pt 归组,相邻 CJK 直接拼接、否则补空格;自定义 `pagerender` 传入 pdfParse(替换默认 render_page,getTextContent 选项不变)。d.ts 补 pagerender 类型。
- **DOCX**(`docx-extract.ts` 新建):jszip 解包 + saxes 单遍解析 —— 按文档顺序收集流式段落与 wp:anchor 文本框(positionV/H posOffset 坐标 + txbxContent 文本,mc:Fallback VML 诱饵跳过,锚点段自带文本丢弃防重复);组装 = 首个锚点之前的流式段落 + 文本框按 y 升序/x 升序 + 其余流式段落;无文本框 → no-textboxes 回退 mammoth(普通文档行为不变)。
- **依赖**:jszip ^3.10.1 + saxes ^6.0.0 显式声明(mammoth 传递依赖已存在,零新装)。

### 验证

- 真实 .docx 本地验证:新提取器输出 基本信息 → 教育背景 → 个人技能 → 项目经历 → 校园经历 → 荣誉证书,与 Word 视觉顺序一致;流式段落 0、13 文本框全捕获、无 DECOY 重复。
- 测试:PDF 排序纯函数 7 用例(标准五模块/用户反例/实习在前+自定义穿插/同行 x+拉丁空格/CJK 无空格/y 容差/空条目兜底)+ DOCX 解析 8 用例(逆序还原/反例顺序/同 y 按 x/align 兜底/框内多段落/流式前后/锚点段丢弃/无文本框退化)+ 集成(乱序 PDF fixture、文本框逆序 DOCX fixture、普通 DOCX mammoth 回归)+ 上传链路(乱序 PDF / DOCX → originalText 视觉顺序落库)。

### 已知取舍

1. DOCX 文本框 positionV/H 为相对锚点段落的偏移(relativeFrom=paragraph);锚点不在同一段时跨框坐标比较是近似 —— 模板文档锚点集中在首段,实际场景成立
2. 文本框与流式文本混排时,锚点之间的流式段落统置于文本框之后(近似);锚点段自带文本丢弃(视觉内容在框内)
3. 竖排/旋转文本(PDF)与多栏排版不在支持范围
4. 存量已乱序行不迁移:重新上传即按新提取器生成正确原文(与用户确认)
5. 真实简历文件不进测试仓库(含个人信息),测试用合成 fixture 模拟同构结构
