// 首字母头像(已确认决策):名字首字 + 自动配色,零文件存储;上传待 4.1 存储抽象就绪后升级。
// 配色:用户显式设置优先(User.avatarColor,1.8);缺省按名字哈希确定性取 5 预设色之一(与 tokens 对齐)。
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// 预设头像色(对应 tokens:green-600 / violet-700 / warning / info / ink-secondary)
export const AVATAR_COLORS = ["#0c8a5f", "#7c5cfc", "#b45309", "#2e6fe8", "#57534b"] as const;

/** 按名字确定性取色:同一名字永远得到同一颜色,无需存储 */
export function avatarColorFromName(name: string): string {
  let hash = 0;
  for (const ch of name) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const SIZES = { sm: "size-8", md: "size-10" } as const;

export interface UserAvatarProps {
  name: string;
  /** 用户设置的配色(可为 null,自动配色) */
  color?: string | null;
  size?: keyof typeof SIZES;
}

export function UserAvatar({ name, color, size = "md" }: UserAvatarProps) {
  const resolved = color ?? avatarColorFromName(name);
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <Avatar className={SIZES[size]} aria-hidden>
      <AvatarFallback className="select-none text-body text-white" style={{ backgroundColor: resolved }}>
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
