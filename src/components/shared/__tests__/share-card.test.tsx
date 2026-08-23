// 分享卡片测试(6.8):两变体渲染(profile 昵称/摘要/能力标签/优势 3 条/推荐方向大数字/分值条替代雷达,
// roadmap 目标方向/概要/阶段列表/总进度)、AiBadge 标识、无画像降级(无推荐方向/无昵称)、品牌落款
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShareCard, type ProfileShareData, type RoadmapShareData } from "../share-card";

const profileData: ProfileShareData = {
  variant: "profile",
  nickname: "张伟",
  summary: "3 年后端开发经验,擅长 Python 与系统设计",
  abilityTags: [
    { name: "Python", level: "精通" },
    { name: "SQL", level: "熟练" },
    { name: "Docker", level: "基础" },
  ],
  strengths: [
    { title: "系统设计能力强" },
    { title: "独立交付完整后端项目" },
    { title: "快速学习新技术" },
  ],
  topDirection: { name: "后端开发工程师", matchScore: 88 },
  radar: [
    { dimension: "产品", value: 60 },
    { dimension: "技术", value: 85 },
    { dimension: "数据", value: 70 },
    { dimension: "沟通", value: 65 },
    { dimension: "项目", value: 80 },
    { dimension: "行业", value: 55 },
  ],
};

const roadmapData: RoadmapShareData = {
  variant: "roadmap",
  targetDirection: "后端开发",
  totalDuration: "6 个月",
  finalGoal: "达到初级后端开发工程师水平",
  weeklyHours: 10,
  stages: [
    { name: "夯实基础", goal: "掌握 Python 与 SQL 基础" },
    { name: "框架进阶", goal: "掌握 Web 框架与工程化" },
  ],
  percent: 43,
};

describe("ShareCard profile 变体", () => {
  it("昵称/摘要/能力标签(名称+等级)/优势 3 条/推荐方向大数字/品牌落款", () => {
    render(<ShareCard data={profileData} />);
    expect(screen.getByText("我的职业画像")).toBeInTheDocument();
    expect(screen.getByText("张伟")).toBeInTheDocument();
    expect(screen.getByText("3 年后端开发经验,擅长 Python 与系统设计")).toBeInTheDocument();
    expect(screen.getByLabelText("能力标签")).toBeInTheDocument();
    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("精通")).toBeInTheDocument();
    expect(screen.getByText("核心优势")).toBeInTheDocument();
    expect(screen.getByText("系统设计能力强")).toBeInTheDocument();
    expect(screen.getByText("独立交付完整后端项目")).toBeInTheDocument();
    expect(screen.getByText("快速学习新技术")).toBeInTheDocument();
    // 推荐方向 + 匹配度大数字
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("匹配度 · 后端开发工程师")).toBeInTheDocument();
    expect(screen.getByText("CareerOS · AI 职业成长助手")).toBeInTheDocument();
  });

  it("AiBadge 标识 AI 内容(卡头唯一一枚)", () => {
    render(<ShareCard data={profileData} />);
    expect(screen.getByText("AI 分析")).toBeInTheDocument();
  });

  it("分值条替代雷达:六维全部渲染,按分值降序且宽度与分值一致(零硬编码色值)", () => {
    render(<ShareCard data={profileData} />);
    const list = screen.getByLabelText("六维能力");
    const rows = list.querySelectorAll("li");
    expect(rows).toHaveLength(6);
    const first = rows[0]!;
    expect(first).toHaveTextContent("技术85");
    const firstFill = first.querySelector("span[style]");
    expect(firstFill).toHaveAttribute("style", "width: 85%;");
    const last = rows[5]!;
    expect(last).toHaveTextContent("行业55");
    // 全 token 类名:填充条使用 bg-green-600 而非任意色值
    expect(firstFill!.className).toContain("bg-green-600");
  });

  it("无推荐方向(无画像降级):显示占位文案", () => {
    render(<ShareCard data={{ ...profileData, topDirection: null }} />);
    expect(screen.getByText("暂无推荐方向")).toBeInTheDocument();
    expect(screen.queryByText("匹配度 · 后端开发工程师")).toBeNull();
  });

  it("无昵称:不渲染昵称行", () => {
    render(<ShareCard data={{ ...profileData, nickname: undefined }} />);
    expect(screen.queryByText("张伟")).toBeNull();
    expect(screen.getByText("3 年后端开发经验,擅长 Python 与系统设计")).toBeInTheDocument();
  });
});

describe("ShareCard roadmap 变体", () => {
  it("目标方向/最终目标/总进度+每周投入/阶段列表(序号+名称+目标)/品牌落款", () => {
    render(<ShareCard data={roadmapData} />);
    expect(screen.getByText("我的成长路线")).toBeInTheDocument();
    expect(screen.getByText("成为「后端开发」的 6 个月 路径")).toBeInTheDocument();
    expect(screen.getByText("达到初级后端开发工程师水平")).toBeInTheDocument();
    expect(screen.getByText("总进度 43% · 每周 10 小时")).toBeInTheDocument();
    const stages = screen.getByLabelText("成长阶段");
    const items = stages.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("1夯实基础掌握 Python 与 SQL 基础");
    expect(items[1]).toHaveTextContent("2框架进阶掌握 Web 框架与工程化");
    expect(screen.getByText("CareerOS · AI 职业成长助手")).toBeInTheDocument();
  });

  it("进度条宽度与 percent 一致;summary 缺失回退「成长」路径", () => {
    render(
      <ShareCard
        data={{ ...roadmapData, totalDuration: null, finalGoal: null, percent: 100 }}
      />
    );
    expect(screen.getByText("成为「后端开发」的 成长 路径")).toBeInTheDocument();
    expect(screen.queryByText("达到初级后端开发工程师水平")).toBeNull();
    expect(screen.getByText("总进度 100% · 每周 10 小时")).toBeInTheDocument();
  });
});
