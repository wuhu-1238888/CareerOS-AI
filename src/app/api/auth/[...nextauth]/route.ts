// NextAuth 回调端点(框架必需的 Route Handler 例外,见 technical-design API 层约定)
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
