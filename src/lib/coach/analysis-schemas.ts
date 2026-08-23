// 技能教练输出 Schema(6.3,客户端安全,无 node:fs):
// 差距优先级矩阵 + 90 天提升计划(固定 13 周 = 91 天,覆盖 90 天验证口径)+ 里程碑 + 资源 + 风险。
// 关键约束(superRefine):
//  ① 每周任务总时长 ≤ 用户每周投入(weeklyHours 回显字段,跨字段校验依据);
//  ③ 周次必须连续 1..13;④ 里程碑周次落在 1..13 内。
// ② 优先级矩阵(P0:重要≥4 且差距大)不再「违规即拒」(2026-08-23 修正,见下方 transform):
//   真实 LLM 反复自报违规标签(如重要性 5/差距中 标 P0、重要性 4/差距小 标 P2)导致整个计划被拒,
//   改为确定性归一化——P0/P1/P2 由 (importance, gapSize) 重算 + 按重要性/差距降序重排,不信任模型自报。
import { z } from "zod";

export const coachPlanSchema = z
  .object({
    // 每周可投入小时(输入回显;管线层再做 echo 交叉校验,防模型私自改动预算)
    weeklyHours: z.number().int("每周投入须为整数").min(1, "每周投入至少 1 小时").max(80, "每周投入最多 80 小时"),
    // 差距优先级矩阵:重要性 × 差距 → P0/P1/P2
    priorityMatrix: z
      .array(
        z.object({
          skill: z.string().min(1, "技能名不能为空").max(50, "技能名最多 50 字"),
          importance: z.number().int().min(1).max(5),
          gapSize: z.enum(["大", "中", "小"]),
          priority: z.enum(["P0", "P1", "P2"]),
          reason: z.string().min(1, "优先级理由不能为空").max(200, "理由最多 200 字"),
        })
      )
      .min(1, "优先级矩阵至少 1 条")
      .max(8, "优先级矩阵最多 8 条"),
    // 90 天计划:固定 13 周,每周 1-5 个任务
    weeks: z
      .array(
        z.object({
          week: z.number().int().min(1).max(13),
          theme: z.string().min(1, "周主题不能为空").max(50, "周主题最多 50 字"),
          tasks: z
            .array(
              z.object({
                title: z.string().min(1, "任务标题不能为空").max(100, "任务标题最多 100 字"),
                estimatedMinutes: z.number().int().min(1, "任务时长至少 1 分钟").max(4800, "单任务时长异常"),
                deliverable: z.string().min(1, "产出不能为空").max(200, "产出最多 200 字"),
                completionCriteria: z.string().min(1, "完成标准不能为空").max(200, "完成标准最多 200 字"),
              })
            )
            .min(1, "每周至少 1 个任务")
            .max(5, "每周最多 5 个任务"),
        })
      )
      .min(13, "必须精确 13 周")
      .max(13, "必须精确 13 周"),
    // 里程碑(≤5):落在计划周次上的关键节点
    milestones: z
      .array(
        z.object({
          week: z.number().int().min(1).max(13),
          title: z.string().min(1, "里程碑标题不能为空").max(100, "里程碑标题最多 100 字"),
        })
      )
      .max(5, "里程碑最多 5 个")
      .default([]),
    // 学习资源(≤12):必标 free/paid,免费优先,不虚构 URL
    resources: z
      .array(
        z.object({
          title: z.string().min(1, "资源标题不能为空").max(100, "资源标题最多 100 字"),
          type: z.enum(["课程", "文档", "书籍", "项目", "社区", "视频"]),
          cost: z.enum(["free", "paid"]),
          url: z
            .union([z.literal(""), z.string().url("资源链接格式不正确")])
            .optional(),
          note: z.string().max(200, "备注最多 200 字").optional(),
        })
      )
      .max(12, "资源最多 12 条")
      .default([]),
    // 风险(≤5):描述 + 应对建议
    risks: z
      .array(
        z.object({
          risk: z.string().min(1, "风险描述不能为空").max(200, "风险描述最多 200 字"),
          mitigation: z.string().min(1, "应对建议不能为空").max(200, "应对建议最多 200 字"),
        })
      )
      .max(5, "风险最多 5 条")
      .default([]),
  })
  .superRefine((value, ctx) => {
    // ① 时间预算一致性:每周任务总时长 ≤ weeklyHours × 60 分钟(implementation-plan 6.3 验证项)
    const weeklyBudget = value.weeklyHours * 60;
    value.weeks.forEach((week, index) => {
      const total = week.tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
      if (total > weeklyBudget) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `第 ${week.week} 周任务总时长 ${total} 分钟超过每周预算 ${weeklyBudget} 分钟`,
          path: ["weeks", index, "tasks"],
        });
      }
    });

    // ② 已移除(2026-08-23):原「优先级标签/排序违规 → 拒绝整个输出」改为 transform 确定性归一化(见下方)。

    // ③ 周次连续 1..13(13 周 = 91 天,覆盖 90 天口径)
    const weekNumbers = value.weeks.map((w) => w.week);
    const expected = Array.from({ length: 13 }, (_, i) => i + 1);
    if (weekNumbers.some((n, i) => n !== expected[i])) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "计划周次必须连续覆盖第 1 至第 13 周",
        path: ["weeks"],
      });
    }

    // ④ 里程碑周次落在计划范围内(字段级 min/max 已限,双保险)
    value.milestones.forEach((milestone, index) => {
      if (milestone.week < 1 || milestone.week > 13) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `里程碑「${milestone.title}」周次 ${milestone.week} 超出 1-13 周范围`,
          path: ["milestones", index, "week"],
        });
      }
    });
  })
  .transform((value) => {
    // ② 优先级归一化(2026-08-23):P0/P1/P2 由 (importance, gapSize) 确定性推导,不信任模型自报标签
    //    (真实 LLM 反复违规:重要性 5/差距中 标 P0、重要性 4/差距小 标 P2、矩阵乱序 → 此前整份计划被拒);
    //    标签重算 + 按重要性降序、差距(大>中>小)降序重排,保证 UI 的优先级矩阵恒满足产品规则。
    // 显式标注返回类型:嵌套三元 + || 的组合 TS 会推断成 string,导致 z.infer 的 priority 类型退化为
    // string(消费侧 PRIORITY_STYLE[item.priority] 索引报错);标注为字面量联合保持类型精确
    const expectedPriority = (importance: number, gapSize: "大" | "中" | "小"): "P0" | "P1" | "P2" =>
      importance >= 4 && gapSize === "大"
        ? "P0"
        : (importance >= 4 && gapSize !== "大") || (importance === 3 && gapSize === "大")
          ? "P1"
          : "P2";
    const gapRank = { 大: 2, 中: 1, 小: 0 } as const;
    const priorityMatrix = value.priorityMatrix
      .map((item) => ({ ...item, priority: expectedPriority(item.importance, item.gapSize) }))
      .sort((a, b) => b.importance - a.importance || gapRank[b.gapSize] - gapRank[a.gapSize]);
    return { ...value, priorityMatrix };
  });
export type CoachPlan = z.infer<typeof coachPlanSchema>;
