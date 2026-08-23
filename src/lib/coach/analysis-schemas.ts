// 技能教练输出 Schema(6.3,客户端安全,无 node:fs):
// 差距优先级矩阵 + 90 天提升计划(固定 13 周 = 91 天,覆盖 90 天验证口径)+ 里程碑 + 资源 + 风险。
// 关键约束(superRefine):
//  ① 每周任务总时长 ≤ 用户每周投入(weeklyHours 回显字段,跨字段校验依据);
//  ② 优先级与 (importance, gapSize) 严格对应且按重要性降序(P0:重要≥4 且差距大);
//  ③ 周次必须连续 1..13;④ 里程碑周次落在 1..13 内。
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

    // ② 优先级一致性:P0 ⇔ importance≥4 且 gap=大;P1 ⇔ (importance≥4 且 gap≠大) 或 (importance=3 且 gap=大);
    //    其余 P2。且矩阵按 importance 降序、gapSize(大>中>小)降序排列。
    const expectedPriority = (importance: number, gapSize: "大" | "中" | "小") =>
      importance >= 4 && gapSize === "大"
        ? "P0"
        : (importance >= 4 && gapSize !== "大") || (importance === 3 && gapSize === "大")
          ? "P1"
          : "P2";
    const gapRank = { 大: 2, 中: 1, 小: 0 } as const;
    value.priorityMatrix.forEach((item, index) => {
      if (item.priority !== expectedPriority(item.importance, item.gapSize)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${item.skill} 的优先级 ${item.priority} 与重要性 ${item.importance}/差距 ${item.gapSize} 不一致`,
          path: ["priorityMatrix", index, "priority"],
        });
      }
      const previous = value.priorityMatrix[index - 1];
      if (
        previous &&
        (previous.importance < item.importance ||
          (previous.importance === item.importance && gapRank[previous.gapSize] < gapRank[item.gapSize]))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `优先级矩阵未按重要性/差距降序排列(${previous.skill} 应排在 ${item.skill} 之后)`,
          path: ["priorityMatrix", index],
        });
      }
    });

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
  });
export type CoachPlan = z.infer<typeof coachPlanSchema>;
