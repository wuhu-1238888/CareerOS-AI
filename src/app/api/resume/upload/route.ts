// 简历上传 Route Handler(4.1):只做鉴权 + 表单解析薄壳,业务逻辑在 src/lib/resume/upload.ts。
// middleware 不拦 /api,必须自鉴权(401 JSON)。
import { auth } from "@/lib/auth";
import { handleResumeUpload } from "@/lib/resume/upload";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let file: unknown;
  try {
    const formData = await request.formData();
    file = formData.get("file");
  } catch {
    return Response.json({ error: "无效的上传请求" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return Response.json({ error: "缺少文件字段" }, { status: 400 });
  }

  try {
    const outcome = await handleResumeUpload({ userId: session.user.id, file });
    if (!outcome.ok) {
      const status = outcome.code === "too-large" ? 413 : outcome.code === "storage-error" ? 500 : 400;
      return Response.json({ error: outcome.error, code: outcome.code }, { status });
    }
    return Response.json(outcome);
  } catch {
    return Response.json({ error: "上传失败,请稍后重试" }, { status: 500 });
  }
}
