// 演示数据种子(2026-09 游客预览):写入预置演示账号(demo@careeros.local)+ 富数据
// (画像/推荐方向/路线图/简历/匹配报告/教练计划/面试场次),供「游客预览」只读体验。
// 幂等:重复执行先清理演示账号(级联清空其全部数据)。
// 运行:npm run db:seed:demo。注意 tsx 直跑不解析 @/ 别名,本文件对 src 的引用一律相对路径
// (mock-fixtures 内部仅 type 引用 @/,运行时被擦除,不受影响)。
// 演示数据与真实用户完全隔离:账号密码公开(demo-account.ts),tRPC 层对演示账号拦截全部 mutation。
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_EMAIL, DEMO_PASSWORD } from "../src/lib/demo-account";
import type { ChatMessage } from "../src/lib/llm/adapter";
import {
  mockMatchAnalysisFixture,
  mockCoachPlanFixture,
  mockInterviewQuestionsFixture,
  mockInterviewReportFixture,
  mockResumeParseFixture,
} from "../src/lib/llm/mock-fixtures";

const prisma = new PrismaClient();

// 简历原文(演示账号的「原简历」,永远保留)
const ORIGINAL_TEXT = `张伟
后端开发工程师 · 期望城市:杭州

教育背景
中国科学技术大学 · 计算机科学与技术 · 本科(2016.09 - 2020.06)

工作经历
杭州某科技有限公司 · 后端开发工程师(2020.07 - 2023.06)
- 负责电商订单系统的开发与维护
- 参与商品服务重构
- 优化数据库查询性能

技能
Java、Spring Boot、MySQL、Redis、Docker、Git`;

// 优化后全文(演示账号的最新版本快照)
const OPTIMIZED_TEXT = `张伟
后端开发工程师 · 期望城市:杭州

教育背景
中国科学技术大学 · 计算机科学与技术 · 本科(2016.09 - 2020.06)

工作经历
杭州某科技有限公司 · 后端开发工程师(2020.07 - 2023.06)
- 负责电商订单系统开发与维护,日均处理订单 50 万笔
- 主导商品服务重构,线上故障率下降 60%
- 优化数据库查询,接口响应时间从 800ms 降低到 200ms

技能
Java、Spring Boot、MySQL、Redis、Docker、Git`;

// 目标岗位 JD(岗位匹配报告的数据源)
const JD_TEXT = `【后端开发工程师】

岗位职责:
1. 负责核心业务系统的后端设计与开发,参与系统架构优化;
2. 参与高并发场景下的性能调优与稳定性建设;
3. 与产品、前端协作,保障需求高质量交付。

任职要求:
1. 本科及以上学历,计算机相关专业;
2. 熟悉 Java 或 Python,掌握数据结构与算法;
3. 熟悉 MySQL、Redis 等常用存储与 Linux 基本操作;
4. 有实习或项目经验,了解分布式系统者优先;
5. 良好的沟通协作能力,能承受一定工作压力。`;

/** 夹具文案带开发用「Mock 演示数据」标注,演示数据对外展示前剥离 */
function cleanFixture<T>(value: T): T {
  const raw = JSON.stringify(value);
  return JSON.parse(
    raw
      .replaceAll("(Mock 演示数据)", "")
      .replaceAll("Mock 演示数据, ", "")
      .replaceAll("Mock 演示数据:", "")
  ) as T;
}

function userMessage(content: unknown): ChatMessage {
  return { role: "user", content: JSON.stringify(content) };
}

async function main() {
  // 幂等清理:删除既有演示账号(级联清空画像/简历/路线图/匹配/面试)
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });

  // 1. User(真实 bcrypt 哈希,凭据与 demo-account.ts 一致)
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "张伟",
      avatarColor: "green",
      passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
      authMethod: "password",
    },
  });
  console.log(`✓ User            ${user.name} <${user.email}>`);

  // 2. CareerProfile v1(aiAnalysis 对齐 profileAnalysisSchema:摘要/能力标签/优势/方向/雷达/建议/置信度)
  const profile = await prisma.careerProfile.create({
    data: {
      userId: user.id,
      version: 1,
      // 输入数据对齐 profileDataSchema(教育/技能/经历/兴趣/目标),保证「更新信息」表单回填一致
      education: [{ degree: "本科", major: "计算机科学与技术", school: "中国科学技术大学", graduationYear: 2020 }],
      skills: [
        { name: "Java", level: "精通" },
        { name: "Spring Boot", level: "精通" },
        { name: "MySQL", level: "熟练" },
        { name: "Redis", level: "熟练" },
        { name: "Docker", level: "熟练" },
        { name: "Git", level: "熟练" },
      ],
      experiences: [
        {
          type: "internship",
          organization: "杭州某科技有限公司",
          role: "后端开发工程师",
          description:
            "负责电商订单系统的开发与维护;主导商品服务重构,线上故障率下降 60%;优化数据库查询,接口响应时间从 800ms 降到 200ms",
          startDate: "2020-07",
          endDate: "2023-06",
        },
      ],
      interests: ["后端工程", "分布式系统"],
      targets: ["后端开发工程师"],
      aiAnalysis: {
        summary:
          "具备扎实的 Java 后端工程基础与三年真实工作经验:主流存储与容器工具熟练,工程化习惯良好,习惯用量化指标描述成果;短板集中在高并发与分布式系统的实战深度,建议通过针对性项目补齐后投递目标岗位。",
        abilityTags: [
          { name: "Java", level: "精通" },
          { name: "Spring Boot", level: "精通" },
          { name: "MySQL", level: "熟练" },
          { name: "Redis", level: "熟练" },
          { name: "Docker", level: "熟练" },
          { name: "分布式系统", level: "基础" },
        ],
        strengths: [
          { title: "后端工程经验扎实", detail: "三年电商订单系统开发与维护,有完整的性能优化与重构实践" },
          { title: "数据意识强", detail: "习惯用量化指标描述工作成果,沟通表达有数据支撑" },
          { title: "学习路径清晰", detail: "能围绕岗位要求主动补齐技术短板" },
        ],
        directions: [
          {
            name: "后端开发工程师",
            matchScore: 82,
            reason: "技术栈与经验高度对口,工程化能力直接匹配",
            strengths: ["Java 与 Spring Boot 熟练", "三年后端开发经验", "性能优化实战"],
            weaknesses: ["高并发场景经验不足", "分布式中间件深度有限"],
          },
          {
            name: "测试开发工程师",
            matchScore: 68,
            reason: "工程思维与质量意识可迁移,需补充自动化测试体系",
            strengths: ["编码能力强", "熟悉 CI 流程"],
            weaknesses: ["缺乏测试框架实战", "质量保障方法论不足"],
          },
          {
            name: "数据分析工程师",
            matchScore: 61,
            reason: "SQL 功底扎实,数据意识突出,统计与建模能力待补",
            strengths: ["SQL 熟练", "业务理解力好"],
            weaknesses: ["统计分析基础薄弱", "缺少数据产品经验"],
          },
        ],
        radar: { 产品: 35, 技术: 85, 数据: 70, 沟通: 62, 项目: 78, 行业: 45 },
        suggestions: [
          {
            gap: "高并发与分布式实战",
            action: "完成一个基于 Redis + 消息队列的秒杀或订单削峰项目,整理成可展示的作品",
          },
          {
            gap: "Linux 工程化操作",
            action: "用 2 周时间系统练习 Linux 常用命令与线上排查,产出操作手册",
          },
          {
            gap: "技术叙事表达",
            action: "用 STAR + 量化结果的方式重写两段核心项目经历",
          },
        ],
        confidence: { level: "中", note: "经历信息完整,但缺少近期项目细节,建议补充后更新画像以提高结论可信度" },
      },
    },
  });
  console.log(`✓ CareerProfile   v1(六维雷达 + 3 推荐方向)`);

  // 3. CareerPath(与 aiAnalysis.directions 一一对应)
  const paths = [
    { directionName: "后端开发工程师", matchScore: 82, strengths: ["Java 与 Spring Boot 熟练", "三年后端开发经验"], weaknesses: ["高并发场景经验不足"] },
    { directionName: "测试开发工程师", matchScore: 68, strengths: ["编码能力强"], weaknesses: ["缺乏测试框架实战"] },
    { directionName: "数据分析工程师", matchScore: 61, strengths: ["SQL 熟练"], weaknesses: ["统计分析基础薄弱"] },
  ];
  for (const p of paths) {
    await prisma.careerPath.create({ data: { profileId: profile.id, ...p } });
  }
  console.log(`✓ CareerPath      ${paths.map((p) => `${p.directionName}(${p.matchScore}%)`).join(" / ")}`);

  // 4. Roadmap → Stage → Task(content 对齐 stageContentSchema:学习内容/实践项目/资源/检查点;任务三态覆盖)
  const roadmap = await prisma.roadmap.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      targetDirection: "后端开发工程师",
      weeklyHours: 10,
      currentStage: "有一定基础",
      summary: {
        totalDuration: "10 周",
        stageCount: 3,
        finalGoal: "达到后端开发工程师岗位要求,补齐高并发项目实战经验",
      },
    },
  });
  const stageDefs = [
    {
      name: "夯实工程基础",
      goal: "补强 Linux 与存储基础,建立工程化操作能力",
      estimatedDuration: "3 周",
      content: {
        learningContent: ["Linux 常用命令与线上排查", "MySQL 索引与查询优化", "Redis 核心数据结构与持久化"],
        practiceProjects: [{ title: "搭建 Linux 开发环境并完成日志分析练习", deliverable: "Linux 操作手册与日志分析报告" }],
        resources: ["《MySQL 实战 45 讲》", "Redis 官方文档"],
        checkpoints: ["能独立完成线上日志定位与慢查询分析"],
      },
      tasks: [
        { description: "学习 Linux 常用命令", type: "学习", status: "completed", order: 1, completedAt: new Date(Date.now() - 3 * 864e5) },
        { description: "完成日志分析练习", type: "实践项目", status: "in_progress", order: 2, completedAt: null },
      ],
    },
    {
      name: "高并发项目实战",
      goal: "通过秒杀项目补齐高并发与分布式短板",
      estimatedDuration: "4 周",
      content: {
        learningContent: ["分布式锁与缓存一致性", "消息队列削峰", "压测工具与性能分析"],
        practiceProjects: [{ title: "分布式秒杀系统", deliverable: "可运行的秒杀服务 + 压测报告(QPS≥3000)" }],
        resources: ["Apache JMeter 官方文档"],
        checkpoints: ["压测报告达标,接口 P99 < 300ms"],
      },
      tasks: [
        { description: "学习分布式锁与缓存一致性", type: "学习", status: "pending", order: 1, completedAt: null },
        { description: "开发分布式秒杀系统", type: "实践项目", status: "pending", order: 2, completedAt: null },
      ],
    },
    {
      name: "求职冲刺",
      goal: "把项目经历转化为简历与面试表达",
      estimatedDuration: "3 周",
      content: {
        learningContent: ["STAR 表达法", "后端高频面试题", "项目复盘与成果量化"],
        practiceProjects: [{ title: "重写两段核心项目经历并模拟面试", deliverable: "优化后的简历版本 + 模拟面试报告" }],
        resources: [],
        checkpoints: ["简历 ATS 评分 ≥ 80,完成一次完整模拟面试"],
      },
      tasks: [
        { description: "用 STAR 重写项目经历", type: "学习", status: "pending", order: 1, completedAt: null },
      ],
    },
  ];
  for (let stageIndex = 0; stageIndex < stageDefs.length; stageIndex++) {
    const def = stageDefs[stageIndex];
    const stage = await prisma.stage.create({
      data: {
        roadmapId: roadmap.id,
        name: def.name,
        goal: def.goal,
        order: stageIndex + 1,
        estimatedDuration: def.estimatedDuration,
        content: def.content,
      },
    });
    for (const task of def.tasks) {
      await prisma.task.create({
        data: {
          stageId: stage.id,
          description: task.description,
          type: task.type,
          status: task.status,
          order: task.order,
          completedAt: task.completedAt,
        },
      });
    }
  }
  console.log(`✓ Roadmap+Stage  3 阶段 / 5 任务(三态)`);

  // 5. Resume → ResumeVersion → Optimization(ATS 报告对齐 atsReportSchema)
  const resume = await prisma.resume.create({
    data: {
      userId: user.id,
      originalText: ORIGINAL_TEXT,
      parsedData: mockResumeParseFixture() as Prisma.InputJsonValue,
      fileName: "张伟-后端开发工程师.pdf",
      mimeType: "application/pdf",
      sizeBytes: 48213,
    },
  });
  const version = await prisma.resumeVersion.create({
    data: {
      resumeId: resume.id,
      targetDirection: "后端开发工程师",
      optimizedText: OPTIMIZED_TEXT,
      changes: { count: 3 },
      atsScore: 85,
      atsReport: {
        total: 85,
        level: "优秀",
        ruleSubscores: { sections: 90, quantified: 75, keywords: 85, actionVerbs: 80, length: 90, parseability: 88 },
        ruleScore: 84,
        llmSubscores: { contentQuality: 4, relevance: 5 },
        suggestions: [
          { title: "补充项目量化指标", detail: "项目经历中补充请求量、性能提升幅度等可衡量结果,增强说服力" },
          { title: "强化岗位关键词", detail: "围绕目标岗位 JD 的关键词,调整技能与经历描述的措辞" },
          { title: "精简技能列表", detail: "技能列表按目标岗位相关度排序,控制在一屏内" },
        ],
      },
    },
  });
  const optimizations = [
    {
      category: "量化表达",
      originalText: "负责电商订单系统的开发与维护",
      optimizedText: "负责电商订单系统开发与维护,日均处理订单 50 万笔",
      reason: "补充业务规模,让经历更可感知",
      status: "accepted",
      order: 1,
    },
    {
      category: "动词开头",
      originalText: "参与商品服务重构",
      optimizedText: "主导商品服务重构,线上故障率下降 60%",
      reason: "用结果动词开头并补充量化成效",
      status: "accepted",
      order: 2,
    },
    {
      category: "关键词",
      originalText: "熟悉 MySQL、Redis",
      optimizedText: "熟练使用 MySQL、Redis,并了解其在高并发场景下的调优",
      reason: "技能描述与岗位关键词对齐",
      status: "pending",
      order: 3,
    },
  ];
  for (const opt of optimizations) {
    await prisma.optimization.create({ data: { resumeVersionId: version.id, ...opt } });
  }
  console.log(`✓ Resume          1 简历 / ${optimizations.length} 条优化记录(ATS ${version.atsScore})`);

  // 6. JobMatch(matchReport 与 coachPlan 由 Mock 夹具产出,剥离开发标注后落库)
  const matchReport = cleanFixture(mockMatchAnalysisFixture()) as {
    directionVerdict?: { alignedDirection?: string };
  };
  // 夹具的方向裁决字段与演示画像保持一致,避免演示环境误报「方向冲突」
  if (matchReport.directionVerdict) {
    matchReport.directionVerdict.alignedDirection = "后端开发工程师";
  }
  const coachPlan = cleanFixture(
    mockCoachPlanFixture([
      userMessage({
        weeklyHours: 10,
        requirements: [
          { name: "Redis 与 Linux 工程实践", importance: 4, gap: "大" },
          { name: "高并发与分布式实战", importance: 5, gap: "大" },
          { name: "沟通协作", importance: 3, gap: "中" },
        ],
      }),
    ])
  );
  await prisma.jobMatch.create({
    data: {
      userId: user.id,
      jdText: JD_TEXT,
      jdTitle: "后端开发工程师",
      weeklyHours: 10,
      matchReport: matchReport as Prisma.InputJsonValue,
      coachPlan: coachPlan as Prisma.InputJsonValue,
    },
  });
  console.log(`✓ JobMatch        匹配度 78(报告 + 13 周教练计划)`);

  // 7. InterviewSession(行为面 5 题已完成:题目/逐题作答与评估/综合报告)
  // 存储形状:row.questions = 题目数组(interviewQuestionsSchema 外层 { questions } 由读取方补齐)
  const questions = cleanFixture(
    mockInterviewQuestionsFixture([
      userMessage({ questionCount: 5, targetPosition: "后端开发工程师", resumeText: "电商订单系统开发与维护" }),
    ])
  ).questions;
  const answers = [
    {
      questionId: "q-1",
      answer:
        "我本科就读于中国科学技术大学计算机专业,毕业后在杭州某科技公司做了三年后端开发,主要负责电商订单系统的开发与维护,同时主导了商品服务重构。我对后端工程和分布式系统方向有持续的学习热情,这也是我应聘后端开发工程师岗位的原因。",
      evaluation: {
        contentScore: 8,
        expressionScore: 7,
        improvementSuggestion: "介绍结构清晰,经历与岗位相关;建议在自我介绍中补一个量化成果,让第一印象更有说服力。",
      },
      followUpQuestion: null,
      followUpAnswer: null,
    },
    {
      questionId: "q-2",
      answer:
        "这段经历里我主要负责订单模块的开发和日常维护。遇到的最大困难是促销期间订单量激增,数据库查询变慢,接口响应时间一度接近 800 毫秒。我通过分析慢查询日志,给核心查询补充索引,并把热点数据缓存到 Redis,最终把响应时间降到 200 毫秒左右。",
      evaluation: {
        contentScore: 8,
        expressionScore: 7,
        improvementSuggestion: "回答有背景、做法和结果,结构完整;可以补充为什么选择这些优化手段,体现你的取舍判断。",
      },
      followUpQuestion: "你提到把热点数据缓存到 Redis,当时有没有遇到缓存一致性的问题?你是怎么处理的?",
      followUpAnswer:
        "有遇到过。下单后库存数据会变化,直接缓存会出现不一致。我们采用了先更新数据库再删除缓存的方案,并给缓存设置了较短的过期时间作为兜底。",
    },
    {
      questionId: "q-3",
      answer:
        "我在商品服务重构时用过一次比较完整的实践。当时商品服务的接口耦合严重,每次改动都要回归大量用例。我主导把服务拆成商品、库存两个模块,用消息队列做异步解耦。踩过的坑是消息重复消费,后来通过消费端幂等处理解决,最终线上故障率下降了 60%。",
      evaluation: {
        contentScore: 8,
        expressionScore: 7,
        improvementSuggestion: "案例真实、有踩坑和解决过程;建议补充服务拆分前后的对比数据,让改进效果更直观。",
      },
      followUpQuestion: null,
      followUpAnswer: null,
    },
    {
      questionId: "q-4",
      answer:
        "我会先评估缺陷的影响范围和严重程度:如果只影响边缘场景,我会准备回滚方案并同步给产品;如果影响核心流程,我会把风险明确上报,给出「延期上线」和「按时上线+降级方案」两个选项,让产品和技术负责人一起决策。上线前我会安排关键路径的回归测试。",
      evaluation: {
        contentScore: 8,
        expressionScore: 7,
        improvementSuggestion: "思路清晰,体现了风险分级和向上同步的意识;可以补充你会如何推动各方快速达成一致。",
      },
      followUpQuestion: "如果产品坚持必须按时上线,你会怎么给技术兜底?",
      followUpAnswer:
        "我会优先准备降级方案:把缺陷模块切到备用路径,保证核心流程可用,同时安排发布后的快速修复窗口,并在回归中覆盖最坏情况。",
    },
    {
      questionId: "q-5",
      answer:
        "我比较关心两个方面:一是团队目前的技术栈和后续的演进方向,二是这个岗位未来半年最需要解决的技术问题是什么,这样我能判断自己的准备方向是否匹配。",
      evaluation: {
        contentScore: 8,
        expressionScore: 7,
        improvementSuggestion: "提问有针对性,关注点务实;建议再补充一个关于团队协作方式的提问,展现对融入团队的思考。",
      },
      followUpQuestion: null,
      followUpAnswer: null,
    },
  ];
  const report = cleanFixture(mockInterviewReportFixture());
  await prisma.interviewSession.create({
    data: {
      userId: user.id,
      interviewType: "行为面",
      questionCount: 5,
      targetPosition: "后端开发工程师",
      resumeText: "电商订单系统开发与维护",
      status: "completed",
      questions: questions as unknown as Prisma.InputJsonValue,
      currentQuestionIndex: 5,
      answers: answers as Prisma.InputJsonValue,
      report: report as Prisma.InputJsonValue,
    },
  });
  console.log(`✓ Interview       行为面 5 题已完成(逐题评估 + 综合报告)`);

  console.log("\n演示数据就绪:「游客预览」可用演示账号只读体验全部核心能力。");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
