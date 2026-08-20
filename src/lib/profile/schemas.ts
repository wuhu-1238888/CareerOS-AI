// 画像数据结构 Zod Schema(2.1 起共享):tRPC 输入校验 / Profile Agent 输入 / 表单类型同源
// 字段口径:PRD 3.1 输入字段表(教育背景必填、技能标签必填、经历推荐、兴趣推荐、目标可选)
import { z } from "zod";

export const educationEntrySchema = z.object({
  degree: z.string().min(1, "请选择学历").max(20, "学历格式不正确"),
  major: z.string().min(1, "请输入专业").max(30, "专业最多 30 个字符"),
  school: z.string().max(50, "学校最多 50 个字符").optional(),
  graduationYear: z.number().int().min(1980).max(2035).optional(),
});

export const skillEntrySchema = z.object({
  name: z.string().min(1, "技能名称不能为空").max(30, "技能名称最多 30 个字符"),
  level: z.enum(["基础", "熟练", "精通"], { message: "熟练度仅支持 基础/熟练/精通" }),
});

export const experienceEntrySchema = z
  .object({
    type: z.enum(["internship", "project"], { message: "经历类型仅支持 实习/项目" }),
    organization: z.string().min(1, "请填写公司或项目名称").max(50, "名称最多 50 个字符"),
    role: z.string().min(1, "请填写你的角色").max(50, "角色最多 50 个字符"),
    description: z.string().max(500, "描述最多 500 个字符").optional(),
    // 实习/工作经历起止时间与时长(PRD 3.1.3「公司、岗位、时长、主要职责」):
    // 月份精度 YYYY-MM;endDate 为 null 表示「至今」;duration 由系统自动计算,用户不手动填写
    startDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "开始时间格式不正确").optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "结束时间格式不正确")
      .nullable()
      .optional(),
    duration: z.string().max(30, "时长格式不正确").optional(),
  })
  .refine((e) => !(e.startDate && e.endDate && e.endDate < e.startDate), {
    message: "结束时间不能早于开始时间",
    path: ["endDate"],
  });

// 自动计算经历时长(PRD 3.1.3):起止月份(YYYY-MM)→「X年Y个月」;endDate 为空表示「至今」,
// 按当前月份计算并追加「 · 至今」。仅系统使用,用户不手动填写。
export function computeExperienceDuration(
  startDate: string,
  endDate: string | null | undefined
): string {
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const end = endDate ? endDate.split("-").map(Number) : null;
  const endYear = end ? end[0]! : new Date().getFullYear();
  const endMonth = end ? end[1]! : new Date().getMonth() + 1;
  const months = (endYear - startYear!) * 12 + (endMonth - startMonth!);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts =
    months <= 0
      ? "不足1个月"
      : [years > 0 ? `${years}年` : "", rest > 0 ? `${rest}个月` : ""].filter(Boolean).join("");
  return endDate ? parts : `${parts} · 至今`;
}

// 画像输入数据:表单四步(教育背景/技能/经历/兴趣与目标)的完整载荷
export const profileDataSchema = z.object({
  education: z.array(educationEntrySchema).min(1, "请填写教育背景").max(5, "教育经历最多 5 条"),
  skills: z.array(skillEntrySchema).min(1, "请至少添加一项技能").max(20, "技能最多 20 项"),
  experiences: z.array(experienceEntrySchema).max(10, "经历最多 10 条").default([]),
  interests: z.array(z.string().min(1).max(20, "兴趣方向最多 20 个字符")).max(10, "兴趣方向最多 10 个").default([]),
  targets: z.array(z.string().min(1).max(30, "职业目标最多 30 个字符")).max(5, "职业目标最多 5 个").default([]),
});

export type ProfileData = z.infer<typeof profileDataSchema>;

export const careerPathInputSchema = z.object({
  directionName: z.string().min(1, "请输入方向名称").max(30, "方向名称最多 30 个字符"),
  matchScore: z.number().int().min(0, "匹配度不能为负").max(100, "匹配度最高 100"),
  strengths: z.array(z.string().min(1).max(100)).max(20).default([]),
  weaknesses: z.array(z.string().min(1).max(100)).max(20).default([]),
});
