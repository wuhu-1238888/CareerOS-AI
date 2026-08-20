import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { NavigatorHub } from "@/components/navigator/navigator-hub";

export const metadata: Metadata = { title: "成长路线 - CareerOS AI" };

// 职业导航模块(M3):方向选择 → 生成过程 → 成长路线时间线(任务交互)
export default function NavigatorPage() {
  return (
    <>
      <PageHeader title="成长路线" description="从当前能力到目标岗位的个性化成长路径" />
      <NavigatorHub />
    </>
  );
}
