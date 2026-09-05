// 模块入口卡测试(工作台导航优化 P0):卡片主体与 CTA 是两条独立链接——
// 主体(拉伸覆盖卡面)= 查看模块总览;CTA(ghost 按钮)= 继续当前工作(深链定位,由 actionHref 注入)。
// 双链接不嵌套、目标不同;空态同页例外由 dashboard-view 接线决定。
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FileText } from "lucide-react";
import { ModuleCard } from "../module-card";

describe("ModuleCard 双链接(卡片主体 ≠ CTA)", () => {
  it("主体与 CTA 是两条独立链接,目标不同:主体查看模块总览,CTA 深链最近工作", () => {
    render(
      <ModuleCard
        title="简历优化"
        icon={FileText}
        progress="最近:简历.docx · 3 个优化版本"
        href="/resume?tab=resumes"
        actionHref="/resume?resumeId=r1"
        actionLabel="继续优化"
      />
    );
    expect(screen.getAllByRole("link")).toHaveLength(2); // 双链接不嵌套
    expect(screen.getByRole("link", { name: "查看简历优化" })).toHaveAttribute("href", "/resume?tab=resumes");
    const cta = screen.getByRole("link", { name: "继续优化" });
    expect(cta).toHaveAttribute("href", "/resume?resumeId=r1");
    expect(cta.querySelector("svg")).not.toBeNull(); // P1:CTA 尾部箭头图标(aria-hidden 不进可访问名)
  });

  it("CTA 目标由 actionHref 注入,可与主体同页(空态例外:模块页即创建流程)", () => {
    render(
      <ModuleCard
        title="职业画像"
        icon={FileText}
        progress="完成画像分析,获得推荐方向与专属建议"
        href="/profile"
        actionHref="/profile"
        actionLabel="开始分析"
      />
    );
    expect(screen.getByRole("link", { name: "查看职业画像" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "开始分析" })).toHaveAttribute("href", "/profile");
  });

  it("渲染标题/图标/进展文案;CTA 深链定位当前阶段", () => {
    render(
      <ModuleCard
        title="成长路线"
        icon={FileText}
        progress="3 个阶段 · 6/14 任务完成"
        href="/navigator"
        actionHref="/navigator?focus=current"
        actionLabel="继续学习"
      />
    );
    expect(screen.getByText("成长路线")).toBeInTheDocument();
    expect(screen.getByText("3 个阶段 · 6/14 任务完成")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "查看成长路线" })).toHaveAttribute("href", "/navigator");
    expect(screen.getByRole("link", { name: "继续学习" })).toHaveAttribute(
      "href",
      "/navigator?focus=current"
    );
  });
});
