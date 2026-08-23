// Mock 模式内置演示数据(2026-08 补):LLM_PROVIDER=mock 时,默认 Mock 适配器按 Agent 名分发
// schema 合规的 JSON(而非回显纯文本),使浏览器端可走通「匹配 → 教练」全链路验收。
// 数据为演示性质:匹配报告为固定夹具(与 6.1 样例集同源,已通过 schema 与手工标注);
// 教练计划由输入动态生成(weeklyHours 原样回显 + 差距清单推导优先级矩阵 + 预算内 13 周)。
// 真实 LLM 质量验证仍待 DeepSeek Key(progress.md 遗留 #1)。
import type { ChatMessage } from "./adapter";
import type { MatchAnalysis } from "@/lib/matching/analysis-schemas";
import type { CoachPlan } from "@/lib/coach/analysis-schemas";

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
