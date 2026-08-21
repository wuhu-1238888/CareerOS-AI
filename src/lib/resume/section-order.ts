// 简历模块顺序(4.10,纯函数无 node 依赖,前后端共用):
// 顺序权威 = 用户原始简历原文。Schema 字段顺序只定义「模块是什么」,不用于排序;
// AI 不参与顺序判定(无幻觉风险);最终文本仍在原文上原位替换,顺序天然保真。
// 本模块负责:①确定性识别原文中的模块标题(标准模块 + 自定义模块)
// ②为无标题但有内容的模块按字段值在原文中的位置锚定顺序 ③按模块出现位置为条目归组(表单分区渲染用)。
import type { ParsedResume } from "@/lib/resume/analysis-schemas";
import { findRawRange } from "@/lib/resume/final-text";

export type StandardKind = "basicInfo" | "education" | "skills" | "experiences" | "projects";

/** 标准模块出现(含无标题锚定的模块):items 为表单渲染时归组到该出现的数组下标 */
export type StandardSection = {
  kind: StandardKind;
  /** 原文标题原文(无标题锚定 → 模块默认名) */
  label: string;
  /** 标题在原文中的字符偏移(无标题锚定 → 内容首现位置) */
  start: number;
  /** 无标题锚定标记(原文没有该模块标题,位置由内容推断) */
  untitled?: boolean;
  /** 工作/实习分区(仅 experiences;null = 合并标题) */
  type?: "工作" | "实习" | null;
  /** 归组到该出现的数组下标(教育/技能/项目/经历;按原文位置判定,单出现时含全部) */
  items?: number[];
};

/** 自定义模块(原文无法归入标准字段的标题段,如 自我评价/获奖情况):只读展示,不做 AI 改写 */
export type CustomSection = {
  kind: "custom";
  label: string;
  start: number;
  /** 内容区间(标题后至下一模块标题前) */
  end: number;
  /** 原文切片内容(逐字保真,不含标题行) */
  content: string;
};

export type SectionRef = StandardSection | CustomSection;

/** 落库结构(Resume.sectionOrder Json):只存检测结构;content/items/无标题锚定均为读取时派生 */
export type StoredSection = {
  kind: string;
  label: string;
  start: number;
  /** 仅自定义模块:内容区间终点 */
  end?: number;
  /** 仅 experiences:工作/实习分区(null = 合并标题) */
  type?: "工作" | "实习" | null;
};

// —— 标题词典:归一化后精确匹配(短行 + 无句末标点),避免把内容行误判为标题 ——

/** 标题行归一化:去首尾标记(▪•·●★【] 等)、去尾冒号、去内部空白 */
function normalizeHeading(line: string): string {
  return line
    .trim()
    .replace(/^[▪▫•·●○★☆□■\-—–|>【\[〈《]+/, "")
    .replace(/[】〉》〕」』)\]]+$/, "")
    .replace(/[:：、]\s*$/, "")
    .replace(/\s+/g, "")
    .trim();
}

const HEADING_LABELS: Record<string, StandardKind> = {
  基本信息: "basicInfo",
  个人信息: "basicInfo",
  个人资料: "basicInfo",
  求职意向: "basicInfo",
  教育经历: "education",
  教育背景: "education",
  学习经历: "education",
  教育信息: "education",
  技能: "skills",
  专业技能: "skills",
  技术栈: "skills",
  技能特长: "skills",
  项目经历: "projects",
  项目经验: "projects",
  个人项目: "projects",
  主要项目: "projects",
};

const COMBINED_EXPERIENCE_LABELS = new Set([
  "工作与实习经历",
  "工作/实习经历",
  "实习与工作经历",
  "工作实习经历",
  "实习工作经历",
  "工作及实习经历",
  "工作、实习经历",
  "实习/工作经历",
]);
const INTERN_LABELS = new Set(["实习经历", "实习经验"]);
const WORK_LABELS = new Set(["工作经历", "工作经验", "职业经历", "任职经历"]);

/** 自定义模块标题词典(精确匹配;其余短行不视为标题,避免公司名等误判) */
const CUSTOM_LABELS = new Set([
  "自我评价",
  "个人评价",
  "自我介绍",
  "个人简介",
  "获奖情况",
  "获奖经历",
  "荣誉奖项",
  "荣誉证书",
  "语言能力",
  "英语水平",
  "兴趣爱好",
  "个人特长",
  "资格证书",
  "证书情况",
  "技能证书",
  "在校经历",
]);

const MAX_HEADING_LENGTH = 15;

function classifyHeading(
  normalized: string
): { kind: StandardKind; type?: "工作" | "实习" | null } | "custom" | null {
  if (HEADING_LABELS[normalized]) return { kind: HEADING_LABELS[normalized] };
  if (COMBINED_EXPERIENCE_LABELS.has(normalized)) return { kind: "experiences", type: null };
  if (INTERN_LABELS.has(normalized)) return { kind: "experiences", type: "实习" };
  if (WORK_LABELS.has(normalized)) return { kind: "experiences", type: "工作" };
  if (CUSTOM_LABELS.has(normalized)) return "custom";
  return null;
}

// —— 标题检测:逐行扫描,输出原文顺序的模块结构(标准 + 自定义) ——

export function detectSections(originalText: string): StoredSection[] {
  const normalizedText = originalText.replace(/\r\n?/g, "\n");
  const lines = normalizedText.split("\n");
  const sections: StoredSection[] = [];
  let offset = 0;

  for (const line of lines) {
    const lineStart = offset;
    offset += line.length + 1;
    const trimmed = line.trim();
    if (!trimmed) continue;
    // ①整行标题:归一化后精确匹配(短行 + 无句末标点)
    let classification: ReturnType<typeof classifyHeading> = null;
    let label = trimmed;
    const normalized = normalizeHeading(trimmed);
    if (normalized && normalized.length <= MAX_HEADING_LENGTH && !/[。;!?]$/.test(trimmed)) {
      classification = classifyHeading(normalized);
    }
    // ②同行标题(粘贴简历常见):「工作经历:某公司前端开发 3 年」→ 冒号前缀匹配词典
    if (!classification) {
      const colonIndex = trimmed.search(/[:：]/);
      if (colonIndex !== -1) {
        const prefix = trimmed.slice(0, colonIndex).trim();
        const prefixNormalized = normalizeHeading(prefix);
        if (prefixNormalized && prefixNormalized.length <= MAX_HEADING_LENGTH) {
          classification = classifyHeading(prefixNormalized);
          if (classification) label = prefix;
        }
      }
    }
    if (!classification) continue;
    if (classification === "custom") {
      sections.push({ kind: "custom", label, start: lineStart });
    } else {
      sections.push({
        kind: classification.kind,
        label,
        start: lineStart,
        ...(classification.type !== undefined ? { type: classification.type } : {}),
      });
    }
  }

  // 自定义模块内容区间终点 = 下一模块标题行开始(内容本身读取时切片,不落库)
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!;
    if (section.kind !== "custom") continue;
    sections[i] = { ...section, end: sections[i + 1]?.start ?? normalizedText.length };
  }
  return sections;
}

// —— 无标题模块锚定 + 条目归组 ——

/** 在 sections(按 start 升序)中把 untitled 模块插入到「内容位置之前最近的标题之后」;未定位 → 追加末尾 */
function insertByPosition(
  sections: StandardSection[],
  untitled: StandardSection,
  position: number | null
): StandardSection[] {
  if (position === null) {
    return [...sections, untitled];
  }
  let insertIndex = sections.length;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i]!.start > position) {
      insertIndex = i;
      break;
    }
  }
  return [...sections.slice(0, insertIndex), untitled, ...sections.slice(insertIndex)];
}

/** 该 kind 的条目在原文中的内容位置(逐字定位失败 → null) */
function locateItem(
  originalText: string,
  parsed: ParsedResume,
  kind: StandardKind,
  index: number
): number | null {
  let snippet: string | null = null;
  if (kind === "education") snippet = parsed.education[index]?.school ?? null;
  else if (kind === "skills") snippet = parsed.skills[index] ?? null;
  else if (kind === "experiences") snippet = parsed.experiences[index]?.company ?? null;
  else if (kind === "projects") snippet = parsed.projects[index]?.name ?? null;
  if (!snippet) return null;
  return findRawRange(originalText, snippet)?.start ?? null;
}

function itemCount(parsed: ParsedResume, kind: StandardKind): number {
  if (kind === "education") return parsed.education.length;
  if (kind === "skills") return parsed.skills.length;
  if (kind === "experiences") return parsed.experiences.length;
  if (kind === "projects") return parsed.projects.length;
  return 0;
}

/** 按出现位置为条目归组(experiences 按 type;其余按内容位置落入各出现的区间;未定位 → 首个出现);
 *  分组键 = 该 kind 出现的序号(同 kind 过滤列表中的下标),与读取侧的 occurrenceIndex 一致 */
function assignItems(
  originalText: string,
  parsed: ParsedResume,
  sections: StandardSection[],
  kind: StandardKind
): Map<number, number[]> {
  const groups = new Map<number, number[]>();
  const occurrences = sections
    .map((s, i) => ({ section: s, index: i }))
    .filter((o) => o.section.kind === kind)
    .map((o, ordinal) => ({ ...o, ordinal }));
  const total = itemCount(parsed, kind);
  if (occurrences.length === 0 || total === 0) return groups;

  for (let item = 0; item < total; item++) {
    let target = occurrences[0]!.ordinal; // 兜底:首个出现
    if (kind === "experiences") {
      // type 匹配;合并标题(type null)接收其余条目
      const type = parsed.experiences[item]?.type;
      const match = occurrences.find((o) => o.section.type === type);
      const combined = occurrences.find((o) => o.section.type === null);
      target = (match ?? combined ?? occurrences[0]!)!.ordinal;
    } else if (occurrences.length > 1) {
      const pos = locateItem(originalText, parsed, kind, item);
      if (pos !== null) {
        // occurrences 按 start 升序:取最后一个 start ≤ pos 的出现(内容所在区间)
        for (let i = occurrences.length - 1; i >= 0; i--) {
          if (pos >= occurrences[i]!.section.start) {
            target = occurrences[i]!.ordinal;
            break;
          }
        }
      }
    }
    if (!groups.has(target)) groups.set(target, []);
    groups.get(target)!.push(item);
  }
  return groups;
}

/** 锚定失败(字段值不在原文中)的无标题模块哨兵:排序时置于所有已定位模块之后(罕见兜底,已文档化) */
const UNLOCATED = Number.POSITIVE_INFINITY;

/** 防御解析 sectionOrder Json(4.10):非法形状 → null(读取时现场重算兜底) */
export function parseStoredSections(value: unknown): StoredSection[] | null {
  if (!Array.isArray(value)) return null;
  const sections: StoredSection[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const { kind, label, start, end, type } = item as Record<string, unknown>;
    if (typeof kind !== "string" || typeof label !== "string" || typeof start !== "number") return null;
    if (end !== undefined && typeof end !== "number") return null;
    if (type !== undefined && type !== null && type !== "工作" && type !== "实习") return null;
    sections.push({ kind, label, start, end, type });
  }
  return sections;
}

// —— 完整模块计划:原文顺序(标题检测 + 无标题锚定)+ 自定义切片 + 条目归组 ——

export function buildSectionPlan(
  originalText: string,
  parsedData: ParsedResume | null,
  stored: StoredSection[] | null
): SectionRef[] {
  const detection = stored && stored.length > 0 ? stored : detectSections(originalText);
  const normalizedText = originalText.replace(/\r\n?/g, "\n");
  let sections: StandardSection[] = [];

  // 结构还原:标准模块 + 自定义切片(内容不含标题行)
  const customs: CustomSection[] = [];
  for (const s of detection) {
    if (s.kind === "custom") {
      const end = s.end ?? normalizedText.length;
      const lineEnd = normalizedText.indexOf("\n", s.start);
      const titleLine =
        lineEnd === -1 ? normalizedText.slice(s.start) : normalizedText.slice(s.start, lineEnd);
      let contentStart = lineEnd === -1 ? normalizedText.length : lineEnd + 1;
      // 同行标题形式(自我评价:认真负责…):内容从冒号后开始,不丢同行片段
      const colonIndex = titleLine.search(/[:：]/);
      if (colonIndex !== -1 && normalizeHeading(titleLine.slice(0, colonIndex)) === normalizeHeading(s.label)) {
        contentStart = s.start + colonIndex + 1;
      }
      const content = normalizedText.slice(Math.min(contentStart, end), end).trim();
      customs.push({ kind: "custom", label: s.label, start: s.start, end, content });
    } else {
      sections.push({
        kind: s.kind as StandardKind,
        label: s.label,
        start: s.start,
        ...(s.kind === "experiences" ? { type: (s.type ?? null) as "工作" | "实习" | null } : {}),
      });
    }
  }

  if (parsedData) {
    // 无标题但有内容的模块:按字段值在原文中的位置锚定(内容位置即模块位置);
    // 已识别标题则跳过(不重复造模块);锚定失败(字段值不在原文)→ 置于已定位模块之后(UNLOCATED 排最后)
    if (!sections.some((s) => s.kind === "basicInfo")) {
      // 基本信息通常位于页首:锚定在姓名位置,找不到 → 0(首个模块)
      const pos = parsedData.basicInfo.name
        ? findRawRange(originalText, parsedData.basicInfo.name)?.start ?? 0
        : 0;
      sections = insertByPosition(sections, { kind: "basicInfo", label: "基本信息", start: pos, untitled: true }, pos);
    }
    for (const kind of ["education", "skills", "projects"] as const) {
      if (sections.some((s) => s.kind === kind) || itemCount(parsedData, kind) === 0) continue;
      const pos = locateItem(originalText, parsedData, kind, 0);
      const untitled: StandardSection = {
        kind,
        label: { education: "教育经历", skills: "技能", projects: "项目经历" }[kind],
        start: pos ?? UNLOCATED,
        untitled: true,
      };
      sections = insertByPosition(sections, untitled, pos);
    }
    // experiences:按 type 分别锚定缺失分区(如只有「实习经历」标题但存在工作条目)。
    // 两种类型都有且原文无任何标题 → 各自锚定到首条内容位置(保原始相对位置,不合并)
    const workItems = parsedData.experiences.filter((e) => e.type === "工作");
    const internItems = parsedData.experiences.filter((e) => e.type === "实习");
    const hasWork = sections.some((s) => s.kind === "experiences" && s.type === "工作");
    const hasIntern = sections.some((s) => s.kind === "experiences" && s.type === "实习");
    const hasCombined = sections.some((s) => s.kind === "experiences" && s.type === null);
    if (workItems.length > 0 && !hasWork && !hasCombined) {
      const pos = findRawRange(originalText, workItems[0]!.company)?.start ?? null;
      sections = insertByPosition(
        sections,
        { kind: "experiences", label: "工作经历", start: pos ?? UNLOCATED, type: "工作", untitled: true },
        pos
      );
    }
    if (internItems.length > 0 && !hasIntern && !hasCombined) {
      const pos = findRawRange(originalText, internItems[0]!.company)?.start ?? null;
      sections = insertByPosition(
        sections,
        { kind: "experiences", label: "实习经历", start: pos ?? UNLOCATED, type: "实习", untitled: true },
        pos
      );
    }
  }

  // 按原文位置整体升序(标题检测天然升序;无标题锚定插入后重新排序兜底)
  sections.sort((a, b) => a.start - b.start);

  // 条目归组
  const withItems: StandardSection[] = sections.map((s) => ({ ...s }));
  if (parsedData) {
    const groups = new Map<StandardKind, Map<number, number[]>>();
    for (const kind of ["education", "skills", "experiences", "projects"] as StandardKind[]) {
      groups.set(kind, assignItems(originalText, parsedData, withItems, kind));
    }
    for (const s of withItems) {
      const kindGroups = groups.get(s.kind);
      const occurrenceIndex = withItems.filter((p) => p.kind === s.kind).indexOf(s);
      const items = kindGroups?.get(occurrenceIndex);
      if (items !== undefined) s.items = items;
    }
  }

  // 标准模块(含无标题锚定)与自定义模块按位置交错合并输出
  return [...withItems, ...customs].sort((a, b) => a.start - b.start);
}
