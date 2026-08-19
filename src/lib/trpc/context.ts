// tRPC 上下文:会话 + 数据库客户端(每次请求独立创建)
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function createContext() {
  const session = await auth();
  return { session, prisma };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
