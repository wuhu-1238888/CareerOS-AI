// 共享错误文案转换(DesignRules L229:禁止裸 JSON / 字段名 / 堆栈进入 UI)。
// tRPC v11 默认链路把 zod issue 的 JSON 序列化串塞进 err.message(HTTP 400 BAD_REQUEST);
// 此处识别 JSON 形态并提取首个非空 issue.message,普通中文文案原样透传,其余兜底。
const FALLBACK = "操作失败,请稍后重试";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** 从 JSON 解析结果中提取首个非空 message;找不到返回 null */
function extractIssueMessage(parsed: unknown): string | null {
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const m = extractIssueMessage(item);
      if (m) return m;
    }
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (typeof parsed.message === "string" && parsed.message.length > 0) return parsed.message;
  if (Array.isArray(parsed.issues)) {
    const m = extractIssueMessage(parsed.issues);
    if (m) return m;
  }
  // 兼容扁平化形态 { formErrors: string[], fieldErrors: Record<string, string[]> }
  if (Array.isArray(parsed.formErrors)) {
    const m = parsed.formErrors.find((x) => typeof x === "string" && x.length > 0);
    if (typeof m === "string") return m;
  }
  if (isRecord(parsed.fieldErrors)) {
    for (const value of Object.values(parsed.fieldErrors)) {
      if (Array.isArray(value)) {
        const m = value.find((x) => typeof x === "string" && x.length > 0);
        if (typeof m === "string") return m;
      }
    }
  }
  return null;
}

/**
 * 后端错误 → 用户可读文案:
 * - 空 message / 非 Error → 兜底文案
 * - zod issue JSON(以 { / [ 开头且可解析)→ 首个 issue 的中文 message
 * - 其余(已是中文的业务文案)原样透传
 */
export function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (!raw) return FALLBACK;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return raw;
  try {
    return extractIssueMessage(JSON.parse(trimmed)) ?? FALLBACK;
  } catch {
    // 以 { / [ 开头的普通文案:不误伤,原样透传
    return raw;
  }
}
