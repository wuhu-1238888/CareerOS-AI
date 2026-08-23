// AgentRun.input(Json 列)防御解析共享工具。
// stats.ts(工作台「最近工作简历」派生)与 router.ts(serializeRun 透出 resumeId/targetDirection)共用;
// 独立成模块以避免 stats → router 循环引用(router 已 import stats)。
/** 从 AgentRun.input(Json 列)防御提取字符串字段:损坏/缺失 → null */
export function extractRunInputString(input: unknown, key: string): string | null {
  if (!input || typeof input !== "object") return null;
  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}
