// 最终采纳文本(4.4,纯函数无 node 依赖,前后端共用):
// 在简历原文中按 status=accepted 的修改片段做精确替换(pending/rejected 保持原文)。
// 对比视图 / ATS 评分 / 导出全链路共用 buildFinalResumeText,杜绝三份推导逻辑漂移。
// 片段定位采用空白归一化匹配(允许 LLM 在换行/空格上有细微偏差),替换按原文位置升序执行。
import type { Modification } from "@/lib/resume/analysis-schemas";

/** 参与替换的最小形状:status 来自 Optimization 行,文本来自其落库字段 */
export type OptimizationText = {
  status: string;
  originalText: string;
  optimizedText: string;
};

// 空白归一化:连续空白折叠为单空格并去首尾,用于「逐字存在」校验与片段定位
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

type RawRange = { start: number; end: number };

/** 在原文中按空白归一化匹配片段,返回其在原始文本中的区间(未命中 → null) */
function findRawRange(haystack: string, needle: string): RawRange | null {
  const normalizedNeedle = normalizeWhitespace(needle);
  if (!normalizedNeedle) return null;

  // 折叠空白并记录每个归一化字符对应的原文下标(空白折叠映射到空白串首字符)
  let collapsed = "";
  const map: number[] = [];
  for (let i = 0; i < haystack.length; i++) {
    const ch = haystack[i]!;
    if (/\s/.test(ch)) {
      if (collapsed.length === 0 || collapsed[collapsed.length - 1] !== " ") {
        collapsed += " ";
        map.push(i);
      }
    } else {
      collapsed += ch;
      map.push(i);
    }
  }

  const trimmed = collapsed.trim();
  const leadingSpaces = collapsed.length - collapsed.trimStart().length;
  const index = trimmed.indexOf(normalizedNeedle);
  if (index === -1) return null;

  const normStart = index + leadingSpaces;
  const normEnd = normStart + normalizedNeedle.length;
  const start = map[normStart]!;
  const end = map[normEnd - 1]! + 1;
  return { start, end };
}

// 校验规则(4.4):每条 originalText 空白归一化后须逐字存在于原文;区间互不重叠;按位置升序返回
export function validateModifications(
  originalText: string,
  modifications: Modification[]
): { ok: true; modifications: Modification[] } | { ok: false; error: string } {
  const normalizedOriginal = normalizeWhitespace(originalText);
  const located: { modification: Modification; start: number; end: number }[] = [];

  for (const modification of modifications) {
    const needle = normalizeWhitespace(modification.originalText);
    if (!needle) {
      return { ok: false, error: "存在空白的原文引用,请重新分析" };
    }
    const index = normalizedOriginal.indexOf(needle);
    if (index === -1) {
      return { ok: false, error: "改写结果与简历原文不一致,请重新分析" };
    }
    located.push({ modification, start: index, end: index + needle.length });
  }

  located.sort((a, b) => a.start - b.start);
  for (let i = 1; i < located.length; i++) {
    if (located[i]!.start < located[i - 1]!.end) {
      return { ok: false, error: "修改建议区间重叠,请重新分析" };
    }
  }

  return { ok: true, modifications: located.map((l) => l.modification) };
}

/** 按 accepted 修改在原文中做精确替换(pending/rejected 保持原文);未命中的片段回退保留原文 */
export function buildFinalResumeText(originalText: string, optimizations: OptimizationText[]): string {
  const accepted = optimizations.filter((o) => o.status === "accepted");

  const located = accepted
    .map((o) => ({ optimization: o, range: findRawRange(originalText, o.originalText) }))
    .filter((x): x is { optimization: OptimizationText; range: RawRange } => x.range !== null)
    .sort((a, b) => a.range.start - b.range.start);

  // 重叠区间防御性跳过后者(管线层 validateModifications 已拦截,此处为直调兜底)
  const nonOverlapping: { optimization: OptimizationText; range: RawRange }[] = [];
  for (const item of located) {
    const previous = nonOverlapping[nonOverlapping.length - 1];
    if (!previous || item.range.start >= previous.range.end) {
      nonOverlapping.push(item);
    }
  }

  let result = originalText;
  let offset = 0;
  for (const { optimization, range } of nonOverlapping) {
    const start = range.start + offset;
    const end = range.end + offset;
    result = result.slice(0, start) + optimization.optimizedText + result.slice(end);
    offset += optimization.optimizedText.length - (range.end - range.start);
  }
  return result;
}
