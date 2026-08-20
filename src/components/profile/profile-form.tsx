"use client";
// 职业画像四步采集表单(2.2):教育背景 → 技能 → 经历 → 兴趣与目标
// 必填仅 学历+专业+技能;经历与目标可跳过;草稿随输入写入 localStorage(刷新不丢,提交成功清除);
// 失焦校验 + 步进拦截提示;提交回调由 hub 注入(2.2 保存数据,2.4 起走分析管线)
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "./stepper";
import { SkillSelector } from "./skill-selector";
import {
  DEGREE_OPTIONS,
  GRADUATION_YEARS,
  INTEREST_PRESETS,
} from "@/lib/profile/skill-presets";
import type { ProfileData } from "@/lib/profile/schemas";
import type { z } from "zod";
import type { experienceEntrySchema, skillEntrySchema } from "@/lib/profile/schemas";
import { cn } from "@/lib/utils";

type SkillEntry = z.infer<typeof skillEntrySchema>;
type ExperienceEntry = z.infer<typeof experienceEntrySchema>;

const STEPS = [
  { title: "教育背景", why: "帮助 AI 理解你的知识基础与对口行业" },
  { title: "技能", why: "能力评估与方向推荐的核心依据" },
  { title: "经历", why: "验证能力真实性,提炼你的差异化亮点" },
  { title: "兴趣与目标", why: "方向推荐与匹配度计算的锚点" },
];

// 表单工作态:允许未填写字段存在(提交/步进时校验),与可序列化的 ProfileData 相互转换
type FormData = {
  education: { degree: string; major: string; school: string; graduationYear: string };
  skills: SkillEntry[];
  internships: ExperienceEntry[];
  projects: ExperienceEntry[];
  interests: string[];
  targets: string[];
};

const MAX_EXPERIENCES = 10;

function emptyForm(): FormData {
  return {
    education: { degree: "", major: "", school: "", graduationYear: "" },
    skills: [],
    internships: [],
    projects: [],
    interests: [],
    targets: [],
  };
}

function toFormData(profile: ProfileData): FormData {
  const edu = profile.education[0];
  return {
    education: {
      degree: edu?.degree ?? "",
      major: edu?.major ?? "",
      school: edu?.school ?? "",
      graduationYear: edu?.graduationYear ? String(edu.graduationYear) : "",
    },
    skills: profile.skills,
    internships: profile.experiences.filter((e) => e.type === "internship"),
    projects: profile.experiences.filter((e) => e.type === "project"),
    interests: profile.interests,
    targets: profile.targets,
  };
}

function toProfileData(form: FormData): ProfileData {
  const education = [];
  if (form.education.degree && form.education.major.trim()) {
    education.push({
      degree: form.education.degree,
      major: form.education.major.trim(),
      school: form.education.school.trim() || undefined,
      graduationYear: form.education.graduationYear ? Number(form.education.graduationYear) : undefined,
    });
  }
  return {
    education,
    skills: form.skills,
    experiences: [...form.internships, ...form.projects],
    interests: form.interests,
    targets: form.targets,
  };
}

// 草稿读取:字段粗校验失败(损坏/旧版结构)则忽略,回退空表单
function readDraft(draftKey: string): FormData | null {
  try {
    const raw = window.localStorage.getItem(draftKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FormData>;
    if (!parsed || typeof parsed !== "object") return null;
    if (
      !parsed.education ||
      typeof parsed.education.degree !== "string" ||
      typeof parsed.education.major !== "string" ||
      !Array.isArray(parsed.skills) ||
      !Array.isArray(parsed.internships) ||
      !Array.isArray(parsed.projects) ||
      !Array.isArray(parsed.interests) ||
      !Array.isArray(parsed.targets)
    ) {
      return null;
    }
    return { ...emptyForm(), ...(parsed as FormData) };
  } catch {
    return null;
  }
}

export function ProfileForm({
  initialData,
  draftKey,
  onSubmit,
}: {
  initialData?: ProfileData | null;
  draftKey?: string;
  onSubmit: (data: ProfileData) => Promise<void>;
}) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(() =>
    draftKey ? readDraft(draftKey) ?? (initialData ? toFormData(initialData) : emptyForm()) : initialData ? toFormData(initialData) : emptyForm()
  );
  const [fieldErrors, setFieldErrors] = useState<{ degree?: string; major?: string; skills?: string }>({});
  const [serverError, setServerError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [targetInput, setTargetInput] = useState("");

  // 草稿随输入持久化(刷新不丢);提交成功后由 handleSubmit 清除
  useEffect(() => {
    if (!draftKey || typeof window === "undefined") return;
    window.localStorage.setItem(draftKey, JSON.stringify(data));
  }, [draftKey, data]);

  function patchEducation(patch: Partial<FormData["education"]>) {
    setData((d) => ({ ...d, education: { ...d.education, ...patch } }));
    setFieldErrors((e) => ({ ...e, degree: undefined, major: undefined }));
  }

  function updateExperience(
    list: "internships" | "projects",
    index: number,
    patch: Partial<ExperienceEntry>
  ) {
    setData((d) => {
      const entries = [...d[list]];
      entries[index] = { ...entries[index], ...patch };
      return { ...d, [list]: entries };
    });
  }

  function removeExperience(list: "internships" | "projects", index: number) {
    setData((d) => ({ ...d, [list]: d[list].filter((_, i) => i !== index) }));
  }

  function addExperience(list: "internships" | "projects") {
    const entry: ExperienceEntry =
      list === "internships"
        ? { type: "internship", organization: "", role: "", description: "" }
        : { type: "project", organization: "", role: "", description: "" };
    setData((d) => ({ ...d, [list]: [...d[list], entry] }));
  }

  function validateStep(stepIndex: number): boolean {
    if (stepIndex === 0) {
      const errors: typeof fieldErrors = {};
      if (!data.education.degree) errors.degree = "请选择学历";
      if (!data.education.major.trim()) errors.major = "请输入专业";
      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
    }
    if (stepIndex === 1) {
      const skillsError = data.skills.length === 0 ? "请至少添加一项技能" : undefined;
      setFieldErrors({ skills: skillsError });
      return !skillsError;
    }
    return true;
  }

  function handleNext() {
    if (validateStep(step)) setStep(step + 1);
  }

  function handleBack() {
    setServerError("");
    setStep(step - 1);
  }

  function handleSubmit() {
    if (!validateStep(step)) return;
    setServerError("");
    setSubmitting(true);
    onSubmit(toProfileData(data))
      .then(() => {
        if (draftKey && typeof window !== "undefined") {
          window.localStorage.removeItem(draftKey);
        }
      })
      .catch(() => setServerError("提交失败,请稍后重试"))
      .finally(() => setSubmitting(false));
  }

  const experiencesTotal = data.internships.length + data.projects.length;

  return (
    <>
      <div className="mx-auto w-full max-w-[640px] px-4 pb-28 pt-6">
        <Stepper steps={STEPS} current={step} />

        <div className="mt-8 space-y-5">
          {step === 0 ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="edu-degree">学历</Label>
                <Select
                  value={data.education.degree || undefined}
                  onValueChange={(v) => patchEducation({ degree: v })}
                >
                  <SelectTrigger
                    id="edu-degree"
                    aria-invalid={!!fieldErrors.degree}
                    className={cn("w-full", fieldErrors.degree && "border-danger")}
                  >
                    <SelectValue placeholder="选择学历" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEGREE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.degree ? (
                  <p className="text-body-sm text-danger">{fieldErrors.degree}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edu-major">专业</Label>
                <Input
                  id="edu-major"
                  type="text"
                  placeholder="如:计算机科学与技术"
                  value={data.education.major}
                  aria-invalid={!!fieldErrors.major}
                  className={cn(fieldErrors.major && "border-danger")}
                  onChange={(e) => patchEducation({ major: e.target.value })}
                  onBlur={() => {
                    if (!data.education.major.trim()) {
                      setFieldErrors((errs) => ({ ...errs, major: "请输入专业" }));
                    }
                  }}
                />
                {fieldErrors.major ? (
                  <p className="text-body-sm text-danger">{fieldErrors.major}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edu-school">学校(选填)</Label>
                <Input
                  id="edu-school"
                  type="text"
                  placeholder="如:示例大学"
                  value={data.education.school}
                  onChange={(e) => patchEducation({ school: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edu-graduation">毕业年份(选填)</Label>
                <Select
                  value={data.education.graduationYear || undefined}
                  onValueChange={(v) => patchEducation({ graduationYear: v })}
                >
                  <SelectTrigger id="edu-graduation" className="w-full">
                    <SelectValue placeholder="请选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADUATION_YEARS.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <SkillSelector
              value={data.skills}
              onChange={(skills) => {
                setData((d) => ({ ...d, skills }));
                if (skills.length > 0) {
                  setFieldErrors((errs) => ({ ...errs, skills: undefined }));
                }
              }}
              error={fieldErrors.skills}
            />
          ) : null}

          {step === 2 ? (
            <div className="space-y-6">
              <p className="text-caption text-ink-faint">本步为选填,可直接点击下一步跳过</p>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>实习经历</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addExperience("internships")}
                    disabled={experiencesTotal >= MAX_EXPERIENCES}
                  >
                    添加实习经历
                  </Button>
                </div>
                {data.internships.length === 0 ? (
                  <p className="text-caption text-ink-faint">暂无实习经历</p>
                ) : (
                  data.internships.map((entry, index) => (
                    <div key={index} className="space-y-3 rounded-control border border-hairline bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-body-sm text-ink">实习经历 {index + 1}</p>
                        <button
                          type="button"
                          aria-label={`删除实习经历 ${index + 1}`}
                          onClick={() => removeExperience("internships", index)}
                          className="rounded-control px-1.5 py-0.5 text-ink-faint hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`internship-org-${index}`}>公司名称</Label>
                          <Input
                            id={`internship-org-${index}`}
                            type="text"
                            placeholder="如:示例科技"
                            value={entry.organization}
                            onChange={(e) =>
                              updateExperience("internships", index, { organization: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`internship-role-${index}`}>职位</Label>
                          <Input
                            id={`internship-role-${index}`}
                            type="text"
                            placeholder="如:后端实习生"
                            value={entry.role}
                            onChange={(e) =>
                              updateExperience("internships", index, { role: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`internship-desc-${index}`}>工作内容(选填)</Label>
                        <Textarea
                          id={`internship-desc-${index}`}
                          placeholder="简述你负责的工作与产出"
                          rows={3}
                          value={entry.description ?? ""}
                          onChange={(e) =>
                            updateExperience("internships", index, { description: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>项目经历</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => addExperience("projects")}
                    disabled={experiencesTotal >= MAX_EXPERIENCES}
                  >
                    添加项目经历
                  </Button>
                </div>
                {data.projects.length === 0 ? (
                  <p className="text-caption text-ink-faint">暂无项目经历</p>
                ) : (
                  data.projects.map((entry, index) => (
                    <div key={index} className="space-y-3 rounded-control border border-hairline bg-surface p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-body-sm text-ink">项目经历 {index + 1}</p>
                        <button
                          type="button"
                          aria-label={`删除项目经历 ${index + 1}`}
                          onClick={() => removeExperience("projects", index)}
                          className="rounded-control px-1.5 py-0.5 text-ink-faint hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          ×
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`project-org-${index}`}>项目名称</Label>
                          <Input
                            id={`project-org-${index}`}
                            type="text"
                            placeholder="如:校园二手交易平台"
                            value={entry.organization}
                            onChange={(e) =>
                              updateExperience("projects", index, { organization: e.target.value })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`project-role-${index}`}>你的角色</Label>
                          <Input
                            id={`project-role-${index}`}
                            type="text"
                            placeholder="如:后端开发"
                            value={entry.role}
                            onChange={(e) =>
                              updateExperience("projects", index, { role: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`project-desc-${index}`}>项目描述(选填)</Label>
                        <Textarea
                          id={`project-desc-${index}`}
                          placeholder="简述项目内容与你的贡献"
                          rows={3}
                          value={entry.description ?? ""}
                          onChange={(e) =>
                            updateExperience("projects", index, { description: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <p className="text-caption text-ink-faint">本步为选填,可直接点击下一步跳过</p>

              <div className="space-y-2">
                <Label>感兴趣的职业方向</Label>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_PRESETS.map((interest) => {
                    const selected = data.interests.includes(interest);
                    return (
                      <button
                        key={interest}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setData((d) => ({
                            ...d,
                            interests: selected
                              ? d.interests.filter((i) => i !== interest)
                              : [...d.interests, interest],
                          }))
                        }
                        className={cn(
                          "rounded-pill border px-3 py-1 text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                          selected
                            ? "border-green-600 bg-green-100 text-ink"
                            : "border-hairline-strong bg-white text-ink-muted hover:border-ink-faint"
                        )}
                      >
                        {selected ? "✓ " : ""}
                        {interest}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-input">职业目标</Label>
                <div className="flex items-start gap-2">
                  <Input
                    id="target-input"
                    type="text"
                    placeholder="如:后端开发工程师"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = targetInput.trim();
                        if (trimmed && !data.targets.includes(trimmed) && data.targets.length < 5) {
                          setData((d) => ({ ...d, targets: [...d.targets, trimmed] }));
                          setTargetInput("");
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const trimmed = targetInput.trim();
                      if (trimmed && !data.targets.includes(trimmed) && data.targets.length < 5) {
                        setData((d) => ({ ...d, targets: [...d.targets, trimmed] }));
                        setTargetInput("");
                      }
                    }}
                    disabled={!targetInput.trim() || data.targets.length >= 5}
                  >
                    添加
                  </Button>
                </div>
                {data.targets.length > 0 ? (
                  <ul className="flex flex-wrap gap-2">
                    {data.targets.map((target) => (
                      <li
                        key={target}
                        className="flex items-center gap-1 rounded-pill border border-hairline-strong bg-white px-3 py-1 text-body-sm text-ink"
                      >
                        {target}
                        <button
                          type="button"
                          aria-label={`移除目标 ${target}`}
                          onClick={() =>
                            setData((d) => ({ ...d, targets: d.targets.filter((t) => t !== target) }))
                          }
                          className="px-0.5 text-ink-faint hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {serverError ? (
          <p role="alert" className="mt-5 text-body-sm text-danger">
            {serverError}
          </p>
        ) : null}
      </div>

      {/* 固定底部导航:上一步 / 下一步(最后一步为 生成我的画像) */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-surface/95">
        <div className="mx-auto flex w-full max-w-[640px] items-center justify-between px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            disabled={step === 0 || submitting}
          >
            上一步
          </Button>
          <Button type="button" onClick={step === 3 ? handleSubmit : handleNext} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            {submitting ? "提交中…" : step === 3 ? "生成我的画像" : "下一步"}
          </Button>
        </div>
      </div>
    </>
  );
}
