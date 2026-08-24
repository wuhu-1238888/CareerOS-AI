import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { BackButton } from "@/components/shared/back-button";
import { GrowthView } from "@/components/growth/growth-view";

export const metadata: Metadata = { title: "个人成长报告 - CareerOS AI" };

// 个人成长报告页(8.2,D1:工作台成长区块深链进入,不新增顶栏入口):
// 画像版本演进 / 任务完成趋势 / 匹配度变化曲线 / 匿名路径有效性聚合((dashboard) 组下,middleware 已覆盖)
// 视觉层级:页面级「← 返回工作台」文本链接(低强调)→ H1 标题 → 描述 → 主体 Card(同左边缘)
export default function GrowthReportPage() {
  return (
    <>
      <BackButton label="返回工作台" className="mb-3" />
      <PageHeader title="个人成长报告" description="回看你的画像演进、任务节奏与匹配度变化" />
      <GrowthView />
    </>
  );
}
