// 简历原文件下载 Route Handler(4.1):鉴权 + 归属校验 + 解密读取。
// 设置页「简历文件管理」下载链接使用;文件不存在或非本人一律 404(不泄露存在性)。
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getFileStorage } from "@/lib/file/storage";
import { FileNotFoundError } from "@/lib/file/local-fs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "缺少文件 id" }, { status: 400 });
  }

  const resume = await prisma.resume.findFirst({ where: { id, userId: session.user.id } });
  if (!resume?.storageKey) {
    return Response.json({ error: "文件不存在" }, { status: 404 });
  }

  try {
    const data = await getFileStorage().read(resume.storageKey);
    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(resume.fileName ?? "resume")}`;
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": resume.mimeType ?? "application/octet-stream",
        "Content-Length": String(data.length),
        "Content-Disposition": disposition,
      },
    });
  } catch (err) {
    if (err instanceof FileNotFoundError) {
      return Response.json({ error: "文件不存在" }, { status: 404 });
    }
    return Response.json({ error: "下载失败,请稍后重试" }, { status: 500 });
  }
}
