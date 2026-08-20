// Navigator 输出 Schema(3.3,客户端安全,无 node:fs):路线图分析与单阶段对象。
// 供 Agent outputSchema 与前端渲染前校验共用(同 profile/analysis-schemas.ts 惯例)。
// 全量路线图与单阶段重生成共用 roadmapStageSchema,防止两模式阶段结构漂移。
import { z } from "zod";

/** 实践项目:必含「产出物」(implementation-plan L228,所有项目需可放入作品集) */
export const practiceProjectSchema = z.object({
  title: z.string().min(1, "项目名称不能为空").max(100),
  deliverable: z.string().min(1, "产出物不能为空").max(200),
});
export type PracticeProject = z.infer<typeof practiceProjectSchema>;

/** 单个成长阶段:名称/目标/学习内容 3-5/实践项目 1-2(含产出物)/资源/检查点/预估时长 */
export const roadmapStageSchema = z.object({
  name: z.string().min(1, "阶段名称不能为空").max(30),
  goal: z.string().min(1, "阶段目标不能为空").max(200),
  learningContent: z.array(z.string().min(1).max(100)).min(3, "学习内容至少 3 项").max(5, "学习内容最多 5 项"),
  practiceProjects: z
    .array(practiceProjectSchema)
    .min(1, "实践项目至少 1 个")
    .max(2, "实践项目最多 2 个"),
  resources: z.array(z.string().min(1).max(200)).max(8).default([]),
  checkpoints: z.array(z.string().min(1).max(200)).max(5).default([]),
  estimatedDuration: z.string().min(1, "预估时长不能为空").max(30),
});
export type RoadmapStage = z.infer<typeof roadmapStageSchema>;

/** 完整路线图分析:概要(总时长/阶段数/最终目标)+ 3-4 个阶段 */
export const roadmapAnalysisSchema = z
  .object({
    summary: z.object({
      totalDuration: z.string().min(1, "总时长不能为空").max(30),
      stageCount: z.number().int().min(3, "阶段数至少 3").max(4, "阶段数最多 4"),
      finalGoal: z.string().min(1, "最终目标不能为空").max(200),
    }),
    stages: z.array(roadmapStageSchema).min(3, "阶段至少 3 个").max(4, "阶段最多 4 个"),
  })
  .superRefine((value, ctx) => {
    if (value.summary.stageCount !== value.stages.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "summary.stageCount 与 stages 数量不一致",
        path: ["summary", "stageCount"],
      });
    }
  });
export type RoadmapAnalysis = z.infer<typeof roadmapAnalysisSchema>;
