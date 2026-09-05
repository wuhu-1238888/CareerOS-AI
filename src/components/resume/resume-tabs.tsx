"use client";
// 简历优化页内 Tab(IA 调整 2026-09):「简历优化」(ResumeHub 状态机)与「我的简历」(ResumeCenter,原简历中心并入)两级视图。
// 活跃 tab 由 ?tab=resumes 驱动(缺省回落「简历优化」);切换用 router.replace 保留其他参数(resumeId 等),
// 回默认 tab 时删除 tab 参数保持 URL 干净。条件渲染只挂当前 tab(hub 轮询/上传组件卸载即停)。
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";
import { ResumeCenter } from "./resume-center";
import { ResumeHub } from "./resume-hub";

const RESUMES_TAB = "resumes";
const OPTIMIZE_TAB = "resume";

export function ResumeTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  function handleTabChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === RESUMES_TAB) {
      params.set("tab", RESUMES_TAB);
    } else {
      params.delete("tab");
    }
    const qs = params.toString();
    router.replace(qs ? `/resume?${qs}` : "/resume");
  }

  return (
    <Tabs
      aria-label="简历模块"
      value={tab === RESUMES_TAB ? RESUMES_TAB : OPTIMIZE_TAB}
      onValueChange={handleTabChange}
      items={[
        { value: OPTIMIZE_TAB, label: "简历优化", content: <ResumeHub /> },
        { value: RESUMES_TAB, label: "我的简历", content: <ResumeCenter /> },
      ]}
    />
  );
}
