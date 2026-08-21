// @vitest-environment node
// 模块顺序检测(4.10,纯函数):标题检测归一化/自定义模块切片/同形误判/无标题锚定/
// 工作实习拆分与合并标题/多分区条目归组/兜底/stored 优先
import { describe, expect, it } from "vitest";
import { buildSectionPlan, detectSections } from "@/lib/resume/section-order";
import type { ParsedResume } from "@/lib/resume/analysis-schemas";

function parsed(overrides: Partial<ParsedResume> = {}): ParsedResume {
  return {
    basicInfo: { name: "", targetPosition: "", phone: "", email: "" },
    education: [],
    skills: [],
    experiences: [],
    projects: [],
    ...overrides,
  };
}

describe("detectSections(标题检测)", () => {
  it("标准顺序:按原文位置输出各模块标题", () => {
    const text = [
      "基本信息",
      "张三",
      "教育经历",
      "某大学",
      "技能",
      "Python、SQL",
      "工作经历",
      "某公司",
      "项目经历",
      "某项目",
    ].join("\n");
    expect(detectSections(text).map((s) => s.kind)).toEqual([
      "basicInfo",
      "education",
      "skills",
      "experiences",
      "projects",
    ]);
    const sections = detectSections(text);
    expect(sections[0]!.start).toBe(0); // 首行偏移 0
    expect(sections[1]!.start).toBeGreaterThan(sections[0]!.start);
    // 位置严格升序
    for (let i = 1; i < sections.length; i++) {
      expect(sections[i]!.start).toBeGreaterThan(sections[i - 1]!.start);
    }
  });

  it("标题归一化:首标记(【▪)、尾冒号、内部空白均命中", () => {
    const text = "【基本信息】\n▪ 教育经历:\n专 业 技 能 :\n工作 / 实习 经历\n项目经历";
    expect(detectSections(text).map((s) => s.kind)).toEqual([
      "basicInfo",
      "education",
      "skills",
      "experiences",
      "projects",
    ]);
    expect(detectSections(text)[2]).toMatchObject({ kind: "skills" });
    expect(detectSections(text)[2]).not.toHaveProperty("type");
    expect(detectSections(text)[3]).toMatchObject({ kind: "experiences", type: null });
  });

  it("自定义模块:命中词典、保留原文标题、内容切片不含标题行", () => {
    const text = [
      "基本信息",
      "张三",
      "自我评价",
      "性格开朗,责任心强,具备良好的团队协作能力。",
      "教育经历",
      "某大学",
    ].join("\n");
    const sections = detectSections(text);
    expect(sections.map((s) => s.kind)).toEqual(["basicInfo", "custom", "education"]);
    const custom = sections[1]!;
    expect(custom.label).toBe("自我评价");
    expect(text.slice(custom.start).startsWith("自我评价")).toBe(true);
    expect(custom.end).toBe(text.indexOf("教育经历"));
  });

  it("自定义模块末尾无后继模块:内容区间至原文末尾", () => {
    const text = "基本信息\n张三\n兴趣爱好\n读书、跑步";
    const sections = detectSections(text);
    expect(sections[1]).toMatchObject({ kind: "custom", label: "兴趣爱好", end: text.length });
  });

  it("同形误判防护:内容短行/句末标点句不识别为标题", () => {
    const text = "技能\n办公软件技能\n熟悉办公软件技能。\n教育经历";
    expect(detectSections(text).map((s) => s.kind)).toEqual(["skills", "education"]);
  });

  it("未知短行不识别为标题(公司名等)", () => {
    const text = "基本信息\n张三\n阿里巴巴\n教育经历\n某大学";
    expect(detectSections(text).map((s) => s.kind)).toEqual(["basicInfo", "education"]);
  });

  it("CRLF 与空行不影响检测", () => {
    const text = "基本信息\r\n张三\r\n\r\n教育经历\r\n某大学";
    expect(detectSections(text).map((s) => s.kind)).toEqual(["basicInfo", "education"]);
  });

  it("同行标题(粘贴常见):「工作经历:某公司前端开发」按冒号前缀识别", () => {
    const text = "张三\n求职意向:前端开发工程师\n工作经历:某公司前端开发 3 年";
    const sections = detectSections(text);
    expect(sections.map((s) => s.kind)).toEqual(["basicInfo", "experiences"]);
    expect(sections[0]).toMatchObject({ kind: "basicInfo", label: "求职意向" });
    expect(sections[1]).toMatchObject({ kind: "experiences", label: "工作经历", type: "工作" });
  });

  it("同行自定义标题:内容从冒号后开始,不丢同行片段", () => {
    const text = "基本信息\n张三\n自我评价:认真负责、执行力强\n教育经历\n某大学";
    const plan = buildSectionPlan(
      text,
      parsed({
        basicInfo: { name: "张三", targetPosition: "", phone: "", email: "" },
        education: [{ school: "某大学", degree: "", major: "", timeRange: { start: "2018", end: "2022" } }],
      }),
      null
    );
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "custom", "education"]);
    if (plan[1]!.kind === "custom") {
      expect(plan[1].label).toBe("自我评价");
      expect(plan[1].content).toBe("认真负责、执行力强");
    }
  });

  it("前缀非词典词不误判(如 联系电话:138…)", () => {
    const text = "基本信息\n张三\n联系电话:13800000000\n教育经历\n某大学";
    expect(detectSections(text).map((s) => s.kind)).toEqual(["basicInfo", "education"]);
  });

  it("工作/实习分开标题:type 分别落 工作/实习", () => {
    const text = "基本信息\n张三\n工作经历\n某公司\n实习经历\n某大厂";
    expect(detectSections(text)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "experiences", type: "工作" }),
        expect.objectContaining({ kind: "experiences", type: "实习" }),
      ])
    );
  });
});

describe("buildSectionPlan(模块计划)", () => {
  it("标准五模块:计划顺序 = 原文顺序,items 归组到唯一出现", () => {
    const text = ["基本信息", "张三", "教育经历", "某大学", "技能", "Python、SQL", "工作经历", "某公司", "项目经历", "某项目"].join("\n");
    const data = parsed({
      basicInfo: { name: "张三", targetPosition: "前端工程师", phone: "", email: "" },
      education: [{ school: "某大学", degree: "本科", major: "计算机", timeRange: { start: "2018", end: "2022" } }],
      skills: ["Python", "SQL"],
      experiences: [
        { type: "工作", company: "某公司", role: "前端", timeRange: { start: "2022", end: "至今" }, description: "" },
      ],
      projects: [{ name: "某项目", role: "", timeRange: { start: "2021", end: "2022" }, description: "" }],
    });
    const plan = buildSectionPlan(text, data, null);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "education", "skills", "experiences", "projects"]);
    expect((plan[0] as { untitled?: boolean }).untitled).toBeUndefined();
    const education = plan[1] as { items?: number[] };
    expect(education.items).toEqual([0]);
  });

  it("自定义模块按原始位置交错输出,内容逐字保真", () => {
    const text = [
      "基本信息",
      "张三",
      "教育经历",
      "某大学",
      "获奖情况",
      "校级一等奖学金",
      "技能",
      "Python",
    ].join("\n");
    const data = parsed({
      basicInfo: { name: "张三", targetPosition: "", phone: "", email: "" },
      education: [{ school: "某大学", degree: "", major: "", timeRange: { start: "2020", end: "2024" } }],
      skills: ["Python"],
    });
    const plan = buildSectionPlan(text, data, null);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "education", "custom", "skills"]);
    const custom = plan[2]!;
    expect(custom.kind).toBe("custom");
    if (custom.kind === "custom") {
      expect(custom.content).toBe("校级一等奖学金");
      expect(custom.label).toBe("获奖情况");
    }
  });

  it("缺失模块:无标题但有内容 → 按字段值锚定到原文位置", () => {
    // 原文没有「教育经历」「技能」标题
    const text = ["基本信息", "张三", "某大学 本科", "Python、SQL、Go", "工作经历", "某公司"].join("\n");
    const data = parsed({
      basicInfo: { name: "张三", targetPosition: "", phone: "", email: "" },
      education: [{ school: "某大学", degree: "本科", major: "", timeRange: { start: "2018", end: "2022" } }],
      skills: ["Python", "SQL", "Go"],
      experiences: [
        { type: "工作", company: "某公司", role: "工程师", timeRange: { start: "2022", end: "至今" }, description: "" },
      ],
    });
    const plan = buildSectionPlan(text, data, null);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "education", "skills", "experiences"]);
    expect(plan[1]).toMatchObject({ kind: "education", untitled: true, start: text.indexOf("某大学") });
    expect(plan[2]).toMatchObject({ kind: "skills", untitled: true, start: text.indexOf("Python") });
    // 锚定位置严格遵循原文顺序
    expect(plan[1]!.start).toBeLessThan(plan[2]!.start);
  });

  it("无标题简历(全部缺失):各模块按内容位置锚定,基本信息锚定姓名", () => {
    const text = ["李四", "某大学 硕士", "Java、Spring", "某创业公司 后端", "电商平台项目"].join("\n");
    const data = parsed({
      basicInfo: { name: "李四", targetPosition: "后端工程师", phone: "", email: "" },
      education: [{ school: "某大学", degree: "硕士", major: "", timeRange: { start: "2020", end: "2023" } }],
      skills: ["Java", "Spring"],
      experiences: [
        { type: "工作", company: "某创业公司", role: "后端", timeRange: { start: "2023", end: "至今" }, description: "" },
      ],
      projects: [{ name: "电商平台项目", role: "", timeRange: { start: "2022", end: "2023" }, description: "" }],
    });
    const plan = buildSectionPlan(text, data, null);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "education", "skills", "experiences", "projects"]);
    expect(plan[0]).toMatchObject({ untitled: true, start: 0 });
    for (let i = 1; i < plan.length; i++) {
      expect(plan[i]!.start).toBeGreaterThanOrEqual(plan[i - 1]!.start);
    }
  });

  it("重复标题(两个项目经历):条目按内容位置归组到各自分区", () => {
    const text = [
      "基本信息",
      "张三",
      "项目经历",
      "电商平台项目",
      "技能",
      "Python",
      "项目经历",
      "开源工具项目",
    ].join("\n");
    const data = parsed({
      basicInfo: { name: "张三", targetPosition: "", phone: "", email: "" },
      skills: ["Python"],
      projects: [
        { name: "电商平台项目", role: "", timeRange: { start: "2021", end: "2022" }, description: "" },
        { name: "开源工具项目", role: "", timeRange: { start: "2022", end: "2023" }, description: "" },
      ],
    });
    const plan = buildSectionPlan(text, data, null);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "projects", "skills", "projects"]);
    const projectSections = plan.filter((s) => s.kind === "projects") as { items?: number[] }[];
    expect(projectSections).toHaveLength(2);
    expect(projectSections[0]!.items).toEqual([0]); // 第一个分区:第一个项目
    expect(projectSections[1]!.items).toEqual([1]); // 第二个分区:第二个项目
  });

  it("工作/实习分标题:条目按 type 归组,顺序保持原文分区位置", () => {
    const text = [
      "基本信息",
      "张三",
      "实习经历",
      "某大厂 实习生",
      "教育经历",
      "某大学",
      "工作经历",
      "某公司 工程师",
    ].join("\n");
    const data = parsed({
      basicInfo: { name: "张三", targetPosition: "", phone: "", email: "" },
      education: [{ school: "某大学", degree: "", major: "", timeRange: { start: "2016", end: "2020" } }],
      experiences: [
        { type: "实习", company: "某大厂", role: "实习生", timeRange: { start: "2019", end: "2019" }, description: "" },
        { type: "工作", company: "某公司", role: "工程师", timeRange: { start: "2020", end: "至今" }, description: "" },
      ],
    });
    const plan = buildSectionPlan(text, data, null);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "experiences", "education", "experiences"]);
    const expSections = plan.filter((s) => s.kind === "experiences") as {
      type?: "工作" | "实习" | null;
      items?: number[];
    }[];
    expect(expSections[0]).toMatchObject({ type: "实习", items: [0] });
    expect(expSections[1]).toMatchObject({ type: "工作", items: [1] });
  });

  it("合并标题(工作/实习经历):全部条目归一个分区", () => {
    const text = ["基本信息", "张三", "工作/实习经历", "某大厂 实习生", "某公司 工程师"].join("\n");
    const data = parsed({
      basicInfo: { name: "张三", targetPosition: "", phone: "", email: "" },
      experiences: [
        { type: "实习", company: "某大厂", role: "实习生", timeRange: { start: "2019", end: "2019" }, description: "" },
        { type: "工作", company: "某公司", role: "工程师", timeRange: { start: "2020", end: "至今" }, description: "" },
      ],
    });
    const plan = buildSectionPlan(text, data, null);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "experiences"]);
    const section = plan[1] as { type?: "工作" | "实习" | null; items?: number[] };
    expect(section.type).toBeNull();
    expect(section.items).toEqual([0, 1]);
  });

  it("只有「工作经历」标题但存在实习条目:实习锚定为无标题分区,按内容位置插入", () => {
    const text = ["基本信息", "张三", "某大厂 实习生", "工作经历", "某公司 工程师"].join("\n");
    const data = parsed({
      basicInfo: { name: "张三", targetPosition: "", phone: "", email: "" },
      experiences: [
        { type: "实习", company: "某大厂", role: "实习生", timeRange: { start: "2019", end: "2019" }, description: "" },
        { type: "工作", company: "某公司", role: "工程师", timeRange: { start: "2020", end: "至今" }, description: "" },
      ],
    });
    const plan = buildSectionPlan(text, data, null);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "experiences", "experiences"]);
    expect(plan[1]).toMatchObject({ type: "实习", untitled: true, items: [0] });
    expect(plan[2]).toMatchObject({ type: "工作", items: [1] });
    expect(plan[2]).not.toHaveProperty("untitled");
  });

  it("stored 存在时优先使用,不再重算检测;缺的模块走锚定兜底(untitled)", () => {
    const text = ["基本信息", "张三", "教育经历", "某大学"].join("\n");
    const data = parsed({
      basicInfo: { name: "张三", targetPosition: "", phone: "", email: "" },
      education: [{ school: "某大学", degree: "", major: "", timeRange: { start: "2018", end: "2022" } }],
    });
    // 模拟旧库数据:检测结果缺了 basicInfo —— 不再现场重检测出「基本信息」标题,而是按内容锚定
    const stored = detectSections(text).filter((s) => s.kind !== "basicInfo");
    const plan = buildSectionPlan(text, data, stored);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "education"]);
    expect(plan[0]).toMatchObject({ kind: "basicInfo", untitled: true, start: text.indexOf("张三") });
    expect((plan[1] as { untitled?: boolean }).untitled).toBeUndefined(); // 教育经历来自 stored 检测
  });

  it("锚定兜底:字段值在原文找不到 → 追加在已定位模块之后(排序稳定)", () => {
    const text = ["基本信息", "张三", "工作经历", "某公司"].join("\n");
    const data = parsed({
      basicInfo: { name: "张三", targetPosition: "", phone: "", email: "" },
      // 学校字符串不在原文中(解析器改写过的罕见情况)
      education: [{ school: "某某大学(全称)", degree: "", major: "", timeRange: { start: "2018", end: "2022" } }],
      experiences: [
        { type: "工作", company: "某公司", role: "工程师", timeRange: { start: "2020", end: "至今" }, description: "" },
      ],
    });
    const plan = buildSectionPlan(text, data, null);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "experiences", "education"]);
    expect(plan[2]).toMatchObject({ kind: "education", untitled: true });
  });

  it("parsedData 为 null:仅输出标题检测结果(含自定义切片),不锚定", () => {
    const text = "基本信息\n张三\n自我评价\n认真负责\n教育经历\n某大学";
    const plan = buildSectionPlan(text, null, null);
    expect(plan.map((s) => s.kind)).toEqual(["basicInfo", "custom", "education"]);
    expect(plan[1]).not.toHaveProperty("items");
  });
});
