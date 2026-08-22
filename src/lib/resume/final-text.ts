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

/** 在原文中按空白归一化匹配片段,返回其在原始文本中的区间(未命中 → null);
 *  fromRawStart:从该原始下标起向后找(用于同一短语多处出现时迭代取下一命中;map 单调,归一化空间可精确映射)。
 *  4.10 起导出:模块顺序检测用字段值在原文中定位内容位置(无标题模块锚定/多分区条目归组) */
export function findRawRange(haystack: string, needle: string, fromRawStart = 0): RawRange | null {
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
  // fromRawStart → 归一化空间搜索起点:第一个 map 值 ≥ fromRawStart 的下标(map 严格单调)
  let searchFrom = 0;
  if (fromRawStart > 0) {
    let i = 0;
    while (i < map.length && map[i]! < fromRawStart) i++;
    searchFrom = i - leadingSpaces;
    if (searchFrom < 0) searchFrom = 0;
  }
  const index = trimmed.indexOf(normalizedNeedle, searchFrom);
  if (index === -1) return null;

  const normStart = index + leadingSpaces;
  const normEnd = normStart + normalizedNeedle.length;
  const start = map[normStart]!;
  const end = map[normEnd - 1]! + 1;
  return { start, end };
}

// 校验规则(4.4,本次修订):逐条过滤——每条 originalText 空白归一化后须逐字存在于原文,且区间互不重叠;
// 无效条目(空白引用/未命中/与已接受区间重叠)丢弃,不拖垮整次;≥1 条有效即成功,0 条才失败(产品目标不变:
// 凡展示给用户的「修改前」必逐字来自原文)。定位与 buildFinalResumeText 共用 findRawRange(统一原始下标空间),
// 同一短语多处出现时取下一处不重叠命中(修复此前 indexOf 首次命中导致的误报重叠)。
export function validateModifications(
  originalText: string,
  modifications: Modification[]
): { ok: true; modifications: Modification[] } | { ok: false; error: string } {
  const accepted: { modification: Modification; start: number; end: number }[] = [];

  for (const modification of modifications) {
    const needle = normalizeWhitespace(modification.originalText);
    if (!needle) continue; // 空白引用 → 丢弃该条

    // 迭代取下一命中(原始下标空间),跳过与已接受区间重叠的候选;取最早的不重叠命中
    let range = findRawRange(originalText, needle);
    while (range) {
      const overlaps = accepted.some((a) => range!.start < a.end && range!.end > a.start);
      if (!overlaps) break;
      range = findRawRange(originalText, needle, range.start + 1);
    }
    if (range) {
      accepted.push({ modification, start: range.start, end: range.end });
    }
  }

  if (accepted.length === 0) {
    return { ok: false, error: "改写结果与简历原文不一致,请重新分析" };
  }

  accepted.sort((a, b) => a.start - b.start);
  return { ok: true, modifications: accepted.map((a) => a.modification) };
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

/** 版本 canonical finalText(4.10-layout 修订,单一构造入口):
 * 预览 / 复制 / PDF 导出(serializeVersion)与 ATS 评分(scoreAts)全部经此构造,杜绝各链路自行组装导致文本漂移。
 * 输入为 DB 行形状(文本列可空,落库路径保证非空 → 防御过滤);输出即「最终文本预览」渲染的同一字符串 */
export function buildFinalTextForVersion(
  originalText: string,
  optimizations: { status: string; originalText: string | null; optimizedText: string | null }[]
): string {
  return buildFinalResumeText(
    originalText,
    optimizations.filter(
      (o): o is OptimizationText => o.originalText !== null && o.optimizedText !== null
    )
  );
}
