// Mock 模式内置演示数据(2026-08 补):LLM_PROVIDER=mock 时,默认 Mock 适配器按 Agent 名分发
// schema 合规的 JSON(而非回显纯文本),使浏览器端可走通「匹配 → 教练 → 模拟面试」全链路验收。
// 数据为演示性质:匹配报告为固定夹具(与 6.1 样例集同源,已通过 schema 与手工标注);
// 教练计划由输入动态生成(weeklyHours 原样回显 + 差距清单推导优先级矩阵 + 预算内 13 周);
// 面试题由输入动态生成(题数恒等于档位 + 五类题型全覆盖,保证出题管线 echo 校验与 schema 恒过)。
// 真实 LLM 质量验证仍待 DeepSeek Key(progress.md 遗留 #1)。
import type { ChatMessage } from "./adapter";
import type { MatchAnalysis } from "@/lib/matching/analysis-schemas";
import type { CoachPlan } from "@/lib/coach/analysis-schemas";
import type { InterviewQuestions, InterviewQuestionType } from "@/lib/interview/analysis-schemas";

/** 匹配演示数据:与 agents/__tests__/matching-samples.ts 的 backend-with-profile 样例同源(schema 已验证) */
export function mockMatchAnalysisFixture(): MatchAnalysis {
  return {
    positionTitle: "后端开发工程师",
    summary:
      "技术栈与实习经历与岗位要求基本匹配,缺少高并发实战与深度项目经验,建议针对短板补课后投递。(Mock 演示数据)",
    requirements: [
      { id: "req-1", text: "本科及以上学历,计算机相关专业", category: "显性", importance: 4 },
      { id: "req-2", text: "熟悉 Python 或 Java,了解数据结构与算法", category: "显性", importance: 5 },
      { id: "req-3", text: "熟悉 MySQL、Redis 等常用存储与 Linux 基本操作", category: "显性", importance: 4 },
      { id: "req-4", text: "有实习或项目经验", category: "显性", importance: 4 },
      { id: "req-5", text: "良好的沟通协作能力,能承受工作压力", category: "隐性", importance: 3 },
    ],
    items: [
      { requirementId: "req-1", status: "达标", matchType: "直接", userEvidence: "计算机科学与技术专业本科在读", gap: "无明显差距" },
      { requirementId: "req-2", status: "达标", matchType: "直接", userEvidence: "Python 熟练,两段后端开发经历均使用 Python", gap: "无明显差距" },
      { requirementId: "req-3", status: "接近", matchType: "间接", userEvidence: "SQL 熟练,实习中接触过 MySQL;Redis 与 Linux 仅课程了解", gap: "缺少 Redis 与 Linux 的工程实践经验" },
      { requirementId: "req-4", status: "达标", matchType: "直接", userEvidence: "后端实习 3 个月 + 校园二手交易平台后端开发", gap: "无明显差距" },
      { requirementId: "req-5", status: "接近", matchType: "可迁移", userEvidence: "实习中与前端、测试协作联调,团队协作基础良好", gap: "沟通协作证据有限,压力场景经历未体现" },
    ],
    overallScore: 78,
    recommendation: {
      level: "建议补课后投递",
      reason: "核心技术要求达标,存储与高并发实战经验偏弱,补一两个工程实践项目后可投递",
    },
    jobRadar: { 产品: 30, 技术: 90, 数据: 55, 沟通: 60, 项目: 70, 行业: 40 },
    resumeSuggestions: [
      { requirementId: "req-3", suggestion: "补充 Redis 与 Linux 相关课程或实验经历,突出 SQL 实践" },
      { requirementId: "req-5", suggestion: "补充一次跨团队协作或项目推进中解决分歧的案例" },
    ],
  };
}

/** 从消息中容错解析教练输入(最后一条用户消息为 JSON);解析失败回退默认值,保证 Mock 恒有可用输出 */
function parseCoachInput(messages: ChatMessage[]): {
  weeklyHours: number;
  requirements: { name: string; importance: number; gap: "大" | "中" | "小" }[];
} {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  let raw: { weeklyHours?: unknown; requirements?: unknown } = {};
  try {
    raw = JSON.parse(lastUser?.content ?? "{}");
  } catch {
    // 非 JSON 输入:走下方回退
  }
  const weeklyHours =
    Number.isInteger(raw.weeklyHours) &&
    (raw.weeklyHours as number) >= 1 &&
    (raw.weeklyHours as number) <= 80
      ? (raw.weeklyHours as number)
      : 10;
  const requirements = Array.isArray(raw.requirements)
    ? raw.requirements
        .filter(
          (r): r is { name: string; importance: number; gap: "大" | "中" | "小" } =>
            !!r &&
            typeof r.name === "string" &&
            r.name.length > 0 &&
            Number.isInteger(r.importance) &&
            r.importance >= 1 &&
            r.importance <= 5 &&
            (r.gap === "大" || r.gap === "中" || r.gap === "小")
        )
        .slice(0, 8)
        .map((r) => ({ name: r.name.slice(0, 50), importance: r.importance, gap: r.gap }))
    : [];
  return { weeklyHours, requirements };
}

/** 与 coachPlanSchema superRefine 同源的优先级规则(P0:重要≥4 且差距大;P1:(重要≥4 且差距非大)或(重要=3 且差距大);其余 P2) */
function expectedPriority(importance: number, gap: "大" | "中" | "小"): "P0" | "P1" | "P2" {
  if (importance >= 4 && gap === "大") return "P0";
  if ((importance >= 4 && gap !== "大") || (importance === 3 && gap === "大")) return "P1";
  return "P2";
}

const GAP_RANK = { 大: 2, 中: 1, 小: 0 } as const;

/** 教练演示数据:weeklyHours 原样回显(管线 echo 交叉校验依赖);矩阵由差距清单推导;13 周每周 1 任务且不超预算 */
export function mockCoachPlanFixture(messages: ChatMessage[]): CoachPlan {
  const { weeklyHours, requirements } = parseCoachInput(messages);

  const matrixEntries = requirements.map((r) => ({
    skill: r.name,
    importance: r.importance,
    gapSize: r.gap,
    priority: expectedPriority(r.importance, r.gap),
    reason: `Mock 演示数据:重要性 ${r.importance} × 差距「${r.gap}」自动定级`,
  }));
  // 按重要性降序、差距(大>中>小)降序(schema 排序约束)
  matrixEntries.sort(
    (a, b) => b.importance - a.importance || GAP_RANK[b.gapSize] - GAP_RANK[a.gapSize]
  );
  const priorityMatrix: CoachPlan["priorityMatrix"] =
    matrixEntries.length > 0
      ? matrixEntries
      : [{ skill: "目标岗位核心技能", importance: 5, gapSize: "大", priority: "P0", reason: "Mock 演示数据:默认差距清单" }];

  // 单任务时长:20-120 分钟、上限不超每周预算一半(每周 Σ ≤ weeklyHours×60 恒成立)
  const taskMinutes = Math.min(120, Math.max(20, weeklyHours * 30));
  const themes = [
    "差距梳理与目标拆解",
    "核心概念补强",
    "基础工具上手",
    "第一个小练习",
    "练习复盘与修正",
    "进阶主题入门",
    "进阶主题实战",
    "综合实践项目",
    "项目优化打磨",
    "成果整理与简历化",
    "表达与协作训练",
    "模拟面试",
    "冲刺与查漏补缺",
  ];
  const weeks = themes.map((theme, i) => ({
    week: i + 1,
    theme,
    tasks: [
      {
        title: `${theme}:学习与练习`,
        estimatedMinutes: taskMinutes,
        deliverable: "学习笔记与练习记录",
        completionCriteria: "能用自己的话解释本周核心概念,并完成配套练习",
      },
    ],
  }));

  return {
    weeklyHours,
    priorityMatrix,
    weeks,
    milestones: [
      { week: 4, title: "完成首个实践练习并输出复盘" },
      { week: 8, title: "完成综合实践项目(Mock 演示数据)" },
      { week: 13, title: "完成模拟面试与整体复盘" },
    ],
    resources: [
      { title: "官方文档入门指南", type: "文档", cost: "free", url: "", note: "Mock 演示数据,不虚构具体链接" },
      { title: "经典入门书籍(图书馆/二手渠道)", type: "书籍", cost: "paid", url: "" },
      { title: "公开课与视频教程", type: "视频", cost: "free", url: "" },
    ],
    risks: [
      { risk: "周期较长难以坚持(Mock 演示数据)", mitigation: "每周固定学习时间,并加入学习社群打卡" },
      { risk: "理论与实践脱节", mitigation: "先实践后理论,用项目问题倒逼理解" },
    ],
  };
}

/** 从消息中容错解析出题输入(最后一条用户消息为 JSON);解析失败回退默认值,保证 Mock 恒有可用输出 */
function parseQuestionInput(messages: ChatMessage[]): {
  questionCount: 5 | 10 | 15;
  targetPosition: string;
  resumeText: string;
} {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  let raw: { questionCount?: unknown; targetPosition?: unknown; resumeText?: unknown } = {};
  try {
    raw = JSON.parse(lastUser?.content ?? "{}");
  } catch {
    // 非 JSON 输入:走下方回退
  }
  const questionCount = raw.questionCount === 10 || raw.questionCount === 15 ? raw.questionCount : 5;
  const targetPosition =
    typeof raw.targetPosition === "string" && raw.targetPosition.trim().length > 0
      ? raw.targetPosition.trim().slice(0, 100)
      : "目标岗位";
  const resumeText = typeof raw.resumeText === "string" ? raw.resumeText : "";
  return { questionCount, targetPosition, resumeText };
}

/** 取简历首段非空行作为题目出处(演示数据锚点;简历为空时回退通用出处) */
function resumeSnippet(resumeText: string): string {
  const line = resumeText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)[0];
  return line ? line.slice(0, 100) : "简历中的相关经历";
}

type QuestionSeed = {
  type: InterviewQuestionType;
  question: (position: string, snippet: string) => string;
  followUpHints: string[];
};

// 题目池:前 5 道覆盖五类题型各 1(5/10/15 三档均满足 schema「五类各至少 1」);
// 第 6-15 道按经历深挖/技术案例/情景假设补足,任何档位切片都含全部五类。
const QUESTION_POOL: QuestionSeed[] = [
  { type: "自我介绍", question: (pos) => `请围绕${pos}这个岗位做一个 1 分钟左右的自我介绍,重点说说你与这个岗位最相关的经历。(Mock 演示数据)`, followUpHints: ["追问简历中最亮眼的项目细节", "追问为什么选择这个方向"] },
  { type: "经历深挖", question: (_, snippet) => `你在简历中提到「${snippet}」,这段经历里你具体负责什么?遇到过什么困难,是怎么解决的?(Mock 演示数据)`, followUpHints: ["追问量化成果的具体数字", "追问你在团队中的角色"] },
  { type: "技术案例", question: (pos) => `针对${pos}岗位最常用的核心技术,请讲一个你实际动手做过的案例:背景、你的实现思路、踩过的坑。(Mock 演示数据)`, followUpHints: ["追问方案选型的权衡", "追问性能或边界的处理"] },
  { type: "情景假设", question: () => `假设你在项目上线前三天发现一个关键模块有严重缺陷,而产品要求必须按时上线,你会怎么做?(Mock 演示数据)`, followUpHints: ["追问如何向上同步风险", "追问补救方案的优先级排序"] },
  { type: "反问", question: () => `面试接近尾声,如果你现在可以向面试官提问,你最想了解这个岗位或团队的哪 1-2 个问题?(Mock 演示数据)`, followUpHints: ["追问问题背后的求职关注点", "追问对工作节奏的预期"] },
  { type: "经历深挖", question: (_, snippet) => `围绕「${snippet}」这段经历,如果让你重新做一次,你会在哪些地方做得不一样?(Mock 演示数据)`, followUpHints: ["追问复盘后的具体改进动作", "追问这段经历对后续选择的影响"] },
  { type: "技术案例", question: () => `请介绍一个你从零开始学习并应用某项技术的经历,当时为什么学、怎么学的、最终用在了哪里?(Mock 演示数据)`, followUpHints: ["追问学习路径与方法", "追问应用后的实际效果"] },
  { type: "情景假设", question: () => `假设你与同事在技术方案上产生了严重分歧,双方都认为自己的方案更优,你会如何推动达成一致?(Mock 演示数据)`, followUpHints: ["追问分歧无法消除时的决策方式", "追问如何维护合作关系"] },
  { type: "经历深挖", question: () => `请讲一件你在过往经历中最有成就感的事,以及你在其中具体发挥了什么作用。(Mock 演示数据)`, followUpHints: ["追问结果的可衡量指标", "追问是否有他人协作与分工"] },
  { type: "技术案例", question: (pos) => `对于${pos}岗位,你认为自己最大的技术优势是什么?请用一次具体实践来证明。(Mock 演示数据)`, followUpHints: ["追问技术深度的具体体现", "追问与岗位要求的对应关系"] },
  { type: "情景假设", question: () => `假设入职后你发现团队的实际工作内容与面试时的描述差别很大,你会如何应对?(Mock 演示数据)`, followUpHints: ["追问短期与长期的不同处理", "追问沟通对象与时机"] },
  { type: "经历深挖", question: () => `请讲一段你在压力下完成任务的经历:压力来自哪里,你如何调整状态并最终完成?(Mock 演示数据)`, followUpHints: ["追问时间与任务量的具体压力点", "追问事后的经验沉淀"] },
  { type: "技术案例", question: () => `请描述一次你排查线上问题或疑难缺陷的过程:现象、定位思路、根因与修复。(Mock 演示数据)`, followUpHints: ["追问定位手段与工具", "追问如何避免同类问题复发"] },
  { type: "情景假设", question: () => `假设你同时被分配了多项紧急任务,而时间和精力明显不够,你会如何与上级沟通并安排优先级?(Mock 演示数据)`, followUpHints: ["追问优先级判断的依据", "追问如何保证交付质量"] },
  { type: "自我介绍", question: (pos) => `如果用三个关键词向面试官介绍你自己(针对${pos}岗位),你会选哪三个?为什么?(Mock 演示数据)`, followUpHints: ["追问关键词与岗位的匹配证据", "追问最想先介绍的一个"] },
];

/** 面试题演示数据:题数恒等于档位(出题管线 echo 校验依赖);前 5 题覆盖五类题型(schema 约束) */
export function mockInterviewQuestionsFixture(messages: ChatMessage[]): InterviewQuestions {
  const { questionCount, targetPosition, resumeText } = parseQuestionInput(messages);
  const snippet = resumeSnippet(resumeText);
  const questions = QUESTION_POOL.slice(0, questionCount).map((seed, index) => ({
    id: `q-${index + 1}`,
    type: seed.type,
    question: seed.question(targetPosition, snippet),
    followUpHints: seed.followUpHints,
    // 经历深挖/技术案例题给出简历出处锚点(演示数据取首段);非锚点题型为空
    evidence: seed.type === "经历深挖" || seed.type === "技术案例" ? [snippet] : [],
  }));
  return { questions };
}
