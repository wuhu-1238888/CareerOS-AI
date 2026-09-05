import { redirect } from "next/navigation";

// 旧「简历中心」顶级页面(IA 调整 2026-09):简历管理能力已并入简历优化页「我的简历」Tab(/resume?tab=resumes)。
// 本页保留为兼容重定向(复用 src/app/page.tsx 的 redirect 模式),旧书签/外链/历史测试链接不产生死链。
export default function ResumesPage() {
  redirect("/resume?tab=resumes");
}
