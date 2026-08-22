// 相对时间格式化(5.1 工作台 Agent 卡「上次分析」):今天/昨天 HH:mm,同年 → M月D日 HH:mm,跨年 → YYYY年M月D日。
// 无效时间 → 空串(调用方直接不渲染)。
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  const hm = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  if (diffDays <= 0) return `今天 ${hm}`; // 今天或未来(时钟偏移)均按「今天」
  if (diffDays === 1) return `昨天 ${hm}`;
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}月${date.getDate()}日 ${hm}`;
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
