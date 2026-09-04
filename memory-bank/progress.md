# 项目进度

## 当前项目状态

- **阶段**:Phase 1(MVP 核心闭环)+ **Phase 2(增强能力)完成**:里程碑 M1 – M4、M5 闭环整合(5.1–5.3,5.4 按用户指示未执行)、工作台导航优化三轮、**Stage 6(6.1–6.9)**、**Stage 7(7.1–7.3)**、**Stage 8(8.1–8.2)** 全部完成并推送;6.7 微信登录按用户拍板本轮暂缓(零代码,待凭据);6.10、7.4/7.5 按用户指示未执行
- **最近更新**:2026-09-05,文档整理:删除两份一次性验收清单(phase2-acceptance-checklist.md、stage6-acceptance-checklist.md),Stage 6 走查要点并入 Stage 6 节「下一步」;顶部状态头同步 Stage 8 完成状态与最新测试基线(917/95 文件)
- **已完成任务**:1.1 – 1.8、2.1 – 2.7、3.1 – 3.5、4.1 – 4.17、5.1 – 5.3、工作台导航优化(两排语义/卡片主体≠CTA/下一步建议行动卡/待处理建议)、6.1 – 6.9、7.1 – 7.3、8.1 – 8.2 全部完成;部署(5.3 部署动作)按用户决定暂缓,清单见 deployment-checklist.md
- **当前状态**:**Stage 6–8 已实现并推送,浏览器人工验收待做**(Phase 2 整体验收 + Stage 7 面试验收 + Stage 8 走查同批,要点见各节「下一步」);6.10、7.4/7.5 按用户指示不执行;生产部署暂缓(清单见 deployment-checklist.md)。
- **测试基线**:917 个测试 / 95 个文件全部通过;typecheck / lint 零错误;生产构建成功;prompt 打包 11/11 打入 tRPC Serverless 路由

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
4. ~~Prompt 文件经 `fs` 从 `process.cwd()` 读取:本地开发无碍;若部署 Vercel Serverless 需调整为打包资源或 DB 存储(4.1 部署前评估)~~ **已解决(5.3)**:`outputFileTracingIncludes` 显式打入 Serverless 产物,build 后 .nft.json 验证 6/6 prompt 在列
5. Git Bash 终端 curl 发中文会 mojibake(终端 GBK 编码):浏览器端 e2e 不受影响,非产品缺陷
6. `backend/` `frontend/` 空目录保留不动(用户已确认);pgAdmin 未随安装器安装
7. **服务端进程被杀会致 run 卡 running**:查询层将 `running 且 updatedAt > 2 分钟` 序列化为 failed「分析中断,请重试」,用户可重试恢复;跨实例持久化进度依赖 DB 轮询(production 可用),非缺陷
8. **Recharts 在 jsdom 无尺寸**:组件测试改用 HTML 图例文本断言(已 polyfill ResizeObserver);雷达图真实渲染与响应式需浏览器人工走查
9. **真实 DeepSeek 分析质量未验证**:样例集与 Mock 输出已固化,管线正确性已测;待用户提供 Key 后改 `.env` 做真实请求(与遗留 #1 同源)
10. **生产部署暂缓(用户决策,2026-08-23)**:5.3 代码已交付;生产数据库未创建、DeepSeek Key 未提供(已确认生产 LLM = DeepSeek)。完整清单与步骤见 deployment-checklist.md
11. **Coach echo 不一致边缘态(6.3,风险 4 落位)**:LLM 输出 weeklyHours 与输入不符时 run 成功但不落库(ok:false,AgentRun 按 succeeded 记录);重试从 AgentRun.input 重放可恢复,真实 LLM 下出现频率待验证

## 下一步 Implementation Step

**用户对阶段 5(5.1–5.3)的整体产品验收**(验收标准见 implementation-plan M5 节):

- 工作台四区四态(问候行/KPI 行/Agent 顾问区/模块入口)、新用户空态引导「开始职业探索」、增量徽章、运行中 700ms 轮询与进度条
- 首页未登录可见(价值主张 + 单一 CTA + 三模块 + 信任行),已登录自动跳转工作台;三条数据流转(画像 → 路线图方向带出、画像 → 简历标签与方向带入、简历独立入口无画像提示)
- 部署就绪件:Vercel Blob 存储、prompt 打包、隐私政策/用户协议(海外部署声明)、FunnelEvent 埋点
- 回归:首次上传/简历解析/简历优化/最终文本预览/复制最终文本/ATS/重新上传/多份简历/原始简历顺序保持
- 测试基线 578/60 文件全绿;typecheck/lint/build 零错误
- **部署**(验收后、用户提供凭据时):按 deployment-checklist.md 执行

**按用户指示:不执行 5.4 与后续阶段。**

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
| 4.10-fix | 提取层视觉排序:验收发现真实 .docx(文本框模板)与 z-order PDF 的 finalText 乱序 → 断点在提取层 → parser 按坐标重建阅读顺序(PDF items y/x 排序 + DOCX wp:anchor positionV/H 排序) | ✅ | `b34c334` |
| 4.10-layout | 结果页信息层级重排:优化结果对比卡 → 最终文本预览 → ATS 评分(预览在优化结果之后、ATS 之前);复制按钮移入预览卡与预览同源;buildFinalTextForVersion 单一构造入口(serializeVersion 与 scoreAts 共用,ATS 分析对象 = 预览同一字符串) | ✅ | `44dc4b1` |
| 4.11 | 结果页「重新上传简历」入口:复用 uploadMode 切回上传视图(只切视图不删数据),上传新文件建新行,行 id 变化 effect 复位会话状态并自动切换到新简历;旧简历/解析记录/优化版本全部保留 | ✅ | `bc68e6d`(实测验收未过,4.12 返工) |
| 4.12 | 重新上传 = 新增独立简历(4.11 验收返工):上传视图拖拽区常显「上传新简历」+ 新增说明,移除「更换简历」按钮与旧文件卡;活跃简历 = URL 参数 ?resumeId=(resume.get 可选输入 + 失效护栏去参);上传成功清参自动切新行;设置页逐行「查看」+ 页面级「+ 新增简历」(?upload=1) | ✅ | `cdb7e72` |
| 4.13 | 简历中心:设置页「简历文件管理」整体迁移为顶级导航一级页面 /resumes(继续优化/查看/下载/删除 + 新增);结果页按钮改名「上传新简历」+「查看全部简历」入口 + 当前简历名;上传视图「从已有简历继续」列表切换活跃行;失败视图 editLabel 统一「上传新简历」 | ✅ | `1f68cac` |
| 4.14 | 上传视图退出体验:← 返回按来源动态返回(简历优化进入 → 回原视图;?upload=1&from=resumes → /resumes;无结果视图 → /resumes)+ 面包屑定位;三态取消(未选文件/已选文件/解析中 AbortController 取消上传,取消不影响已有简历);选文件改待确认态,「开始分析」才上传;修复行切换 effect 冷加载首帧误复位 ?upload=1 | ✅ | `16a13e0` |
| 4.15 | 简历中心返回:顶栏「简历中心」/结果页「查看全部简历」进入后左上角「← 返回」(应用内回上一页,直接打开/外链回工作台);共享 goBackOrFallback 辅助;hub from=resumes 退出改后退,避免相邻 /resumes 历史使返回按钮空转 | ✅ | `d798f0c` |
| 4.16 | 导出 PDF 预览修复:PDFDownloadLink 嵌套锚点整页跳转 blob: URL(浏览器查看器、无返回入口)与 Back 后四重失效窗口 → 应用内预览浮层(真按钮 + BlobProvider 每次打开全新生成/关闭 revoke + resume-pdf-preview 返回/下载/三态/Escape);主视图零锚点 | ✅ | a365589 |
| 4.17 | AI 分析进度卡死修复:完成判定依赖被提前禁用的轮询缓存(mutation 结算瞬间 enabled 早停 → 缓存冻结 running → 视图钉死「分析中」,刷新才恢复)→ 轮询常开 + 权威「版本-运行对应」(version.createdAt > run.createdAt ⇔ 管线完成)+ mutation 结算后 invalidate latestRun + 恢复 effect 去 !hasVersion/清会话错误 + analysis-view 60s 慢分析提示 | ✅ | 0b04757 |

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
- 4.11 后 495/495;4.12 修订后 **502/502(55 文件)全绿**(新增 upload 3 / hub 3 / files 1 共 7 个;hub/upload 既有「更换简历」用例改写为「上传新简历」断言;数据层 get({resumeId}) 并入 resume.test.ts 既有 11 用例)
- 4.13 修订后 **510/510(55 文件)全绿**(净增 8:upload 2[从已有简历继续] / hub 3[结果视图入口、点其他行切换、点当前行退出] / result 2[查看全部简历链接、当前简历名] / center 迁移净增 1[提取失败行待补全标注];topbar 4→5 入口计数更新)
- 4.14 修订后 **525/525(55 文件)全绿**(upload 13→22[三态流程/重新选择/取消×2/解析中取消上传/卸载与竞态/面包屑×2]、hub 28→35[from=resumes 返回 /resumes、结果视图与失败视图返回、提取失败行与无简历返回 /resumes、冷加载首帧守卫、?upload=1 默认 from]、center href 断言更新为 from=resumes)
- 4.15 修订后 **528/528(55 文件)全绿**(center +3[应用内后退/无历史回工作台/跨源回工作台];hub from=resumes 退出断言改为后退)
- 4.16 修订后 **533/533(55 文件)全绿**(export 4→9[浮层开合/加载/失败/就绪 iframe+下载链接/返回/Escape/重新打开挂载计数])
- 4.17 修订后 **540/540(55 文件)全绿**(hub +5[缓存冻结 running 但版本更新 → 结果视图(核心回归)、run 比版本新 → 仍分析中、重新分析响应丢失但服务端完成 → invalidate 拉新版本、解析响应丢失但完成 → 清错误不钉死、连续改写 refs 复位二次恢复];analysis-view +2[慢分析提示显示/不显示];hub 既有 2 用例补 invalidateLatestRun 断言)
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

## 2026-08 修订:结果页布局与 canonical 同源(任务 4.10-layout)

### 产品决策(用户确认)

结果页信息层级:**AI 分析(逐条修改对比)→ 优化结果 → 最终文本预览 → ATS 评分**。最终文本是本次优化流程的最终产出,ATS 评分是对最终产出的质量检测,故预览在优化结果之后、ATS 之前;ATS 不放在预览之前。

- 用户认知流程:AI 分析 → 优化内容 → 查看最终投递文本 → 复制使用 → ATS 评分 → 按评分继续优化。
- 「复制最终文本」按钮移入预览卡(贴合「预览 → 复制」流程),顶部工具条仅保留导出 PDF。
- 「AI 分析结果」独立区(优势/问题/建议):当前改写输出只有逐条修改(改前/改后/原因),PRD 的改进建议已在 ATS 卡内;用户确认本次仅重排+同源校验,分析区作为新功能另立任务。

### 实施

- `resume-result.tsx`:预览 section 移到对比卡 `<ul>` 之后、ATS 卡之前;预览卡头部加复制按钮(navigator.clipboard + execCommand 回退,零采纳/空文本禁用);预览直接渲染服务端 `version.finalText`,与复制、导出 PDF 同源同一字符串,无二次组装。
- `resume-export.tsx`:移除复制逻辑,仅保留导出 PDF(禁用态与提示不变)。
- `final-text.ts`:新增 `buildFinalTextForVersion(originalText, optimizations)` 单一构造入口 —— `router.ts` 的 serializeVersion(预览/复制/导出)与 scoreAts(ATS 评分)共用同一函数与同一批 DB 行,ATS 分析对象构造性等于「最终文本预览」渲染的字符串。

### 验证

- resume-result 测试:新增信息层级顺序断言(预览在对比卡之后、ATS 之前,compareDocumentPosition)+ 预览卡复制 3 用例(成功/回退/失败)+ 零采纳与空文本禁用;resume-export 测试瘦身为仅 PDF;final-text 新增 helper 2 用例(与 buildFinalResumeText 一致/全空行退化为原文)。

## 2026-08 修订:结果页「重新上传简历」入口(任务 4.11)

### 现象与方案

入口遗漏:首次进入有上传入口、解析失败有「重新上传」,但成功结果视图无法换简历(只能设置页先删后传,破坏旧数据)。方案:**只加入口,复用既有 uploadMode** —— 结果页工具条「重新上传简历」→ `setUploadMode(true)` → 上传视图显示当前简历 A 文件卡 +「更换简历」→ 上传 B 走既有建行链路 → `resume.get` 最新行变 B → 行 id 变化 effect 复位会话状态并自动进入 B 的「已就绪 → 解析」流程。

### 关键保证

- **旧数据不动**:实现不触碰任何删除路径;每次上传=新行(handleResumeUpload 既有行为);A 的原始文件/解析记录/优化版本全部保留(设置页列表可见)。
- **无新状态**:不引入 reUploadMode;initial 与 replace 两个来源统一由 uploadMode + 行切换 effect 收尾。
- **异常路径**:未选文件 → 留在上传视图不建行;上传失败 → Banner 提示,A 不受影响;B 解析失败 → 既有失败视图可再「重新上传」C;相同文件 → 按现有策略(无去重)= 新行。

### 验证

- resume-result 测试:重新上传按钮触发 onReupload 回调;resume-hub 测试:结果视图点「重新上传简历」→ 上传视图(文件状态卡 + 更换简历),且不触发删除/上传动作。

## 2026-08 修订:重新上传 = 新增独立简历(任务 4.12,4.11 实测验收返工)

### 验收发现与根因

4.11 实测验收失败:结果页点「重新上传简历」→ 上传视图在已有简历时**不显示上传拖拽区**,而是显示当前简历文件卡 +「更换简历」按钮(观感 = 进入已有简历管理/文件列表);点「更换简历」后旧简历在优化流程中不可见,体感「被替换、旧简历没保留」。

代码核实:上传链路自始 `prisma.resume.create`(无 Replace API),旧行 DB 中一直保留;问题全部在 UI 层 —— ①「更换简历」按钮 + 旧文件卡形态(Replace 语义);②无「活跃简历」概念,`resume.get` 永远取最新行,产品内无法回看旧简历的解析/优化数据;③设置页无「查看」与「+ 新增简历」入口。

### 产品模型

重新上传 = **CREATE 新简历**:旧简历、解析记录、优化版本全部保留;多份简历并存(A → B → C 互不覆盖);上传后自动切换到新简历;旧简历卡片只有 查看/下载/删除,全 UI 无「更换简历」。

### 实施

- **router.ts**:`resume.get` 增加可选 `resumeId` 输入(整体可选向后兼容),传 id 查该行(带 userId 归属过滤),越权/已删/未传回退最新行。
- **resume-upload.tsx**:删除文件状态卡 +「更换简历」按钮;拖拽区常显 —— 无简历 = 首次上传文案,有简历 = 「上传新简历」+「本次上传会新增一份独立简历,不会修改或删除已有简历」;新增 props `resumeId`(自身 get 与 hub 同输入共享缓存)与 `onUploaded`(上传成功后、invalidate 前调用)。
- **resume-hub.tsx**:活跃简历 = URL 参数 —— `useSearchParams` 读 `?resumeId=`(透传 get)与 `?upload=1`(初始 uploadMode + 去参);`?resumeId` 失效护栏(get 回退行 ≠ 参数行 → 去参);上传成功 `onUploaded` → `router.replace("/resume")` 清参 → get 回落最新行(新行)→ 既有行切换 effect 复位并进入新简历。resume/page.tsx 包 Suspense(Next 14 静态渲染要求)。
- **resume-files.tsx**:逐行「查看」→ `/resume?resumeId=`;页面级「+ 新增简历」→ `/resume?upload=1`(与结果页同一 CREATE 流程);下载/删除不变。

### 验证

- 新增 7 个测试:upload 3(上传新简历视图/onUploaded 先于 invalidate/resumeId 透传)+ hub 3(?resumeId 透传、?upload=1 初始上传视图 + 去参、失效护栏去参)+ files 1(查看/新增简历链接与无「更换简历」);hub/upload 既有「更换简历」用例改写为「上传新简历」断言。
- 全套 **502/502(55 文件)全绿**;typecheck / lint 零错误;grep 红线:「更换简历」仅存在于注释与「断言不存在」的测试中。
- 手动验收走查(用户 8 Case):A → 上传 B → A+B 并存;刷新仍在;设置页查看 A/B 各自数据;再传 C → A+B+C;上传失败/解析失败不影响旧简历;全 UI 无「更换简历」。

## 2026-08 修订:简历中心 —— 修复「重新上传简历」与「简历文件管理」割裂(任务 4.13)

### 验收发现与根因

4.12 后上传语义已正确(CREATE),但入口仍割裂:简历管理藏在 头像→个人设置→页面底部→简历文件管理;「重新上传简历」直接进上传视图、与简历列表互不相通。根因:4.1 起「简历文件管理」按设置项定位收纳进设置页,Resume 未按核心业务对象设计入口。

### 产品模型(方案 A+B 组合,用户确认)

简历 = **核心业务对象,不是设置项**:顶级导航新增一级页面**「简历中心」/resumes**(方案 A);结果页加「查看全部简历」入口指向它(方案 B);上传视图加「从已有简历继续」打通「上传 vs 切换」双路径。设置页「简历文件管理」**整体迁移**出设置(设置页只留个人资料/修改密码)。

### 实施

- **新增** `resumes/page.tsx` + `resume-center.tsx`(自 settings/resume-files 迁移改名):卡片 = 继续优化(primary)/查看(secondary,均 `/resume?resumeId=` 切换活跃行)+ 下载 + 删除;页面级「+ 新增简历」(?upload=1);extractError 行标「待补全」。
- **topbar.tsx**:NAV_ITEMS 5 入口(简历优化后插「简历中心」,桌面/移动抽屉同源)。
- **resume-result.tsx**:「重新上传简历」→「上传新简历」;新增「查看全部简历」(→ /resumes)+ Hero 左区「当前简历:{fileName}」(hub 透传 resumeName)。
- **resume-hub.tsx**:`handleSelectResume(id)` = 显式 `setUploadMode(false)` + `router.replace("/resume?resumeId=<id>")`(选当前行时 id 不变、行切换 effect 不触发,显式退出是关键);失败视图 editLabel「重新上传」→「上传新简历」。
- **resume-upload.tsx**:「从已有简历继续」列表(`resume.list`):每行 名称/大小/日期 +「待补全」标注 +「继续优化」→ `onSelectResume`。
- 删除 settings/resume-files.tsx 与其测试;DB/API/管线零改动。

### 验证

- 净增 8 个测试:upload 2 / hub 3(结果视图入口、点其他行切换、点当前行退出)/ result 2 / center 迁移净增 1;topbar 4→5 入口计数更新。
- 全套 **510/510(55 文件)全绿**;typecheck / lint 零错误;grep 红线:「更换简历」仅存在于注释与「断言不存在」的测试中;UI 无「重新上传简历」文案。
- 手动验收走查(用户 6 Case):结果页 [上传新简历] → 不覆盖声明 + 上传本地文件 + 从已有简历继续 A → 上传 B 自动进 B,简历中心 A+B 并存;[查看全部简历] → 看到 A+B;[继续优化 A]/[继续优化 B] → 各自优化数据且刷新保持;任何卡片无「更换简历」;不进入设置即可查看/新建/切换简历。

## 2026-08-22 修订:上传新简历视图的返回 / 取消 / 定位(任务 4.14)

### 验收发现与根因

4.13 后上传视图仍是**死胡同**:误触/临时反悔/上传失败的用户没有明确退出路径(唯一离开方式是顶栏导航);选择文件后立即发起上传、没有确认机会;解析中无法中止;从简历中心进入时页面标题仍是「简历优化」,用户不知道自己在哪。根因:上传视图是 hub 状态机内的一个态,从未按「可进入、可退出、可中止」的完整流程设计。

### 产品决策(用户确认)

- 解析中点「取消上传」→ **留在上传页,保留已选文件**(回到已选文件态,可重新开始或重新选择)。
- 无可返回结果视图时(无简历 / 提取失败从未解析成功)→ 返回**简历中心 /resumes**。
- 返回按来源动态:简历优化进入 → 回原视图;简历中心「新增简历」进入 → 回简历中心;不统一跳首页。

### 实施

- **resume-hub.tsx**:`uploadFrom: "resume" | "resumes"` state —— 简历中心「新增简历」改为 `/resume?upload=1&from=resumes`,`?upload=1` effect 按 from 显式赋值(其余入口 `enterUploadMode` 置 resume;effect 依赖改为**值捕获**避免 searchParams 对象身份反复触发);`handleExitUpload` 三分支(from=resumes 或无可返回结果视图 → `router.replace("/resumes")`;否则退 uploadMode 回原视图);面包屑父级标签 = 退出目标;`handleSelectResume` 补 setUploadFrom("resume");**行切换 effect 首帧守卫**(prevIdRef)修复冷加载 `/resume?upload=1` 被秒关的既有 bug。
- **resume-upload.tsx**:新 props `onExit`/`crumbParent`(未传 onExit 不渲染头部);顶部「← 返回」+ 面包屑(父级可点,同 onExit);三态渲染(顺序 uploading > selectedFile > 拖拽区,堵二次提交窗口)—— 选文件/拖入只入待确认态(校验留在选择时机,非法文件即时 Banner),「开始分析」才发 fetch;解析中「取消上传」→ `AbortController.abort()`,catch 判 `signal.aborted` **静默回已选文件态**(文件保留可重试,不显示错误);成功即清 selectedFile;卸载 cleanup abort(对已 settle 请求 no-op);「继续优化」在 uploading 时 disabled(避免切换导致在途上传被卸载中止)。
- **resume-center.tsx**:「新增简历」href → `/resume?upload=1&from=resumes`。
- 竞态限制(代码注释说明):abort 时服务端可能已建行(孤儿行留在简历中心,可接受);客户端不建任何占位行 —— 行仅在上传完成后由服务端创建,「取消上传不创建空 Resume」由数据层保证。DB/API 零改动。

### 验证

- 测试:upload 13→22(三态流程/重新选择/取消×2/解析中取消上传/卸载 abort/abort 后成功照常/面包屑两种文案/未传 onExit 不渲染头部);hub 28→35(from=resumes 返回 /resumes、结果视图与失败视图进入返回原视图、提取失败行与无简历返回 /resumes、冷加载首帧守卫、?upload=1 默认 from);center href 断言更新为 from=resumes。
- 全套 **525/525(55 文件)全绿**;typecheck / lint 零错误;grep 红线:「更换简历」仅存在于注释与否定断言中,UI 无「重新上传简历」文案(服务端「请重新上传或粘贴简历内容」为「再传一次」语义,合理保留)。
- 手动验收走查(用户 5 Case,dev 手动):结果页 [上传新简历] → ← 返回 → 原简历结果视图(无损);简历中心 [新增简历] → 面包屑「简历中心 > 上传新简历」→ ← 返回 → /resumes;误触进入后直接返回、无任何请求/数据变化(Network 面板佐证);上传失败(如损坏文件)→ 错误 Banner + 返回可用、已有简历不受影响;选文件 → 开始分析 → 解析中 [取消上传] → 回已选文件态可重试、简历中心无新行。

## 2026-08-22 修订:简历中心返回按钮(任务 4.15)

### 验收发现

4.14 补上了上传视图的退出路径,但「简历中心」页本身仍无返回入口:顶栏「简历中心」或结果页「查看全部简历」进入 /resumes 后无法明确返回(与 4.14 上传视图问题同型)。同时发现 4.14 的一个历史缺陷:简历中心 → 新增简历(from=resumes)→ 取消时 `router.replace("/resumes")` 会在历史里留下两条相邻 /resumes,若在简历中心后退会退到同一页(按钮观感失效)。

### 实施

- **resume-center.tsx**:顶部(内容左上角,与上传视图同款 ghost ArrowLeft)「← 返回」→ `goBackOrFallback(router, "/dashboard")`。
- **src/lib/client-back.ts(新增)**:`goBackOrFallback(router, fallback)` —— 应用内导航(有历史且首载非跨源)→ `router.back()`;无应用内历史(history.length ≤ 1)或外链首载 → `router.replace(fallback)`,不把用户带出应用。判别依据:pushState 不改变 document.referrer,首载来源稳定可区分(空 = 直接打开本应用;跨源 = 外链进入)。
- **resume-hub.tsx**:handleExitUpload 的 from=resumes 分支由 replace 改 `goBackOrFallback(router, "/resumes")`(上一历史条目即简历中心);无可返回结果视图分支仍 replace /resumes。
- DB/API 零改动。

### 验证

- 测试:center +3(应用内后退 / 无历史回工作台 / 跨源回工作台);hub from=resumes 退出断言改后退(history.length ≥ 2,同源)。
- 全套 **528/528(55 文件)全绿**;typecheck / lint 零错误。
- 手动验收走查(dev):简历优化结果页 → [查看全部简历] → 简历中心 → [← 返回] → 回到结果页;任意页 → 顶栏[简历中心] → [← 返回] → 回到上一页;简历中心 → [新增简历] → [取消] → [← 返回] → 回到进入前的页面(不再空转);直接打开 /resumes(新标签)→ [← 返回] → 工作台。

## 2026-08-22 修订:导出 PDF 应用内预览(任务 4.16)

### 验收发现与根因

用户验收发现「导出 PDF」进入的 PDF 预览页无返回/关闭按钮,浏览器 Back 后无法再次导出。探查实锤:**该「预览页」不是应用页面** —— PDFDownloadLink 自带外层 `<a href download>`,函数子节点又返回内层 `<a href={url}>`(无 download),嵌套锚点使点击跟随内层锚点整页跳转 blob: URL,浏览器内置 PDF 查看器接管页面(应用 UI 消失)。再次导出失败 = 四重静默失效窗口:Back 重载后动态 import 未完成(禁用占位)/ 生成中 href=undefined 死链 / 渲染失败 url 恒 null 且 children 忽略 error(按钮外观正常但永久无效)/ bfcache 恢复陈旧 blob URL 无重生成机制。

### 产品决策

保持方案 A:「导出 PDF」= 打开 PDF 预览,预览提供 返回 + 下载。预览从「浏览器整页导航」改为「应用内全屏浮层」,纯本地状态、零导航。

### 实施

- **resume-export.tsx**:删 PDFDownloadLink 与 ReactNode 桥接;「导出 PDF」改真按钮(主视图零锚点,禁用态不变)+ `previewOpen`;打开即挂载 BlobProvider(函数子节点原生有类型),关闭卸载 → usePDF revoke-on-unmount 释放旧 URL;每次打开全新生成。
- **resume-pdf-preview.tsx(新增)**:纯展示浮层(z-50 覆盖顶栏,role=dialog)—— 头部 ← 返回/「PDF 预览」/「下载 PDF」(download 锚点,真下载);主体 loading/error/ready 三态(ready 为 iframe blob 预览);Escape 关闭 + 锁背景滚动。
- DB/API/管线零改动;resume-result / resume-hub 零改动;finalText 透传不变,PDF 内容零变化。

### 验证

- 测试:export 4→9(零采纳/空文本禁用、开浮层透传 finalText、loading/error/ready 三态、返回关闭、**重新打开 = 全新挂载(挂载计数 2)**、Escape)。
- 全套 **533/533(55 文件)全绿**;typecheck / lint 零错误;grep:PDFDownloadLink 仅存注释。
- 手动验收走查(用户 7 Case,dev):导出 → 应用内浮层预览(顶栏被覆盖,应用 UI 未销毁);← 返回 → 结果页无损;连续 3 次导出/返回全成功;Escape 关闭;下载 → 返回 → 再导出成功;F5 后导出成功;零采纳禁用 + 提示不变。Network 无整页导航;关闭后无 blob 累积。
- 已知限制:iOS Safari 内联 blob iframe 可能空白,「下载 PDF」兜底。

## 2026-08-22 修订:AI 分析进度卡死修复(任务 4.17)

### 验收发现与根因

用户验收:上传简历 → 解析 → 优化,分析视图「正在启动 resume-rewrite-agent / 正在理解你的背景与目标 / 正在分析…」停在 60%,**手动刷新后结果立即出现**。探查实锤:无队列/SSE/worker,`resume.rewrite` mutation 在 HTTP 请求内 await 整条管线(orchestrator.ts:53 建 run → 阻塞 LLM → pipeline.ts:135 版本事务);60% = llm 事件在阻塞调用前落库的「无心跳」平台期(设计内),不是 bug 本身。**真因(情况 B「后端完成、前端未收到」+ D「一次查询后无 refetch」)**:完成判定 `rewriteDone = rewriteSucceeded && hasVersion` 依赖轮询缓存,而 mutation 结算瞬间(hasVersion=true + rewriteSubmitted=false)`enabled: !hasVersion || rewriteSubmitted` 把 latestRewrite **提前禁用**(服务端翻转后几十 ms 内,远早于下一次 700ms tick)→ 缓存冻结在 running;`resume.latestRun.invalidate()` 全仓库 0 命中,无任何补救通道 → 视图钉死「分析中」。刷新重新 fetch 即恢复。同款 bug 曾在 profile 流程以权威守卫修复(profile-hub.tsx:68 `recovering` 加 `!hasResult`),resume 的 4.9 修复(847f651)未对称补上,且 4.9 回归用例只覆盖「mutation 挂起 + 轮询见终态」,不覆盖「mutation 已结算 + 版本已落库 + 轮询缓存冻结」。

### 实施(纯前端,后端/DB 零改动)

- **resume-hub.tsx**:① 两个 latestRun 查询 `enabled` 常开(去掉 !hasParsed/!hasVersion/submitted 早停,refetchInterval 谓词不变);② `rewriteDone` 加权威「版本-运行对应」:`hasVersion && (!run || succeeded || version.createdAt > run.createdAt)`(run 建于管线起点、版本建于结束事务 → 「版本比缓存 run 新」即证明该管线已完成;序列化后 createdAt 为 ISO 字符串,`new Date(...).getTime()` 比较);③ 三个 mutation finally 后 `invalidate latestRun({intent})` 立即拉终态;④ 改写恢复 effect 去 `!hasVersion`(重新优化 + 响应丢失时旧版本存在也必须拉新版本)、两个恢复 effect 成功时清会话错误(响应丢失但服务端完成不再钉死错误视图)。
- **analysis-view.tsx**:running 超 60s 显示「分析时间较长,AI 分析仍在处理中,请稍候。」(role=status,10s ticker 驱动、状态切换/卸载清理);失败态「重试」为既有,未改。
- 不重复启动 Agent(纯读 + invalidate,零新 mutation);不动 profile/navigator 同款 enabled 早停(其 recovering 已带权威守卫,无可见卡死,留后续)。

### 验证

- 测试:hub +5(缓存冻结 running 但版本更新 → 直接结果视图[核心回归]、run 比版本新 → 仍分析中、重新分析响应丢失但服务端完成 → invalidate 拉新版本、解析响应丢失但完成 → 清错误、连续改写 refs 复位二次恢复);analysis-view +2(慢分析提示显示/不显示);hub 既有 2 用例补 invalidateLatestRun 断言;hub 测试 useUtils mock 改稳定引用(否则恢复 effect 因 utils 依赖每渲染重复触发)。
- 全套 **540/540(55 文件)全绿**;typecheck / lint 零错误;grep:无 window.location.reload / 整页定时刷新。
- 手动验收走查(用户 12 Case,dev):上传 DOCX/PDF → 解析 → 优化 **不刷新**自动进结果;慢任务持续轮询直至自动完成;刷新对比一致且正常流程不需要刷新;连续上传 A/B/C 互不干扰;分析中离开再返回(完成 → 直接结果,在途 → 进度续显、不重建任务);Network 仅 tRPC 轮询、无整页导航;60s 慢分析提示;失败态「重试」再跑。已知残留(不改):重新分析时旧版本瞬时闪现、失败的重优化静默回旧结果 —— 既有行为。

# Stage 5 完成(M5:闭环整合 5.1–5.3,2026-08-23)

> 按用户指示:**只执行 5.1–5.3,不执行 5.4 与后续阶段**。5.3 部署动作按用户决定暂缓(清单见 deployment-checklist.md)。

## 完成情况表

| 任务 | 内容 | 状态 | commit |
|---|---|---|---|
| 5.1 | 工作台 Dashboard:问候行(一句话状态+画像过期提示)→ KPI 行(匹配度/路线图进度/简历版本数/本周任务,大数字+增量徽章)→ Agent 顾问区(三卡状态/进度条/最近产出)→ 模块入口(继续上次/去完成/去生成);四态齐全(骨架屏零位移/新用户引导空态「开始职业探索」/错误重试/内容);运行中 700ms 轮询;数据源 dashboard.stats 单次聚合 + Task.completedAt 迁移 | ✅ | `be110d8` |
| 5.2 | 首页与数据流转:营销首页(display 标题「AI 帮你找到职业方向」+ 副标题 + 单一 CTA「开始职业探索」+ 三模块静态卡 + 信任行 + 页脚法律入口);已登录服务端重定向工作台;三条数据流转代码核实与回归(画像→路线图 direction-form careerPaths 注入;画像→简历 readAbilityTags + careerPaths chips;简历独立入口无画像提示) | ✅ | `890f69f` |
| 5.3 | 部署与观测:Vercel Blob 存储 provider(get/put/del 以 pathname 为键,private 访问级,工厂接入);prompt 打包(outputFileTracingIncludes,build 后 .nft.json 6/6 验证);隐私政策 + 用户协议页(公开路由,声明海外部署区域处理);FunnelEvent 表 + resume.logExport 埋点(复制最终文本/下载 PDF);部署清单文档 | ✅ | `6f96b35` |

## 主要修改

- **Schema**:Task 加 `completedAt`(本周任务 KPI 依据,updateStatus 维护:完成置当前时间、离开完成清空,迁移 `20260822151017_add_task_completed_at`);新增 FunnelEvent 表(事件名/时间/用户,User 级联,迁移 `20260822154212_add_funnel_event`)
- **数据层**:`src/lib/dashboard/stats.ts` 单次聚合(10 查询 Promise.all;上海时区周边界 `shanghaiWeekStarts`;matchScoreDelta = 两画像版本最高分差;weekTasks.delta = 本周-上周;Agent 状态含 running 超时判死,与 serializeRun 同口径);tRPC 新增 `dashboard.stats` query 与 `resume.logExport` mutation
- **存储**:`src/lib/file/vercel-blob.ts`(5.3)实现 BlobStorage 接口,`FILE_STORAGE_PROVIDER=vercel-blob` 工厂接入;加密装饰器不变(落 Blob 仍为密文)
- **部署**:`next.config.mjs` outputFileTracingIncludes 把 6 个 prompt 打进 /api/trpc/[trpc] 的 Serverless 产物;`.env.example` 补 BLOB_READ_WRITE_TOKEN
- **前端**:`src/components/dashboard/`(dashboard-view/stat-card/agent-card/module-card/format,DashboardSkeleton 与空态引导);`src/components/landing/`(landing-view/legal-page);首页 page.tsx 改服务端 auth() 重定向;隐私政策/用户协议页;resume-result 复制与 resume-pdf-preview 下载挂导出埋点
- **删除**:dashboard/profile-hint(功能并入 dashboard-view,过期提示保留在问候行)

## 测试结果

- 5.1 完成后:**562/562(57 文件)**;5.2 后 568(landing 2 文件 6 用例 + 路径回归 72 用例);5.3 后 **578/578(60 文件)全绿**
- 新增测试:dashboard-stats 真实写库 10(空态/画像增量/路线图与 completedAt 维护/简历计数/Agent 状态与超时判死/用户隔离/上海周边界 3)+ format 6 + dashboard-view 10(四态/徽章/无基线/失败态/过期提示)+ landing-view 5 + page 重定向 2 + vercel-blob 6(含工厂分支)+ pdf-preview 3 + resume-result/hub/export 埋点断言 + resume 数据层 logExport 2
- typecheck / lint / build 零错误;构建产物 `.next/server/app/api/trpc/[trpc]/route.js.nft.json` 含全部 6 个 prompt .md

## 已知问题(遗留)

- 生产部署暂缓(用户决策):生产数据库未创建(创建指导见 deployment-checklist.md 第二节)、DeepSeek Key 未提供(生产 LLM 已确认 = DeepSeek)、Vercel Blob Store 未创建
- 浏览器人工走查项待用户验收:工作台四态/首页跳转/三条数据流转全链路/部署清单第四节生产验收

# 工作台导航优化(「职业行动中心」,2026-08-23,commit `5c89f00` / `e64a978` / `d4c6004` / `748ce1d` / `e318c40` / `c4edad9`)

用户验收反馈:工作台是「数据展示型」而非「行动中心」,要求回答三问(职业状态怎么样 / 上次做到哪里 / 下一步做什么),分三轮交付,每轮测试后暂停验收。

## 完成情况表

| 轮次 | 内容 | commit |
|---|---|---|
| 前期 P0 | 三顾问卡分进对应模块;简历入口深链最近工作简历 `?resumeId=`(AgentRun.input 扫描派生,零 schema 变更) | `5c89f00` |
| 前期修复 | /resumes 纳入 middleware 保护 | `e64a978` |
| 前期 P1 | 模块 CTA 分模块动词 + 空态(开始分析/开始规划/上传简历)+ 推荐下一步规则链 | `d4c6004` |
| 新 P0 | 「下一步建议」行动卡(green-50+左绿边横幅,规则链注入,全部完成→中性文案无 CTA);两排语义(AI 洞察「AI 最近帮你发现了什么」/ 我的工作「你上次做到哪里」);**卡片主体≠CTA**(主体=查看模块总览,CTA=继续当前工作深链:画像 `/profile#glance`、路线图 `/navigator?focus=current`、简历 `/resume?resumeId=`) | `748ce1d` |
| 新 P1 | 模块 CTA 与行动卡 CTA 尾部 ArrowRight 图标;KPI「匹配度」→「岗位匹配度」 | `e318c40` |
| 新 P2 | KPI「简历版本数」→「待处理建议」(最近工作简历最新优化版本的 Optimization pending 计数,无简历/无版本 → 「—」不伪造 0);DesignRules/PRD/technical-design/progress 文档同步 | `c4edad9` |

## 主要修改

- **数据层**:`stats.ts` 顺序追加一查 `pendingCount`(依赖 lastActivity 派生结果,非 N+1;查询预算 12 并行 + 1 顺序);`versionCount` 字段保留(API 兼容)
- **前端**:`next-step-card.tsx`(新组件)/ `module-card.tsx` 双链接(主体拉伸 Link + CTA z-10,不嵌套)/ `agent-card.tsx` 底部行动提示行 / `dashboard-view.tsx` 五区块重排(问候 → 下一步建议 → KPI → AI 洞察 → 我的工作)/ `profile-result.tsx` `#glance` mount 滚动 / `roadmap-timeline.tsx` `?focus=current`(读 window.location.search 免 Suspense,ref 守卫防 refetch 重滚)/ DesignRules Dashboard 章节同步(结构顺序 + 「卡片主体与 CTA 禁止同页」规则)
- **无 schema 变更、无新路由、无新 UI 框架、无 AI 推荐系统**(规则链基于真实业务状态)

## 测试结果

- 新 P0 后 599/599(61 文件);P1 后 599;P2 后 **602/602(61 文件)全绿**
- 新增测试:module-card 双链接 3 + roadmap-timeline focus=current 4(含 fake timers + scrollIntoView mock)+ profile-result #glance 2 + dashboard-stats pendingCount 3(计数正确/最新版本口径/无版本 null)+ dashboard-view 规则链与双链接断言重写

## 已知限制

- score-ats run 的 input 不含 resumeId → 不参与「最近工作简历」派生(technical-design 已记)
- 路线图阶段级「上次停留」持久化需新增字段,当前阶段由 task.status=in_progress 派生(不实现)
- 画像/路线图空态:卡片主体与 CTA 同页(模块页即创建流程,用户已确认)

---

# Stage 6 完成(增强能力 6.1–6.9,2026-08-23)

> 用户指示(2026-08-23):一次执行 6.1–6.9;6.10 与阶段 7 不执行。逐任务 commit+push,每任务实现 → 测试 → typecheck/lint → 全量绿 → 推送。6.7 微信登录按用户拍板本轮暂缓(零代码,仅文档记录)。各任务偏差记录已同步 implementation-plan.md 对应小节。

## 完成情况表

| 任务 | 内容 | 状态 | commit |
|---|---|---|---|
| 6.1 | Matching Agent(JD 拆解→能力映射→差距计算→六维雷达→投递建议,intent `analyze-match`)+ prompt + 3 份手工标注样例集;JobMatch 单表按列 upsert;无画像两层降级;纠偏结构化 `[{requirementId, note}]` | ✅ | `f02fc1f` |
| 6.2 | 岗位匹配页 /matching(顶栏新一级入口 + middleware):JD 粘贴表单 → 匹配报告六区块(Hero 大数字+建议徽章/逐项对比/双线雷达/隐性需求/投递建议)→ 逐项纠偏弹窗重匹配;无画像引导卡;matching tRPC 命名空间(get/run/correct/retry/latestRun) | ✅ | `cb0d2e4` |
| 6.3 | SkillCoachAgent(intent `build-coach-plan`,**13 周固定**)+ prompt + 3 样例集;预算/P0 矩阵/week 连续/milestone 四组 superRefine;echo 交叉校验不落库;资源免费前置 | ✅ | `beab976` |
| 6.4 | 技能分析 = matching hub 视图态(无新路由):coach-setup(预填 JD 标题 + 周时与 Navigator 对齐)→ coach-plan(优先级矩阵/13 周时间线/资源卡/里程碑风险);matching.coach 一键数据自动带出 | ✅ | `3d09147` |
| 6.5 | 画像能力变化追踪:profile-diff 纯函数(diffRadar/diffAbilityTags)+ history-compare(最新 vs 次新,双线雷达 + 提升/下降/新增徽章);单版本/旧版本查看自动隐藏 | ✅ | `00ee990` |
| 6.6 | 简历多版本:listVersions/getVersion/duplicateVersion(深拷贝,ATS 置 null)/deleteVersion(末版禁删,原文不动);版本选择器在 ResumeResult 内部,既有逻辑零改动 | ✅ | `b43cf3e` |
| 6.7 | 微信登录:本轮暂缓(用户拍板,零代码;待微信开放平台 AppID/AppSecret) | ⏸️ | `01413fa` |
| 6.8 | 分享卡片:ShareCard 两变体(profile/roadmap,NodeTrail 品牌元素,分值条替代雷达)+ ShareDialog(html-to-image 动态 import,toPng pixelRatio 2 → 临时 a 下载,失败可重试);画像/路线图两入口 | ✅ | `fe017ba` |
| 6.9 | 深色模式:20 个 `--careeros-*` 变量(浅+深)+ tailwind 静态 token 变量化 + ThemeProvider/ThemeToggle(顶栏头像菜单 + 设置页三态)+ layout 防 FOUC + use-token-color 三处 Recharts + 12 处 bg-white→bg-card + dev/tokens 深色区 | ✅ | `56d2477` |

## 主要修改

- **Schema**:新增 JobMatch 单表(每用户一行 `userId @unique`,jdText/jdTitle/matchReport/coachPlan/weeklyHours,User 级联删),迁移 `add_job_match`;**按列 upsert** 支持匹配/教练两条管线先后写入互不覆盖
- **Agent 两个**:MatchingAgent / SkillCoachAgent(intent `analyze-match` / `build-coach-plan`),prompt 两份(matching/job-matching.md、coach/skill-coach.md),样例集 6 份手工标注;`agents/index.ts` 注册;prompt 打包 6→8 份
- **管线两个**:runMatch(无画像归一化)/ runCoachPlan(echo 交叉校验 + 资源免费前置),镜像画像管线骨架(progressChain + adapter 注入 + AgentRun 日志 + 失败不落行)
- **tRPC**:matching 命名空间 6 端点(get/run/correct/coach/retry/latestRun,失败 BAD_GATEWAY);resume 命名空间 4 端点(listVersions/getVersion/duplicateVersion/deleteVersion)
- **前端**:matching-hub 状态机(6.2 报告 → 6.4 coach 视图态)/ match-form / match-report / gap-correction-dialog / coach-setup / coach-plan / coach-timeline;history-compare(6.5);resume-result 版本选择器(6.6);share-card / share-dialog(6.8,html-to-image 新依赖);theme-provider / theme-toggle / appearance-form + layout 防 FOUC(6.9);topbar 加「岗位匹配」入口 + 「外观」组
- **主题基建**:globals.css 双主题 `--careeros-*` 变量表 + color-scheme + shadcn 变量 remap;tailwind.config 主题 key 变量化(透明度修饰符编译为 `hsl(var(--x) / 0.5)` 已验证);tokens.ts 保持浅色 hex 供 PDF 消费

## 测试结果

- 每个任务提交前全量测试绿;6.9 后全套 **703/703(75 文件)全绿**;mock 演示数据修复后 **712/712(76 文件)全绿**;教练优先级归一化修复后 **713/713(76 文件)全绿**;typecheck / lint 零错误
- 6.9 新增 13 用例 / 3 文件:theme-provider 7(默认 system/切深色挂类+持久化+themechange/system 跟随 matchMedia/显式 dark 不监听/存储值恢复/非法值回退/系统深色偏好)、theme-toggle 3(radiogroup 三态/aria-checked 转移+持久化/card 变体)、appearance-form 2(说明文案随主题)、topbar 外观组 1
- 生产构建成功:`.dark` 变量块与双 color-scheme 进入产物;`bg-sunken/50` → `hsl(var(--careeros-sunken)/.5)` 透明度修饰符验证通过;prompt 打包 8/8 .nft.json 验证
- grep 自检:变更文件零新增硬编码色值;`bg-white` 业务类零残留(12 处已转 bg-card)

## 已知问题(遗留)

1. **风险 4 落位**:Coach「run 成功但 echo 不符不落库」边缘态(LLM 篡改 weeklyHours 回显)——ok:false 不落库、AgentRun 按 succeeded 记录、客户端重试从 AgentRun.input 重放可恢复;真实 LLM 下该路径的出现频率待验证
2. Matching/Coach 真实 LLM 分析质量未验证(样例集 + Mock 已固化,与遗留 #1/#9 同源,待 DeepSeek Key)。**Mock 演示数据说明**(2026-08-23 补):`LLM_PROVIDER=mock` 时默认 Mock 按 agentName 分发 schema 合规演示数据,浏览器可走通匹配/教练全链路;匹配报告为固定夹具(与粘贴的 JD 内容无关,positionTitle 固定「后端开发工程师」),教练计划由输入动态生成(weeklyHours 回显、矩阵按重要性×差距推导)
3. 分享卡为浅色底截图(DesignRules 已明确),不含雷达图(分值条替代,html-to-image 对 Recharts SVG 截图不可靠)
4. 微信登录待微信开放平台凭据(任务 6.7 暂缓,策略不变)
5. 深色模式浏览器人工走查项:全站页面深色下四态与对比度逐页走查待用户验收(dev/tokens 深色区可自查)
6. **真实 LLM 下 coach 优先级自报标签不可信(2026-08-23 已归一化)**:DeepSeek 实际输出反复自报违规标签(重要性 5/差距中 标 P0、重要性 4/差距小 标 P2、矩阵乱序),原 superRefine ②「违规即拒」导致整份计划被拒;已改为 transform 确定性归一化(不信任模型自报)。预算/周连续/里程碑仍严格拒绝,真实 LLM 下这些规则的通过率待多轮验证

## 下一步

**Phase 2 整体验收**(2026-09-05 文档整理:原独立清单 stage6-acceptance-checklist.md 已删除,走查要点合并于此;验收前提 = mock 演示数据可走通链路、真实分析质量待 DeepSeek Key,见本文件已知问题 #2):

1. **匹配主链路**:有画像账号 → /matching 粘贴 JD → 六区块报告(匹配度大数字 + 建议徽章 + 逐项对比 + 双线雷达 + 隐性需求 + 投递建议)→ 「生成 90 天提升计划」→ 教练计划(优先级矩阵 P0/P1/P2 + 13 周时间线 + 资源卡);刷新后数据仍在(JobMatch 落库)
2. **纠偏重匹配**:报告内对「不足」项点「这个要求我其实满足」→ 补充说明提交 → 重匹配后该项状态/证据回应说明;空说明被校验拦截
3. **无画像降级**:新账号 → /matching 引导卡「先完成画像」,不能提交匹配
4. **画像历史对比**:两个以上画像版本时,最新版结果页出现历史对比区(双线雷达 + 提升/下降/新增徽章),徽章与两次数据差值一致;切旧版本区块隐藏
5. **简历多版本**:复制为新版本(方向与源一致、ATS「尚未评分」)、版本间切换互不影响、删除版本、末版禁删、原文不动
6. **分享卡片**:画像卡/路线图卡下载 PNG(560px 宽、含「CareerOS · AI 职业成长助手」),内容与页面当前数据一致;失败 toast 可重试
7. **深色模式**:顶栏三态(跟随系统/浅色/深色)+ 刷新保持 + 跟随系统切换;全站各页四态与对比度走查,无白底残留
8. **Phase 1 回归**:画像更新 / 路线图任务三态与重新生成 / 简历上传→解析→优化→ATS→导出 / 工作台 KPI 与建议 主链路抽查无退化

通过标准:以上 8 项(P0)全部通过即 Phase 2 验收通过;mock 模式下第 1/2 项的「AI 分析质量」降级为遗留验证项(待真实 Key,与阶段 2 先例一致),链路本身照常走通。

---

# Stage 7 完成(模拟面试 7.1–7.3,2026-08-24)

> 用户指示(2026-08-24):执行 7.1–7.3 一次完成;7.4/7.5 与阶段 8 不执行。先 Plan Mode 确认方案(已批准),7.1→7.2→7.3 顺序执行、任务间内部阶段性验证、逐任务 commit+push。用户拍板 4 项产品决策:①顶栏一级入口「模拟面试」→ /interview;②场次三档(短 5/标准 10/完整 15);③流式渲染 = 打字机渲染(非 SSE);④每题答完立即展示评分徽章 + 改进建议 + 可追问。各任务偏差记录已同步 implementation-plan.md 对应小节。

## 完成情况表

| 任务 | 内容 | 状态 | commit |
|---|---|---|---|
| 7.1 | 出题 Agent `interview-question-agent`(温度 0.7,intent `generate-interview-questions`)+ prompt + 3 份手工标注样例集;输入 = 简历快照 + 岗位 + 面试类型 + 档位;五类题型全出现 + 题数 echo 交叉校验不落库;InterviewSession 单表(每用户一行,userId @unique,questions/answers/report 三 JSON 列,对话消息派生不建表);tRPC interview 命名空间 get/start/latestRun/retry(出题路径) | ✅ | `da1684d` |
| 7.2 | 面试对话界面(DesignRules L188 特许对话形态,全产品唯一聊天式布局):面试官气泡 + 用户答案 + 逐题推进 + 追问(可跳过、至多一次、不二次评估)+ 行为面 STAR 提示;打字机渲染(useTypewriter rAF,仅新气泡打字,历史消息整段恢复,reduced-motion 一次到位);思考气泡 role=status + 在途禁用;评估等待式每题即时评分徽章(数值+文字双通道)+ 失败「重试评估」;键盘操作完整(Enter/Shift+Enter/isComposing);中断恢复(刷新直接回对话);middleware + authConfig.protectedPaths 防护;topbar 一级入口;mock 评估分支 | ✅ | `6157be4` |
| 7.3 | 报告 Agent `interview-report-agent`(温度 0,intent `generate-interview-report`)+ report.md;每题独立 AgentRun 评估(内容/表达 1-10 + 改进建议 + 追问);finish 端点(双保险「至少完成一道题」,允许提前结束,未答/未评估不计入);报告定性四要素 + 均分前端确定性计算;综合报告视图(返回对话/开始新面试确认 Dialog/report null 兜底)+ chat 完成态只读回顾 + hub 报告状态机(在途/失败/恢复/重放);mock 报告 fixture 分支 | ✅ | `fb24846` |

## 主要修改

- **Schema**:新增 InterviewSession 单表(每用户一行 `userId @unique`,interviewType/questionCount/targetPosition/resumeText(场次快照)/status/questions/currentQuestionIndex/answers/report,User 级联删),迁移 `add_interview_session`;**按列 upsert** 出题/评估/追问/报告四管线先后写入互不覆盖;开始新场次覆盖旧场次(前端确认 Dialog)
- **Agent 三个**:interview-question-agent(0.7)/ interview-answer-evaluator(0)/ interview-report-agent(0),prompt 三份(interview/question.md、evaluate.md、report.md),样例集 3 份手工标注;`agents/index.ts` 注册;prompt 打包 8→11 份
- **管线四个**:runInterviewQuestions(echo 校验)/ runEvaluateAnswer(事务:答案先落库 + 评估写入,index 推进)/ runFollowUpAnswer(不触发 LLM)/ runInterviewReport(已评估题汇总摘要,answer 截 800 字);镜像画像管线骨架(progressChain + adapter 注入 + AgentRun 日志 + 失败透传)
- **tRPC**:interview 命名空间 9 端点(get/start/submitAnswer/evaluate/submitFollowUp/skipFollowUp/finish/retry/latestRun);序列化防御解析(questions/answers/report 损坏回退 null,report 返回解析后值);retry 三路重放(run.input 合法性门,评估/报告重放时按当前场次重读重组)
- **前端**:interview page + hub 状态机(无简历引导卡/setup/出题 AnalysisView/chat/报告 AnalysisView/report,镜像 matching-hub 700ms 轮询 + finishedRef + 双 finishedRef 恢复)/ interview-setup(三档 radio)/ interview-chat(特许对话形态 + 打字机)/ interview-report(均分 + 四要素);topbar 加「模拟面试」入口 + middleware matcher;mock 演示数据按 agentName 分发 6 分支

## 测试结果

- 三个 commit 各自全量绿;**7.3 后全套 834/834(85 文件)全绿**;typecheck / lint 零错误;生产构建成功(/interview 8.47kB);prompt 打包 11/11 .nft.json 验证(interview 3 份)
- 7.1 新增:Agent 出题测试(五类覆盖/出处可查/换岗位差异/echo/registry)+ 管线出题 upsert + 接口 start/get/retry/latestRun;7.2 新增:评估 Agent + 管线评估/追问事务 + 接口四端点 + chat 组件(打字机/键盘/追问/思考气泡/结束 Dialog)+ hub 状态机 + use-typewriter hook + topbar 改;7.3 新增 36 用例:报告 Agent 9 + 报告管线 7(含提前结束/截断/失败不串)+ 接口 finish/报告 retry 6 + 报告视图 6 + hub 报告态 6 + chat 完成态 2
- 手动走查(mock,dev server):顶栏入口 → 无简历引导卡(新账号)→ 完整跑 5 题短面试(五题五评估 + 追问 + 逐题评分徽章)→ 结束确认 → 综合报告(均分/四要素)→ 开始新面试确认回表单;中途刷新恢复;键盘操作;未登录 /interview 307 → /login

## 已知问题(遗留)

1. **真实 LLM 评估/报告质量未验证**:评估稳定性(同一答案分差 ≤2)与报告四要素质量在 mock 下达标(固定输出分差 0),DeepSeek 真实质量待 Key 验证(与遗留 #2 同源);mock 演示数据 = 固定评估 {8,7} 与固定报告夹具,浏览器可走通全链路
2. **既有防护缺口(未动,超出本轮范围)**:`/matching`、`/resumes` 不在 authConfig.protectedPaths(middleware matcher 有、authorized 回调无 → 未登录访问页面渲染但数据接口 401;`/interview` 已在 7.2 修复)。如需统一收紧建议下一轮单独处理
3. 面试场次为简历/岗位快照:简历后续变更不影响已开场次(自洽设计);开始新场次覆盖旧场次后旧报告不可见(单行模型,UI 已确认提示)

## 下一步

**Stage 7 人工验收**(用户浏览器走查):完整跑一场面试(建议短 5 题)→ 每题评分/追问 → 提前结束与全部答完两条路径 → 综合报告 → 返回对话只读回顾 → 开始新面试;Phase 1/2 回归不受影响(新增模块零改动既有功能)。

---

## 2026-08-24 修订:模拟面试 500 / JSON 解析错误 / 系统卡顿 排查修复

### 现象与根因链

用户报告 4 个症状(全部有证据,非猜测):

1. `/api/auth/session` 500(重复)
2. `/api/trpc/interview...` 500(重复)
3. `ClientFetchError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`
4. 系统卡顿、部分请求失败、刷新偶恢复

**根因链**:

- **服务器端崩溃(500 的根源)**:3000 端口 dev server 的 webpack 编译 worker 崩溃——curl 提取的 500 响应体 = Next.js dev 错误页 HTML,内嵌 `__NEXT_DATA__` 完整堆栈 `Jest worker encountered 2 child process exceptions, exceeding retry limit`。服务器死透后**所有** API 请求都返回 500 + HTML 错误页 → 前端 `fetch` 按 JSON 解析 → `Unexpected token '<'`(症状 ①②③ 的共同来源)。
- **崩溃诱因**:`.next/` 被 3 个并发 dev server(3000/3001/3002)共享读写;且 dev 运行期间执行过 `npm run build`——现场 `.next/cache/webpack/` 下 client-development / client-production / server-production 缓存并存(build 与 dev 混写同一目录)+ 948MB 孤儿 node 进程内存压力。
- **反证**:同一份代码跑在健康的 3002 dev server 上完全正常(session 200、trpc 401 JSON)——代码无必然崩溃点,问题在运行时环境。
- **卡顿放大机制(客户端)**:`src/trpc/provider.tsx` `new QueryClient()` 零配置(retry=3、refetchOnWindowFocus=true、staleTime=0 全默认,tRPC v11 不覆盖 retry)+ `src/app/layout.tsx` SessionProvider 裸包裹(next-auth 默认 focus 重拉 session)+ 面试页 700ms 双轮询(约 1.43 req/s)。服务器 500 时每个查询自动重试 3 次、每次切回标签页全量重拉 → 请求风暴 → 卡顿。「刷新偶恢复」= 偶发命中未损坏的编译缓存条目。
- **已排除的疑点**(两份只读探查报告):无 useEffect 依赖数组循环、无 setInterval/refetchInterval 泄漏(全部状态门控且有 cleanup)、无重复创建面试场次(单行模型 upsert 幂等)、单次答题序列正常、LLM complete() 有 3 分钟超时、run 必落 succeeded/failed。**真实风险点 2 个**:①服务端无 in-flight 互斥(双标签页并发 finish/submitAnswer → 双倍 LLM + answers 快照互相覆写)②打字机对历史消息空转渲染。

### 修复

**Part A 环境修复(运行时,无代码变更)**:终止 3 条进程树(杀前逐条核对 CommandLine 确认归属)→ 删除被污染的 `.next`(纯缓存,在 .gitignore)→ 仅启动单一 dev server(端口 3000)→ 健康 curl 通过后再改代码。

**B1–B6b 代码加固**(3 个 commit):

- `bbb73dd` fix(trpc):①QueryClient `retry: 1` + `refetchOnWindowFocus: false`(挂载重拉保留,数据新鲜性不受损)②SessionProvider `refetchOnWindowFocus={false}` ③面试页两处轮询 700→2000ms(0.5 req/s,仅 running/在途时轮询语义不变)④tRPC 端点 onError 服务端日志(仅 error/type/path,不记 input——简历/回答等敏感内容不进日志)。
- `2cb14e8` fix(interview):**管线 in-flight 互斥 + 每用户串行化**——`RUN_STALE_MS`(= LLM 超时 + 1 分钟余量)单源化到 orchestrator.ts(router 与管线共用口径,防 pipeline→router 成环);pipeline 五个公开入口(出题/评估/evaluateStored/追问/报告)全部包 `withUserLock`(每用户 promise 链排队,单进程)并做双检查(wrapper 锁前快速路径 + Inner 锁后权威复查;内部函数 runEvaluationForIndex 不得再加锁——死锁硬约束);命中「running 且未超 RUN_STALE_MS」的最近同 intent run 时:出题/报告 → 幂等复用 `{ok:true, runId}`(前端 latestRun 轮询自然收敛),评估 → `{ok:false, code:"CONFLICT", 文案「该题正在评估中,请稍候」}` → router 映射 HTTP 409,前端 friendlyError 直接显示中文文案。前端复用收敛(`interview-hub.tsx`):pendingRunIdRef/finishingRunIdRef 按 runId 精确匹配(防旧 run 误收敛)——出题复用保持出题视图等轮询收敛、报告复用保持生成中、场次 completed 清在途、报告失败按 runId 透出错误(不卡无限「生成中」)。
- `7669f32` perf(interview):useTypewriter 加 `animate?: boolean`——历史消息 animate=false 时 hook 内短路(整段渲染、不调度帧、不回调 onDone),消除大量并发 rAF 空转。

### 测试结果

- 3 个 commit 各自全量绿,**846/846 全绿**;typecheck / lint / build 零错误
- 新增 12 用例:pipeline 互斥 5(出题复用:同 runId + questions null + AgentRun 计数不变 + LLM 零调用;stale 放行:`prisma.agentRun.update` 显式回拨 updatedAt 超 RUN_STALE_MS → 新建 run;评估 CONFLICT:answers 与调用前 deep equal;evaluateStoredAnswer CONFLICT;在途并发确定性 CONFLICT:慢 MockAdapter + DB 轮询等 running 行出现再发第二个 → answers 仅第一条)+ interview 接口 3(start 遇 running 复用同 runId 计数不变;submitAnswer / evaluate 遇评估在途 → CONFLICT)+ hub 复用收敛 3(出题复用→收敛进对话、finish 复用→completed 进报告、finish 复用失败→按 runId 透出)+ typewriter animate:false 1(首帧整段、不调度帧、onDone 不触发)

### 性能变化(修复前后对比)

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 服务器 500 | 全部 API 返回 HTML 错误页(webpack worker 崩溃) | 健康(单一 dev server + 干净 .next) |
| 单查询遇 500 | 1 + 3 重试 = 4 次 | 1 + 1 重试 = 2 次 |
| 切回标签页 | session + 全部查询全量重拉 | 0(双 provider 均关焦点重拉) |
| 出题/报告轮询 | 700ms(1.43 req/s) | 2000ms(0.5 req/s) |
| 双标签页并发 finish/submitAnswer | 双倍 LLM + answers 覆写 | 复用/CONFLICT + 每用户串行 |

### 开发纪律(长期生效)

1. 开发时**只跑一个 dev server**
2. `npm run build` **必须在无 dev server 运行时执行**(build 与 dev 混写 .next 是本次崩溃诱因)
3. 停 dev 再 prisma generate(Windows 下运行中的 dev 锁 Prisma 引擎 DLL)

### 已知问题(遗留,不隐瞒)

1. R4:每次答题约 17 条 DB 操作(进度事件逐条落库),量级可接受
2. R6:出题 echo 校验失败的 UX 无差异化提示
3. `stream()` 无超时(当前生产路径只用 complete(),已带 3 分钟超时)
4. `/matching`、`/resumes` 不在 authConfig.protectedPaths(既有遗留,见 Stage 7 遗留 #2)
5. `dashboard/stats.ts` 保有独立 RUN_STALE_MS 副本(同值,可后续合并);matching/navigator 的 700ms 轮询未动(超范围);`withUserLock` 为单进程内存锁(单实例部署可接受)
6. 单进程毫秒级 TOCTOU 窗口边界:排队后的第二个请求按完成时状态执行——start = 第二次出题覆盖(与「有意重新开始」同语义,不可区分也不该区分);evaluate = 第二条答案按推进后的当前题评估(极罕见、数据一致不损坏)
7. 复用 run 的设定与本标签页不同时以先启动者为准,有「重新开始」出口

---

# Stage 8 完成(统一全局上下文与联动 8.1 + 个人成长报告 8.2,2026-08-24)

## 完成情况表

| 任务 | 内容 | 状态 |
|---|---|---|
| 8.1a | 全局上下文派生组装(context-builder)+ 11 处管线注入 | ✅ |
| 8.1b | 联动规则服务 + LinkageHint 表 + 简历/路线图页提示横幅(按版本去重) | ✅ |
| 8.1c | 匹配输出 directionVerdict + DirectionResolution 表 + 匹配报告页冲突对比块与裁决 | ✅ |
| 8.2 | growth 命名空间(block/report/aggregate)+ 工作台成长区块 + /dashboard/growth 报告页 | ✅ |

## 主要修改(8 commit)

- `f984536` feat(orchestration):派生组装全局上下文并注入 11 处管线——`context-builder.ts` 读域表组装(用户 ID/最新画像版本/当前阶段/各 Agent 近 N 条 succeeded 产出摘要,封顶防膨胀),新用户返回空信封不抛错;11 处 `context: {}` 全部接通(profile/navigator/matching/resume/coach/interview 管线)
- `fb6dc3a` feat(db):新增 LinkageHint 与 DirectionResolution 两表,单迁移 add_linkage_tables(纯新增、无回填、不动既有 13 模型)
- `5c7e5bc` feat(matching):匹配输出 schema 新增 directionVerdict 可选字段(optional+default null,旧 3 夹具与存量 matchReport 零改动)+ prompt 第 6 推理步(比对画像声明方向)+ 2 份新样例
- `68e08ae` feat(linkage):联动规则服务与 linkage 命名空间——rules.ts 三条规则(①路线图已完成项目可加入简历 ②画像更新 → 简历/路线图需重新生成,按画像版本去重);`linkage.rules` / `linkage.dismiss`(写 dismissedAt,@@unique([userId,kind,refVersion]) 幂等)/ `linkage.resolveDirection`
- `cd4f8bd` feat(linkage):简历页「可加入简历」提示(引导手动补写,零自动修改数据)+ 简历/路线图页「画像已更新」横幅(进入页面时评估,关闭后同画像版本不再出现,新版本再现——不重复骚扰+版本隔离)
- `e466f9f` feat(linkage):匹配报告页冲突对比块——directionVerdict=conflict 时并列呈现「画像方向+依据」(绿边)与「匹配推荐+理由」(紫边+「为什么」折叠),三选一裁决落库;已有裁决 role="status" 展示已记录选择不重复询问;aligned/无字段不显示
- `f123f2b` feat(growth):成长数据层 growth 命名空间——block(画像版本数/最新匹配度/近 8 周 sparkline)/ report(版本演进+相邻版 diffRadar+diffAbilityTags/12 周任务趋势/最近 20 次匹配曲线)/ aggregate(按方向分组的平均阶段达成率,组内 <5 用户不返回,仅脱敏输出);block 与 report 独立查询(区块不嵌套报告)
- `f9195cd` feat(growth):工作台成长区块(⑤,AI 洞察与我的工作之间:版本/匹配度/近 8 周 sparkline 内联 SVG+深色 use-token-color+「查看完整报告」区块内深链)+ /dashboard/growth 报告页(版本时间线选中相邻两版 → 双线雷达+能力变化徽章/任务趋势柱状/匹配度折线/聚合卡「示例」标注);每图四态(loading 骨架/error 重试/empty 引导/data),数据不足展示引导不报错

## 测试结果

- 每个 commit 各自全量绿;**最终 911/911(94 文件)全绿**;typecheck / lint 零错误
- 新增 65 用例:context-builder 组装/空信封/注入接线、linkage 三规则检测/dismiss 去重/版本隔离/resolveDirection 落库复用、matching schema directionVerdict 有/无/旧夹具兼容、growth 三查询(阈值 5/脱敏/周桶边界/损坏数据回退)、组件(横幅出现关闭/冲突卡三选一/成长区块与报告页四态+空态引导+聚合「示例」+时间线选中相邻版本)

## DesignRules 偏差记录(自检 12 条逐项过)

1. **无新顶栏入口**(L80):报告页仅经工作台区块「查看完整报告」深链进入(决策 D1),合规
2. **首屏组件数**:工作台由 4 区块增至 5 区块,仍 ≤7 红线,合规
3. **对比块**(L40):匹配冲突对比块为计划批准的「允许对比块」形态(绿边画像+紫边匹配),合规
4. **图表纪律**:chart.green/violet 只进图表(sparkline/柱状/折线/雷达);聚合卡进度条为非图表语义,用 bg-green-500、图标用 text-green-600,记录以免误读
5. **AI 徽章**:冲突对比块的 AI 理由带 ai-insight+「为什么」折叠;成长报告各图均为统计数据(非 AI 生成),不带 ai-badge,符合「AI 内容才带徽章」
6. **匿名聚合**:聚合卡标「示例」,服务端只返回方向/样本数/均值,组内 ≥5 才返回

## 已知问题(遗留,不隐瞒)

1. **替换式路线图无历史**(生成时 deleteMany 旧路线图):报告页时间线不含路线图演进;任务完成趋势仅覆盖当前路线图的任务——历史任务随路线图替换而失联(数据边界,计划确认记为遗留)
2. **全局上下文不落库**:派生组装(读域表即时组装,无第二份状态),也意味着无跨会话上下文快照;「Agent 写入」= 写自身域模型,下一 Agent 组装时读到
3. **聚合仅 CareerPath 方向维度**;样本阈值 MIN_AGGREGATE_USERS=5 为默认常量,可后续调
4. **联动规则为「进入页面时」评估**(决策 D3),无实时推送;联动提示零自动修改用户数据(仅提示+引导手动操作,决策 D2)
5. **「共分析 N 次」口径** = 画像版本数(版本与 AgentRun 一一对应);匹配曲线来自 matching AgentRun 日志(JobMatch 单行无历史)
6. 聚合查询为全库扫描(组内计数),测试用唯一方向名隔离;数据量增大后可加索引/物化

## 下一步

Stage 8 最终验证:停 dev → 全量 npm test → typecheck → lint → build(无 dev server)→ 起 dev → curl 健康 + 新端点 401 JSON(growth.block/report/aggregate + linkage.*)→ 浏览器人工验收(同场景不重复骚扰/版本隔离/冲突块/成长页空态与数据态)。

---

# 面试对话布局优化(2026-09-04,commit 942de96)

## 背景

用户反馈:模拟面试对话态工作区仅 720px(嵌套 1160px 壳),大屏左右留白巨大;对话区 55vh 内嵌滚动与页面滚动并存(双重滚动);输入区随窄容器收缩。按「页面 Header → 状态栏 → 对话区 → 输入区」层级重组,对齐结果视图全宽先例(2.5 画像 / 3.x 路线图 / 4.8 简历)。

## 主要修改(1 commit)

- `942de96` style(interview):对话视图全宽化并消除双重滚动——对话视图 `max-w-[720px] px-4` → `w-full space-y-6 py-6`(与 profile-result / roadmap-timeline / resume-result 等 6 处结果视图逐字一致);对话区删除 `max-h-[55vh] overflow-y-auto`、p-4→p-6,页面单一纵向滚动;bottomRef 从对话区尾部移至根容器尾部(useEffect 与 deps 零改动,scrollIntoView 收敛为页面滚底,jsdom 下仍 no-op);状态栏 sticky top-16 吸顶于顶栏下方 + flex-wrap;面试官提问/追问气泡 80%→85%、用户回答保持 85%、评估卡与评估失败重试槽全宽(去 ml-10/max-w,头部徽章+双评分 pill 合并单行 flex-wrap)、STAR 提示保持 ml-10;输入区 composer 卡(rounded-card + border-hairline + bg-surface,无边框 Textarea 96px/72px + resize-y + 底行字数与绿色主 CTA),追问 composer 同款并补字数统计;同步 DesignRules(模拟面试页布局约定 + 走查记录)与 DesignSystem(页面解剖学「对话视图」宽度规则,front matter interview token 零变更)

## 验证

- interview-chat 15 用例零修改全绿;全量 **917/917(95 文件)** 全绿;typecheck / lint 零错误
- 停 dev server(taskkill PID 树)后 build 成功(/interview 8.51kB);build 后重启 dev 供人工走查
- 红线 grep:变更文件零 #hex 新色值、零 bg-white、零渐变、无 max-w-[720px] / max-h-[55vh] / max-w-[80%] 残留
- 业务逻辑零改动:出题/评估/评分/对话结构/API/状态机/题目数/Prompt 均未动

## 已知问题(遗留,不隐瞒)

1. 自动滚底为「新内容到达即滚底」(与旧内嵌滚动行为一致),未做「仅当用户在底部才跟随」的位置判断
2. 气泡 85% 上限在 1160px 壳下约 900px 行宽(用户明确要求 85–90%),走查若观感过宽可单类名回落
3. 移动端边距与结果视图一致(壳 px-4 + 对话区 p-6),无独立移动端气泡缩窄

## 下一步

浏览器人工验收(与 Stage 7 验收同批):1440/1600/1920/平板/手机宽度走查(单滚动条、状态栏吸顶与对齐、自动滚底后输入框完整可见、深色模式、IME 发送),完成后继续 Stage 7 人工验收与生产部署。

# 模拟面试报告评分展示优化(2026-09-04)

## 背景

用户要求报告页评分展示明确 10 分制、注记动态化:原「6.0 内容均分」看不出满分是多少,「基于 N 道已评估题计算」不体现总分进度与完成状态。已核实评分数据本身就是 0–10 分制(三层一致:analysis-schemas 的 contentScore/expressionScore 为 int 1–10、prompt evaluate.md 明示「1-10 整数」、前端均分仅对已评估题取确定性平均),故按用户要求只优化展示,不改评分算法。

## 主要修改

- `interview-report.tsx`:session prop 增 `questionCount`(来自 interview.get,全站唯一真实分母);Hero 右侧评分组改为「数字(text-num)+ 显式 / 10(text-body-lg ink-muted)」,标签改「内容能力/表达能力」(text-body-sm);注记改动态「已评估 {evaluated.length} / {questionCount} 题」+ 三态措辞:全部评估完成=「本次面试评分已完成」、部分=「当前评分仅供阶段性参考」;0 道已评估时不再渲染虚假 0.0 分数,仅显示「已评估 0 / N 题 · 本场暂无评分」;新增辅助文案「评分标准:10 分制 · 基于已完成题目的回答进行评估」(text-caption);数字保持独立 span(测试可精确断言)
- 测试:`interview-report.test.tsx` 断言全面更新(标签/「/ 10」×2/三态注记/评分标准文案;answers null → 0 道态断言无分数渲染);`interview-hub.test.tsx` 完成场次断言改「已评估 1 / 5 题 · 当前评分仅供阶段性参考」(mock questionCount=5,恰好验证分母动态取自场次而非写死)
- docs:DesignRules 综合报告条目与走查记录同步;progress.md 本小节

## 验证

- 全量 917/917(95 文件)全绿;typecheck / lint 零错误;停 dev server 后 build 成功
- 偶发环境问题记录:首次 vitest 运行报「vitest imported inside globalSetup」假错(并行负载,与历史记录一致),重跑即恢复,非代码问题
- 修复一处实现错误:JSX 直接引用 questionCount(ReferenceError),改组件体解构 session.questionCount 后全绿

## 数据来源与 10 分制确认

- 评分值:AI 评估 Agent 产出 contentScore/expressionScore(analysis-schemas `z.number().int().min(1).max(10)`),prompt(evaluate.md)明确「1-10 整数」;逐题评估卡与报告均分同源,不存在范围不一致
- 均分:前端对 answers 中 evaluation 非空的题取平均(一位小数),未评估题不计入分母——本次未改动该逻辑
- 分母:interview.get 返回的 questionCount(场次创建时落库),与「第 X / N 题」进度同源

## 下一步

浏览器人工验收:完成 1 道即结束 → 报告页显示「已评估 1 / 5 题 · 阶段性评分」;全部完成后显示「已评估 5 / 5 题 · 面试评分已完成」;「/ 10」与标签在深色模式下可读;刷新后注记与分数一致。

## 同日二轮:评分摘要信息压缩(视觉层级优化)

- 用户反馈:右上角评分区行数过多(分数/标签/注记/评分标准 4 行堆叠),视觉杂乱,破坏页面层级。
- 修改(仅 `interview-report.tsx` 展示层,数据逻辑零改动):
  - 评分区改**双列居中摘要**:两列横排(gap-8),每列「数字 / 10(text-num + text-body-lg ink-muted)+ 标签(text-body-sm,居中于分数下方 mt-1)」;外层 `flex flex-col items-center`,整体自成一个评分摘要块(不加卡片/边框/装饰);
  - **删除**「评分标准:10 分制 · 基于已完成题目的回答进行评估」辅助行——「/ 10」已明示满分,不再重复解释;
  - 注记压缩为一行(text-caption,居中于两列下方 mt-3):「已评估 X / N 题 · 阶段性评分」(部分)/「已评估 X / N 题 · 面试评分已完成」(全部);X 与 N 仍为真实动态值(已评估题数 / questionCount),零写死;0 道态「已评估 0 / N 题 · 本场暂无评分」不变。
- 测试:interview-report.test.tsx 与 interview-hub.test.tsx 断言同步新措辞(并移除评分标准文案断言),三态覆盖不变。
- 验证:受影响 2 文件全绿;全量 917/917;typecheck / lint 零错误;停 dev 后 build 成功。

## 同日三轮:评分标签内联(紧凑度再优化)

- 用户反馈:标签放数字下方仍偏松散,要求「6.0 /10 内容能力     5.0 /10 表达能力」一行双单元结构。
- 修改(仅 `interview-report.tsx` 展示层):每个评分单元改「数字(text-num)+ / 10(text-body-lg ink-muted)+ 标签(text-body-sm ink-muted)」三段**基线对齐同行**(flex items-baseline,间距 ml-1 / ml-2,标签字号明显小于数字);两单元横排 gap-6;注记一行(text-caption)左对齐于评分行下方(mt-2),与评分行共用左边缘,整体形成紧凑的左对齐评分模块(高度约 58px,较上轮再降约 30%);0 道态不变。
- 验证:测试断言零改动(全部为文本查询,结构与文案文本均未变),受影响 2 文件 25/25 全绿;全量 917/917;typecheck / lint 零错误;停 dev 后 build 成功。
- 同日四轮(微调):注记行改右对齐(text-right),与评分行右边缘对齐,其余不变。

# 简历中心核心内容区加宽(2026-09-04)

## 背景

用户反馈:简历中心核心卡片整体偏窄(页级 `max-w-[860px]` 收窄),左右留白大、文件名与操作按钮挤在中间,缺少与其他核心模块统一的 SaaS 工作台感。

## 主要修改(仅布局/样式)

- `src/app/(dashboard)/resumes/page.tsx`:移除 `<div className="mx-auto max-w-[860px]">` 包装,ResumeCenter 直接继承 dashboard layout 的全局 1160px 内容容器——与工作台/画像/路线图/匹配/简历优化各核心页完全同宽(优先复用既有规范,未新建宽度体系;用户建议的 1200-1280px 按 DesignRules「无新骨架」以既有 1160px 壳为准)
- `src/components/resume/resume-center.tsx`:列表行信息区(图标 + 文件名 + 大小 · 日期)加 `flex-1` 占满剩余宽度(文件名既有 truncate,不撑破布局);行内距 `p-3` → `px-4 py-3`;操作按钮组保持 `shrink-0 gap-2` 靠右不散开;整行 `items-center` 垂直居中;窄屏既有 `flex-wrap` 换行不溢出
- 功能/数据零改动:新增简历、继续优化、查看、下载、删除及其逻辑全部未触碰;resume.list 数据无 updatedAt 字段(仅有 createdAt),故列表仍显示创建日期,未为此新增 API 字段
- docs:DesignRules 新增「简历中心」布局约定小节;progress.md 本小节

## 验证

- resume-center 测试 10 用例零修改全绿(断言均为文本/角色查询);全量 917/917 全绿;typecheck / lint 零错误;停 dev 后 build 成功
- 响应式:桌面 1160px 充分利用;中宽 1024 布局正常;窄屏按钮组换行、无横向滚动(现有 flex-wrap/truncate/min-w-0 机制)

## 下一步

浏览器人工验收:工作台 → 简历中心 → 简历优化三页切换确认同宽同语言;多份简历并存时列表整齐;长文件名截断;深色模式走查。

# 文档整理:删除两份一次性验收清单(2026-09-05)

## 背景

用户整理 GitHub 仓库为求职作品集,要求 memory-bank 文档结构清晰。审查两份验收清单后执行:phase2-acceptance-checklist.md(Stage 2 验收方案,2026-08-20 生成,零引用,内容与 progress.md / implementation-plan / DesignRules 大面积重复)直接删除;stage6-acceptance-checklist.md(Stage 6 验收方案,2026-08-23 生成)将其 S1–S8 走查要点并入 progress.md Stage 6 节「下一步」后删除。两份均为一次性验收工件,原内容由 git 历史完整保留。

## 修改

- 删除 `memory-bank/phase2-acceptance-checklist.md`、`memory-bank/stage6-acceptance-checklist.md`
- Stage 6 节「下一步」:「Phase 2 整体验收」从一行概述展开为要点式走查清单(匹配主链路/纠偏/无画像降级/画像历史对比/简历多版本/分享卡片/深色模式/Phase 1 回归 + 通过标准),去掉对已删除清单文件的指针;验收前提(mock 演示数据 / 真实 Key)沿用本文件已知问题 #2,不再重复
- 顶部「当前项目状态」修正:补记 Stage 8(8.1–8.2)完成、测试基线更新为 917/95 文件(原 834/85 为 Stage 7 时点)、当前状态改为「Stage 6–8 人工验收待做」
- 模拟面试报告评分展示优化节的浏览器验收注记同步最终措辞(「阶段性评分」/「面试评分已完成」,与二轮压缩后的实际 UI 一致)
