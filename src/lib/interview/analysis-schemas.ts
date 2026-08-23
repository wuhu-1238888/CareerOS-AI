// 模拟面试输出 Schema(7.1/7.2/7.3,客户端安全,无 node:fs):
// 出题/评估/报告三 Agent 的输出结构 + 逐题作答记录结构。对话界面(客户端组件)需要对从 DB
// 读回的 questions/answers/report 做渲染前校验,而 interview-*.agent.ts 经 base.ts 引入
// node:fs(loadPrompt),不能进入客户端包。agent 与管线继续从本文件导入。
// 结构对应 agent-design 2.6:角色定位「如果我是这个岗位的面试官,看到这份简历,我会问什么」;
// 五类题目(自我介绍/经历深挖/技术案例/情景假设/反问)各至少 1 题;每题评估内容 1-10/表达 1-10
// + 改进建议;综合报告四要素(总体评价/突出优势/主要短板/重点改进方向)。
import { z } from "zod";

// 面试类型(agent-design 2.6 输入项)
export const interviewTypeSchema = z.enum(["行为面", "技术面", "案例面"]);
export type InterviewType = z.infer<typeof interviewTypeSchema>;

// 场次档位:短 5 题 / 标准 10 题 / 完整 15 题(2026-08-24 用户拍板;7.1「10-15 题」与
// 7.2「5 题短面试」口径差异的三档化解方案)。
// 注:zod 3 的 z.enum 只支持字符串字面量,数值档位用 literal 联合。
export const interviewQuestionCountSchema = z.union([z.literal(5), z.literal(10), z.literal(15)]);
export type InterviewQuestionCount = z.infer<typeof interviewQuestionCountSchema>;

// 五类题型(agent-design 2.6)
export const interviewQuestionTypeSchema = z.enum(["自我介绍", "经历深挖", "技术案例", "情景假设", "反问"]);
export type InterviewQuestionType = z.infer<typeof interviewQuestionTypeSchema>;

// 单道面试题:稳定 id(作答记录定位用)、题型、题干、追问提示、简历出处(evidence 必须能在
// 输入简历中找到出处,禁虚构;简历文本片段与原题衔接,「自我介绍」等非简历锚点题为空)
export const interviewQuestionSchema = z.object({
  id: z.string().regex(/^q-\d+$/, "题目 id 必须形如 q-1"),
  type: interviewQuestionTypeSchema,
  question: z.string().min(1, "题干不能为空").max(300, "题干最多 300 字"),
  followUpHints: z
    .array(z.string().min(1, "追问提示不能为空").max(100, "追问提示最多 100 字"))
    .min(2, "每题至少 2 条追问提示")
    .max(3, "每题最多 3 条追问提示"),
  evidence: z
    .array(z.string().min(1, "出处不能为空").max(100, "出处最多 100 字"))
    .max(3, "出处最多 3 条")
    .default([]),
});
export type InterviewQuestion = z.infer<typeof interviewQuestionSchema>;

export const interviewQuestionsSchema = z
  .object({
    questions: z.array(interviewQuestionSchema).min(5, "题目至少 5 道").max(15, "题目最多 15 道"),
  })
  .superRefine((value, ctx) => {
    // 五类题型各至少 1 题(agent-design 2.6 输出定义;短 5 题档 = 五类各 1 题)
    const types = new Set(value.questions.map((q) => q.type));
    for (const expected of interviewQuestionTypeSchema.options) {
      if (!types.has(expected)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `题目缺少「${expected}」类题型`,
          path: ["questions"],
        });
      }
    }
  });
export type InterviewQuestions = z.infer<typeof interviewQuestionsSchema>;

// 每题评估(7.3 定义:内容评分 1-10 / 表达评分 1-10 / 改进建议);追问并入评估输出——
// followUpQuestion 仅当值得深挖时给出(否则 null);追问回答不二次评估、至多一次
export const interviewEvaluationSchema = z.object({
  contentScore: z.number().int().min(1, "内容评分最低 1 分").max(10, "内容评分最高 10 分"),
  expressionScore: z.number().int().min(1, "表达评分最低 1 分").max(10, "表达评分最高 10 分"),
  improvementSuggestion: z.string().min(1, "改进建议不能为空").max(200, "改进建议最多 200 字"),
  followUpQuestion: z.string().min(1, "追问不能为空").max(120, "追问最多 120 字").nullable(),
});
export type InterviewEvaluation = z.infer<typeof interviewEvaluationSchema>;

// 逐题作答记录(InterviewSession.answers JSON;读取方防御解析):
// evaluation null = 评估失败待重试(答案已落库);followUpQuestion null = 无追问;
// followUpAnswer null = 追问已跳过(仅当 followUpQuestion 非空时此字段有区分意义)
export const interviewAnswerItemSchema = z.object({
  questionId: z.string().min(1, "题目 id 不能为空").max(20),
  answer: z.string().min(1, "回答不能为空").max(2000, "回答最多 2000 字"),
  evaluation: interviewEvaluationSchema.omit({ followUpQuestion: true }).nullable(),
  followUpQuestion: z.string().min(1).max(120).nullable(),
  followUpAnswer: z.string().min(1, "追问回答不能为空").max(2000, "追问回答最多 2000 字").nullable(),
});
export type InterviewAnswerItem = z.infer<typeof interviewAnswerItemSchema>;

export const interviewAnswersSchema = z.array(interviewAnswerItemSchema).max(15, "作答记录最多 15 条");
export type InterviewAnswers = z.infer<typeof interviewAnswersSchema>;

// 综合报告(7.3 定义:总体评价 / 突出优势 / 主要短板 / 1-2 个重点改进方向,不罗列所有问题;
// 均分由前端对已评估题确定性计算,报告 Agent 只产出定性内容)
export const interviewReportSchema = z.object({
  overallEvaluation: z.string().min(1, "总体评价不能为空").max(300, "总体评价最多 300 字"),
  strengths: z.array(z.string().min(1, "优势不能为空").max(100, "优势最多 100 字")).min(1, "至少 1 条优势").max(5, "优势最多 5 条"),
  weaknesses: z.array(z.string().min(1, "短板不能为空").max(100, "短板最多 100 字")).min(1, "至少 1 条短板").max(5, "短板最多 5 条"),
  keyImprovements: z.array(z.string().min(1, "改进方向不能为空").max(150, "改进方向最多 150 字")).min(1, "至少 1 个改进方向").max(2, "改进方向最多 2 个"),
});
export type InterviewReport = z.infer<typeof interviewReportSchema>;
