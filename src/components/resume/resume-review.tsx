"use client";
// 简历解析核对表单(4.3):解析结果分区展示(基本信息/教育/技能/经历/项目),逐项可修正 —— AI 可能识别错,必须给用户确认机会。
// 目标方向选择:画像推荐方向 chips(默认首选)+ 自定义输入;40px 主按钮「开始优化」。
// 「保存核对结果」就地保存(resume.saveParsedData);「开始优化」经 onStartOptimize 交由 Hub(4.4 起触发改写)。
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";
import type { ParsedResume, TimeRange } from "@/lib/resume/analysis-schemas";

const EMPTY_TIME_RANGE: TimeRange = { start: "", end: "至今" };

function emptyParsed(): ParsedResume {
  return {
    basicInfo: { name: "", targetPosition: "", phone: "", email: "" },
    education: [],
    skills: [],
    experiences: [],
    projects: [],
  };
}

// 技能输入:一行一个(也兼容逗号/顿号分隔),转技能数组
function parseSkillsText(text: string): string[] {
  return text
    .split(/[\n,、,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// 分区标题 + 说明
function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h3 className="text-h3 text-ink">{title}</h3>
      {hint && <p className="mt-0.5 text-caption text-ink-muted">{hint}</p>}
    </div>
  );
}

export function ResumeReview({
  resumeId,
  initial,
  careerPaths,
  onStartOptimize,
}: {
  resumeId: string;
  initial: ParsedResume | null;
  /** 画像推荐方向(按匹配度降序) */
  careerPaths: string[];
  /** 「开始优化」:已保存的核对结果 + 目标方向交由 Hub 触发改写(4.4 起) */
  onStartOptimize: (parsed: ParsedResume, direction: string) => Promise<void>;
}) {
  const utils = trpc.useUtils();
  const saveParsed = trpc.resume.saveParsedData.useMutation();
  const [data, setData] = useState<ParsedResume>(() => initial ?? emptyParsed());
  const [skillsText, setSkillsText] = useState(() => (initial?.skills ?? []).join("\n"));
  const [direction, setDirection] = useState(() => careerPaths[0] ?? "");
  const [directionError, setDirectionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function set<K extends keyof ParsedResume>(key: K, value: ParsedResume[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  function buildParsed(): ParsedResume {
    return { ...data, skills: parseSkillsText(skillsText) };
  }

  async function handleSave() {
    setSaved(false);
    setFormError(null);
    try {
      await saveParsed.mutateAsync({ resumeId, parsedData: buildParsed() });
      setSaved(true);
      void utils.resume.get.invalidate();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "保存失败,请稍后重试");
    }
  }

  async function handleStart() {
    const target = direction.trim();
    if (!target) {
      setDirectionError("请选择或填写目标方向");
      return;
    }
    setDirectionError(null);
    setFormError(null);
    try {
      await onStartOptimize(buildParsed(), target);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "操作失败,请稍后重试");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[640px] space-y-6 px-4 py-6">
      <div className="rounded-card border border-hairline bg-surface p-6 shadow-card">
        <p className="text-body-sm text-ink-muted">
          AI 已解析出简历结构,请逐项核对修正 —— 解析可能有偏差,修正后保存再开始优化。
        </p>
      </div>

      <div className="space-y-6 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <SectionHeader title="基本信息" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="rv-name" className="text-body-sm text-ink-secondary">
              姓名
            </label>
            <Input
              id="rv-name"
              value={data.basicInfo.name}
              onChange={(e) => set("basicInfo", { ...data.basicInfo, name: e.target.value })}
              maxLength={50}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="rv-target" className="text-body-sm text-ink-secondary">
              求职意向
            </label>
            <Input
              id="rv-target"
              value={data.basicInfo.targetPosition}
              onChange={(e) =>
                set("basicInfo", { ...data.basicInfo, targetPosition: e.target.value })
              }
              maxLength={100}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="rv-phone" className="text-body-sm text-ink-secondary">
              联系电话
            </label>
            <Input
              id="rv-phone"
              value={data.basicInfo.phone}
              onChange={(e) => set("basicInfo", { ...data.basicInfo, phone: e.target.value })}
              maxLength={30}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="rv-email" className="text-body-sm text-ink-secondary">
              邮箱
            </label>
            <Input
              id="rv-email"
              value={data.basicInfo.email}
              onChange={(e) => set("basicInfo", { ...data.basicInfo, email: e.target.value })}
              maxLength={100}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <SectionHeader title="教育经历" hint="学校、学历、专业与起止时间" />
        {data.education.map((edu, index) => (
          <div key={index} className="space-y-3 rounded-control border border-hairline bg-sunken/50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                aria-label={`学校 ${index + 1}`}
                placeholder="学校"
                value={edu.school}
                onChange={(e) => {
                  const next = [...data.education];
                  next[index] = { ...edu, school: e.target.value };
                  set("education", next);
                }}
                maxLength={100}
              />
              <Input
                aria-label={`专业 ${index + 1}`}
                placeholder="专业"
                value={edu.major}
                onChange={(e) => {
                  const next = [...data.education];
                  next[index] = { ...edu, major: e.target.value };
                  set("education", next);
                }}
                maxLength={100}
              />
              <Input
                aria-label={`学历 ${index + 1}`}
                placeholder="学历(如 本科)"
                value={edu.degree}
                onChange={(e) => {
                  const next = [...data.education];
                  next[index] = { ...edu, degree: e.target.value };
                  set("education", next);
                }}
                maxLength={50}
              />
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`入学时间 ${index + 1}`}
                  placeholder="开始(如 2016-09)"
                  value={edu.timeRange.start}
                  onChange={(e) => {
                    const next = [...data.education];
                    next[index] = { ...edu, timeRange: { ...edu.timeRange, start: e.target.value } };
                    set("education", next);
                  }}
                  maxLength={20}
                />
                <span className="text-ink-faint">—</span>
                <Input
                  aria-label={`毕业时间 ${index + 1}`}
                  placeholder="结束(如 2020-06)"
                  value={edu.timeRange.end}
                  onChange={(e) => {
                    const next = [...data.education];
                    next[index] = { ...edu, timeRange: { ...edu.timeRange, end: e.target.value } };
                    set("education", next);
                  }}
                  maxLength={20}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set("education", data.education.filter((_, i) => i !== index))}
            >
              <Trash2 aria-hidden />
              删除此条
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={data.education.length >= 10}
          onClick={() =>
            set("education", [
              ...data.education,
              { school: "", degree: "", major: "", timeRange: { ...EMPTY_TIME_RANGE } },
            ])
          }
        >
          <Plus aria-hidden />
          添加教育经历
        </Button>
      </div>

      <div className="space-y-3 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <SectionHeader title="技能" hint="每行一个技能,或使用逗号分隔" />
        <Textarea
          aria-label="技能列表"
          rows={4}
          value={skillsText}
          onChange={(e) => {
            setSkillsText(e.target.value);
            setSaved(false);
          }}
          maxLength={1000}
        />
      </div>

      <div className="space-y-4 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <SectionHeader title="工作 / 实习经历" hint="公司、职位、时间与职责描述" />
        {data.experiences.map((exp, index) => (
          <div key={index} className="space-y-3 rounded-control border border-hairline bg-sunken/50 p-4">
            <div className="flex items-center gap-2">
              {(["工作", "实习"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    const next = [...data.experiences];
                    next[index] = { ...exp, type };
                    set("experiences", next);
                  }}
                  className={cn(
                    "rounded-pill border px-3 py-1 text-body-sm",
                    exp.type === type
                      ? "border-green-600 bg-green-100 text-ink"
                      : "border-hairline-strong bg-white text-ink-muted hover:border-ink-faint"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                aria-label={`公司 ${index + 1}`}
                placeholder="公司 / 组织"
                value={exp.company}
                onChange={(e) => {
                  const next = [...data.experiences];
                  next[index] = { ...exp, company: e.target.value };
                  set("experiences", next);
                }}
                maxLength={100}
              />
              <Input
                aria-label={`职位 ${index + 1}`}
                placeholder="职位"
                value={exp.role}
                onChange={(e) => {
                  const next = [...data.experiences];
                  next[index] = { ...exp, role: e.target.value };
                  set("experiences", next);
                }}
                maxLength={100}
              />
              <div className="flex items-center gap-2 sm:col-span-2">
                <Input
                  aria-label={`开始时间 ${index + 1}`}
                  placeholder="开始(如 2020-07)"
                  value={exp.timeRange.start}
                  onChange={(e) => {
                    const next = [...data.experiences];
                    next[index] = { ...exp, timeRange: { ...exp.timeRange, start: e.target.value } };
                    set("experiences", next);
                  }}
                  maxLength={20}
                />
                <span className="text-ink-faint">—</span>
                <Input
                  aria-label={`结束时间 ${index + 1}`}
                  placeholder="结束(如 至今)"
                  value={exp.timeRange.end}
                  onChange={(e) => {
                    const next = [...data.experiences];
                    next[index] = { ...exp, timeRange: { ...exp.timeRange, end: e.target.value } };
                    set("experiences", next);
                  }}
                  maxLength={20}
                />
              </div>
              <Textarea
                aria-label={`职责描述 ${index + 1}`}
                placeholder="职责与成果(逐行填写)"
                rows={4}
                value={exp.description}
                onChange={(e) => {
                  const next = [...data.experiences];
                  next[index] = { ...exp, description: e.target.value };
                  set("experiences", next);
                }}
                maxLength={2000}
                className="sm:col-span-2"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set("experiences", data.experiences.filter((_, i) => i !== index))}
            >
              <Trash2 aria-hidden />
              删除此条
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={data.experiences.length >= 15}
          onClick={() =>
            set("experiences", [
              ...data.experiences,
              {
                type: "工作",
                company: "",
                role: "",
                timeRange: { ...EMPTY_TIME_RANGE },
                description: "",
              },
            ])
          }
        >
          <Plus aria-hidden />
          添加经历
        </Button>
      </div>

      <div className="space-y-4 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <SectionHeader title="项目经历" hint="项目名称、担任角色与项目描述" />
        {data.projects.map((project, index) => (
          <div key={index} className="space-y-3 rounded-control border border-hairline bg-sunken/50 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                aria-label={`项目名称 ${index + 1}`}
                placeholder="项目名称"
                value={project.name}
                onChange={(e) => {
                  const next = [...data.projects];
                  next[index] = { ...project, name: e.target.value };
                  set("projects", next);
                }}
                maxLength={100}
              />
              <Input
                aria-label={`担任角色 ${index + 1}`}
                placeholder="担任角色"
                value={project.role}
                onChange={(e) => {
                  const next = [...data.projects];
                  next[index] = { ...project, role: e.target.value };
                  set("projects", next);
                }}
                maxLength={100}
              />
              <div className="flex items-center gap-2 sm:col-span-2">
                <Input
                  aria-label={`项目开始时间 ${index + 1}`}
                  placeholder="开始(如 2023-01)"
                  value={project.timeRange.start}
                  onChange={(e) => {
                    const next = [...data.projects];
                    next[index] = { ...project, timeRange: { ...project.timeRange, start: e.target.value } };
                    set("projects", next);
                  }}
                  maxLength={20}
                />
                <span className="text-ink-faint">—</span>
                <Input
                  aria-label={`项目结束时间 ${index + 1}`}
                  placeholder="结束(如 2023-05)"
                  value={project.timeRange.end}
                  onChange={(e) => {
                    const next = [...data.projects];
                    next[index] = { ...project, timeRange: { ...project.timeRange, end: e.target.value } };
                    set("projects", next);
                  }}
                  maxLength={20}
                />
              </div>
              <Textarea
                aria-label={`项目描述 ${index + 1}`}
                placeholder="项目描述与个人贡献"
                rows={4}
                value={project.description}
                onChange={(e) => {
                  const next = [...data.projects];
                  next[index] = { ...project, description: e.target.value };
                  set("projects", next);
                }}
                maxLength={2000}
                className="sm:col-span-2"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => set("projects", data.projects.filter((_, i) => i !== index))}
            >
              <Trash2 aria-hidden />
              删除此条
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={data.projects.length >= 15}
          onClick={() =>
            set("projects", [
              ...data.projects,
              { name: "", role: "", timeRange: { ...EMPTY_TIME_RANGE }, description: "" },
            ])
          }
        >
          <Plus aria-hidden />
          添加项目
        </Button>
      </div>

      <div className="space-y-3 rounded-card border border-hairline bg-surface p-6 shadow-card">
        <SectionHeader title="目标方向" hint="优化将围绕这个方向调整表达;优先推荐画像分析的方向" />
        {careerPaths.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="推荐方向">
            {careerPaths.map((path) => (
              <button
                key={path}
                type="button"
                onClick={() => {
                  setDirection(path);
                  setDirectionError(null);
                }}
                className={cn(
                  "rounded-pill border px-3 py-1 text-body-sm",
                  direction === path
                    ? "border-green-600 bg-green-100 text-ink"
                    : "border-hairline-strong bg-white text-ink-muted hover:border-ink-faint"
                )}
              >
                {path}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-1">
          <label htmlFor="rv-direction" className="text-body-sm text-ink-secondary">
            目标方向(可自定义)
          </label>
          <Input
            id="rv-direction"
            value={direction}
            onChange={(e) => {
              setDirection(e.target.value);
              setDirectionError(null);
            }}
            placeholder="如:后端开发工程师"
            maxLength={30}
          />
          {directionError && <p className="text-body-sm text-danger">{directionError}</p>}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pb-4">
        {saved && <p className="mr-auto text-body-sm text-success">核对结果已保存</p>}
        {formError && <p className="mr-auto text-body-sm text-danger">{formError}</p>}
        <Button
          type="button"
          variant="secondary"
          disabled={saveParsed.isPending}
          onClick={() => void handleSave()}
        >
          {saveParsed.isPending ? "保存中…" : "保存核对结果"}
        </Button>
        <Button
          type="button"
          size="lg"
          disabled={saveParsed.isPending}
          onClick={() => void handleStart()}
        >
          开始优化
        </Button>
      </div>
    </div>
  );
}
