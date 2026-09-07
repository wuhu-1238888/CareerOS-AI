# 05 项目模板(Project Template)

> 版本:v1.0 | 最后更新:2026-09-07 | 配套:[01-AI-PRODUCT-DEVELOPMENT-SOP.md](01-AI-PRODUCT-DEVELOPMENT-SOP.md)

**定位**:未来新项目可直接复制的目录结构与文档骨架。**每个文件都来自 CareerOS 的真实结构,零发明文件**——CareerOS 没有的文件(如独立 problem-analysis.md)一律不进模板。本文档只描述模板;实际落盘是新项目启动(06 文档 Step 0)的动作。

---

## 一、目录结构树

```
project/
├── CLAUDE.md                    # [必需] AI 协作规则(git 自动化 + 工作纪律,见第四节)
├── README.md                    # [后期] Stage 15 创建,入口索引
├── memory-bank/                 # [必需] 产品与工程的「记忆」,AI 每次会话的上下文来源
│   ├── product-vision.md        #   Stage 01 产物
│   ├── user-persona.md          #   Stage 02 产物
│   ├── competitor-analysis.md   #   Stage 03 产物(可轻量)
│   ├── PRD.md                   #   Stage 04 产物
│   ├── product-architecture.md  #   Stage 05 产物
│   ├── agent-design.md          #   Stage 06 产物
│   ├── technical-design.md      #   Stage 07 产物
│   ├── implementation-plan.md   #   Stage 09 产物(执行期持续回写)
│   ├── progress.md              #   执行期持续维护(执行日志)
│   └── deployment-checklist.md  #   Stage 16 产物(可延后)
├── design/                      # [必需] Stage 08 产物
│   ├── DesignRules.md           #   硬约束 + 自检清单
│   └── DesignSystem.md          #   token 单一事实来源 + 组件规范
├── docs/                        # [后期] Stage 15 产物
│   ├── demo-flow.md             #   验收脚本
│   ├── screenshots/             #   产品截图
│   └── project-workflow/        #   [可选] Stage 17 方法论沉淀(本套文档)
├── src/                         # 代码(结构随技术栈,不在本模板约束)
├── scripts/                     # 一次性脚本(用完即删;常驻的提交进来)
└── .claude/                     # [可选] 工具配置(settings.local.json 等)
```

- 不需要 `problem-analysis.md` / `tech-stack.md` 等独立文件:问题定义在 PRD 开篇,技术栈在 technical-design 内——CareerOS 就是这么做的,拆开只会制造文档重复与不同步。
- 不要提前创建空文件:「Stage X 产物」意味着到那个 Stage 才创建,启动第一天只建目录与 CLAUDE.md。

## 二、memory-bank 模板骨架

所有文档共用格式约定:顶部引用块元信息行 `> 版本:v1.x | 最后更新:YYYY-MM-DD`(无 YAML frontmatter,与 CareerOS 一致);正文以表格为主要表达;架构用 ASCII 图;每次修订必须更新版本/日期。

### product-vision.md(Stage 01)

```
- 定位一句话(为谁、解决什么问题、凭什么)
- 核心问题(用户今天怎么解决、哪里不爽)
- 成功标准(可度量;至少一条全局验收锚点,如「注册→核心闭环 < 5 分钟」)
- 边界:做什么(3-5 条)/ 明确不做什么(带理由)
```

### user-persona.md(Stage 02)

```
- Persona 1-N:画像 / 使用场景(何时何地用)/ 核心痛点 / 当前替代方案
- 目标用户一句话确认(人拍板)
```

### competitor-analysis.md(Stage 03,可轻量)

```
- 竞品/替代方案矩阵(核心功能 / 定价 / 目标用户 / AI 能力)
- 差异点一句话
- 结论:卡位 / 蓝海 / 伪需求判断
```

### PRD.md(Stage 04)

```
- 问题定义(开篇章节,即「问题与需求分析」)
- FR 表:| 编号 | 功能 | 描述 | 优先级(P0/P1/P2)| 验收口径 |
- NFR(性能/安全/兼容)
- 明确不做清单:| 项 | 来源 | 理由 |(每项带来源,如 FR-30)
```

### product-architecture.md(Stage 05)

```
- 信息架构(导航/页面树)
- 模块划分 + 依赖图(ASCII)
- 数据流与联动关系表
- 【显式标出核心数据源模块】
```

### agent-design.md(Stage 06)

```
- 逐 FR 的「规则 or AI」判定表
- Agent 清单:职责 / 输入 / 输出 schema / 失败策略 / 评测方式(样例集)
- 决策点裁决方式表(「AI 建议人裁决」or「AI 自动执行」)
- AI 边界清单(哪些绝不自动执行)
```

### technical-design.md(Stage 07)

```
- 技术选型对比表(候选 / 优劣 / 结论 / 人确认)
- 数据模型(覆盖产品架构全部实体)
- API 层约定(错误码 / 鉴权 / 流式)
- 安全策略
- 实施架构决策补记(执行期回写,不回头改正文)
```

### implementation-plan.md(Stage 09,核心操作文档)

```
- 头部声明:任务粒度 = 一次独立工作会话;完成后 commit + progress 勾选
- 任务模板(四段式)+ 状态行格式(见 03 文档第三节)
- 分层测试策略表(5 层,引用 04 文档)
- 开发节奏约定:一次一个任务;里程碑 = 验收检查点;基础优先
- 全局原则 5 条(01 文档第二节)
- 偏差记录约定:与上游不一致在此标注,执行以计划为准
- Phase/里程碑/任务列表(每个任务四段式 + 验收标准)
- 「明确不做/延后」清单(带来源)
```

### progress.md(执行日志,持续维护)

```
- 头部:当前测试基线(文件数/用例数,随任务更新)
- 每阶段完成节:完成情况表(任务/内容/状态/commit)+ 主要修改 + 测试结果 + 已知问题(遗留,不隐瞒)+ 下一步
- 修订节(重大故障复盘):背景 / 现象与根因 / 实施 / 验证 / 已知取舍
- 已解决的问题清单(编号,环境/框架坑为主)
- 未解决的问题清单(编号滚动:| # | 问题 | 影响 | 处置计划 | 状态 |)
```

### deployment-checklist.md(Stage 16,可延后)

```
- 环境变量 / 存储 / 监控 / 隐私合规,逐项 `- [ ]` 勾选
- 每项标注「验证实际生效」的方式(防配置静默失效)
```

## 三、design 模板骨架(Stage 08)

### DesignRules.md(硬约束)

```
- 与 DesignSystem 的分工声明(一个定义「是什么」,一个规定「必须/禁止」)
- UI 原则(2-3 条,如「专业克制」)
- 组件使用规则(按钮/卡片/导航——必须用哪个、禁止用哪个)
- 逐页页面规则(页面 = 目标 / 必备区块 / 页面专属禁令)
- 禁止事项(如:禁止硬编码色值)
- 提交前自检清单(编号,含 grep 命令)
- 走查记录节(每次走查结论追加)
```

### DesignSystem.md(token + 规范)

```
- front matter = token 唯一事实来源(colors/typography/spacing/rounded/shadows/components)
- 正文章节:品牌 / 色彩语义 / 排版规则 / 布局解剖 / 组件规格 —— 每章以可执行规则收尾
- 迭代指南(何时可以新增 token:先改本文档,再改代码)
```

> 可选:第三方设计方法论分析(如 CareerOS 的 Atlassian.md/Linear.md)——吸收思路、禁止复制外观。

## 四、CLAUDE.md 模板(全文骨架)

```markdown
# 项目规则

## 自动 Git 提交与推送
(任务/阶段完成后默认自动 commit + push,不再询问)
### 标准流程
1. git status → 2. 检查修改内容 → 3. 确认无敏感信息 → 4. 跑测试/lint/build → 5. 逐文件选择性 add → 6. conventional commit → 7. push → 8. 汇报
### 必须暂停并询问的情况
冲突 / 远端漂移 / 命令失败无法安全解决 / 敏感文件 / 危险操作
### 禁止操作
push --force / reset --hard / clean -fd / 删远程分支 / 覆盖历史
### 关于 git add
不机械 git add .;只提交本任务相关且确认安全的文件
```

> 其余环境纪律(单 dev server 等)按 03 文档第四节逐条加入;CLAUDE.md 是 AI 每次会话必读的规则,内容越少越有效。

## 五、docs/demo-flow.md 模板(Stage 15)

```
- 声明:基于当前代码的真实实现,全部步骤可在 Mock 模式零成本复现
- 步骤 1-N(沿产品闭环顺序),每步四段:
  - 做什么(操作)
  - 看什么(预期界面 = 验收断言)
  - 为什么重要(产品逻辑)
  - 体现的能力(工程实现)
- 可选段(增强功能演示)
- 演示贴士(Mock 免 Key / 恢复路径 / 响应式演示点)
```

## 六、命名与格式约定

- **元信息行**:`> 版本:v1.x | 最后更新:YYYY-MM-DD`(无 YAML frontmatter)
- **表格优先**:FR 表、竞品矩阵、完成情况表、遗留清单——表格是主干,散文是补充
- **ASCII 图**:架构/流程图不用图片,保持可 grep、可 diff
- **Commit**:conventional commits + 中文描述 + 任务编号括号,如 `feat(profile): 画像分析管线(2.4)`;scope = 模块名或技术层
- **章节编号**:规划类文档用中文「一、二、三」;计划用「Phase/M/任务 x.y」;进度用「# Stage N 完成」
- **路径与数字必须可对账**:README 的测试数、文档引用路径、截图文件名,定期与事实核对(不一致 = 失败模式 #11)
