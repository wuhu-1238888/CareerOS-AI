// 简历核对表单测试(4.3):分区渲染与初始值 / 编辑保存(saveParsedData 载荷)/
// 技能拆分 / 方向 chips 与自定义 / 空方向拦截 / 开始优化回调 / 条目增删;
// 4.10:sectionPlan 模式(原文顺序渲染 / 自定义模块只读 / 工作实习分开展示 / 虚拟分区兜底)
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeReview } from "../resume-review";
import type { ParsedResume } from "@/lib/resume/analysis-schemas";
import type { SectionRef } from "@/lib/resume/section-order";

const initialParsed: ParsedResume = {
  basicInfo: {
    name: "张伟",
    targetPosition: "后端开发工程师",
    phone: "138-0000-0000",
    email: "zhangwei@example.com",
  },
  education: [
    {
      school: "中国科学技术大学",
      degree: "本科",
      major: "计算机科学与技术",
      timeRange: { start: "2016-09", end: "2020-06" },
    },
  ],
  skills: ["Java", "Spring Boot", "MySQL"],
  experiences: [
    {
      type: "工作",
      company: "杭州某科技有限公司",
      role: "后端开发工程师",
      timeRange: { start: "2020-07", end: "2023-06" },
      description: "负责订单系统开发",
    },
  ],
  projects: [
    {
      name: "分布式秒杀系统",
      role: "",
      timeRange: { start: "2023-01", end: "2023-05" },
      description: "设计并实现库存预扣方案",
    },
  ],
};

const mocks = vi.hoisted(() => ({
  saveMutateAsync: vi.fn(),
  savePending: false,
  invalidate: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ resume: { get: { invalidate: mocks.invalidate } } }),
    resume: {
      saveParsedData: {
        useMutation: () => ({
          mutateAsync: mocks.saveMutateAsync,
          isPending: mocks.savePending,
        }),
      },
    },
  },
}));

const careerPaths = ["后端开发", "数据分析"];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.savePending = false;
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.saveMutateAsync.mockResolvedValue({ ok: true });
});

describe("ResumeReview", () => {
  it("渲染全部分区与初始值;方向默认画像首选方向", () => {
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careerPaths}
        onStartOptimize={vi.fn()}
        optimizing={false}
      />
    );
    // 分区标题
    for (const title of ["基本信息", "教育经历", "技能", "工作 / 实习经历", "项目经历", "目标方向"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // 初始值
    expect(screen.getByLabelText("姓名")).toHaveValue("张伟");
    expect(screen.getByLabelText("求职意向")).toHaveValue("后端开发工程师");
    expect(screen.getByLabelText("学校 1")).toHaveValue("中国科学技术大学");
    expect(screen.getByLabelText("技能列表")).toHaveValue("Java\nSpring Boot\nMySQL");
    expect(screen.getByLabelText("公司 1")).toHaveValue("杭州某科技有限公司");
    expect(screen.getByLabelText("项目名称 1")).toHaveValue("分布式秒杀系统");
    // 方向默认首选 + chips 渲染
    expect(screen.getByLabelText("目标方向(可自定义)")).toHaveValue("后端开发");
    expect(screen.getByRole("button", { name: "后端开发" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "数据分析" })).toBeInTheDocument();
  });

  it("编辑基本信息后「保存核对结果」:saveParsedData 载荷为修正后的数据,显示已保存", async () => {
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careerPaths}
        onStartOptimize={vi.fn()}
        optimizing={false}
      />
    );
    const user = userEvent.setup();
    const name = screen.getByLabelText("姓名");
    await user.clear(name);
    await user.type(name, "张伟(已核对)");
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    await waitFor(() =>
      expect(mocks.saveMutateAsync).toHaveBeenCalledWith({
        resumeId: "r1",
        parsedData: expect.objectContaining({
          basicInfo: expect.objectContaining({ name: "张伟(已核对)" }),
        }),
      })
    );
    expect(await screen.findByText("核对结果已保存")).toBeInTheDocument();
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
  });

  it("技能文本按行/逗号/顿号拆分后保存", async () => {
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careerPaths}
        onStartOptimize={vi.fn()}
        optimizing={false}
      />
    );
    const user = userEvent.setup();
    const skills = screen.getByLabelText("技能列表");
    await user.clear(skills);
    await user.type(skills, "Java、Spring Boot,MySQL\nRedis");
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    await waitFor(() =>
      expect(mocks.saveMutateAsync).toHaveBeenCalledWith({
        resumeId: "r1",
        parsedData: expect.objectContaining({
          skills: ["Java", "Spring Boot", "MySQL", "Redis"],
        }),
      })
    );
  });

  it("方向 chips 点击切换方向;支持自定义输入", async () => {
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careerPaths}
        onStartOptimize={vi.fn()}
        optimizing={false}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "数据分析" }));
    expect(screen.getByLabelText("目标方向(可自定义)")).toHaveValue("数据分析");

    const direction = screen.getByLabelText("目标方向(可自定义)");
    await user.clear(direction);
    await user.type(direction, "算法工程师");
    expect(direction).toHaveValue("算法工程师");
  });

  it("方向为空点「开始优化」:提示错误且不触发回调", async () => {
    const onStart = vi.fn();
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={[]}
        onStartOptimize={onStart}
        optimizing={false}
      />
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "开始优化" }));
    expect(await screen.findByText("请选择或填写目标方向")).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();
  });

  it("「开始优化」:回调收到核对后的 parsedData 与目标方向", async () => {
    const onStart = vi.fn().mockResolvedValue(undefined);
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careerPaths}
        onStartOptimize={onStart}
        optimizing={false}
      />
    );
    const user = userEvent.setup();
    const name = screen.getByLabelText("姓名");
    await user.clear(name);
    await user.type(name, "张伟(定稿)");
    await user.click(screen.getByRole("button", { name: "开始优化" }));
    await waitFor(() =>
      expect(onStart).toHaveBeenCalledWith(
        expect.objectContaining({
          basicInfo: expect.objectContaining({ name: "张伟(定稿)" }),
          skills: ["Java", "Spring Boot", "MySQL"],
        }),
        "后端开发"
      )
    );
  });

  it("回调失败:显示错误文案", async () => {
    const onStart = vi.fn().mockRejectedValue(new Error("服务异常"));
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careerPaths}
        onStartOptimize={onStart}
        optimizing={false}
      />
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "开始优化" }));
    expect(await screen.findByText("服务异常")).toBeInTheDocument();
  });

  it("optimizing 在途:「开始优化」禁用(防双击并发),「保存核对结果」不受影响", () => {
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careerPaths}
        onStartOptimize={vi.fn()}
        optimizing
      />
    );
    expect(screen.getByRole("button", { name: "开始优化" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存核对结果" })).not.toBeDisabled();
  });

  it("教育/经历/项目条目可增删;经历类型可切换为实习", async () => {
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careerPaths}
        onStartOptimize={vi.fn()}
        optimizing={false}
      />
    );
    const user = userEvent.setup();
    // 新增教育 → 出现第 2 条;删除第 2 条后消失(教育区两条「删除此条」按 DOM 顺序取第 2 个)
    await user.click(screen.getByRole("button", { name: "添加教育经历" }));
    expect(screen.getByLabelText("学校 2")).toBeInTheDocument();
    const deletes = screen.getAllByRole("button", { name: "删除此条" });
    await user.click(deletes[1]!);
    expect(screen.queryByLabelText("学校 2")).toBeNull();
    expect(screen.getByLabelText("学校 1")).toBeInTheDocument();

    // 经历类型切换:工作 → 实习
    await user.click(screen.getByRole("button", { name: "实习" }));
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    await waitFor(() =>
      expect(mocks.saveMutateAsync).toHaveBeenCalledWith({
        resumeId: "r1",
        parsedData: expect.objectContaining({
          experiences: [
            expect.objectContaining({ type: "实习", company: "杭州某科技有限公司" }),
          ],
        }),
      })
    );
  });
});

describe("ResumeReview(sectionPlan,4.10)", () => {
  it("按 plan 顺序渲染;原文缺失的模块以虚拟分区置于目标方向之前", () => {
    // 原文顺序:基本信息 → 自我评价 → 项目经历 → 技能 → 工作经历(教育经历原文没有 → 虚拟分区兜底)
    const plan: SectionRef[] = [
      { kind: "basicInfo", label: "基本信息", start: 0 },
      { kind: "custom", label: "自我评价", start: 50, end: 80, content: "认真负责,团队协作能力强。" },
      { kind: "projects", label: "项目经历", start: 80, items: [0] },
      { kind: "skills", label: "技能", start: 120, items: [0, 1, 2] },
      { kind: "experiences", label: "工作经历", start: 160, type: "工作", items: [0] },
    ];
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careerPaths}
        onStartOptimize={vi.fn()}
        optimizing={false}
        sectionPlan={plan}
      />
    );
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual([
      "基本信息",
      "自我评价",
      "项目经历",
      "技能",
      "工作经历",
      "教育经历", // 虚拟分区:置于已定位模块之后、目标方向之前
      "目标方向",
    ]);
    // 虚拟分区的教育条目正常渲染(plan 中无该模块 → 单分区含全部)
    expect(screen.getByLabelText("学校 1")).toHaveValue("中国科学技术大学");
  });

  it("自定义模块:标题 + 原文内容只读展示,不参与 AI 改写", () => {
    const plan: SectionRef[] = [
      { kind: "basicInfo", label: "基本信息", start: 0 },
      { kind: "custom", label: "获奖情况", start: 50, end: 80, content: "校级一等奖学金\n优秀学生干部" },
      { kind: "skills", label: "技能", start: 80, items: [0, 1, 2] },
    ];
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={[]}
        onStartOptimize={vi.fn()}
        optimizing={false}
        sectionPlan={plan}
      />
    );
    const card = screen.getByLabelText("自定义模块 获奖情况");
    expect(within(card).getByText("获奖情况")).toBeInTheDocument();
    expect(within(card).getByText(/校级一等奖学金/)).toBeInTheDocument();
    expect(within(card).getByText("自定义模块:保持原文展示,不参与 AI 改写")).toBeInTheDocument();
    // 只读:卡片内无任何可编辑控件
    expect(within(card).queryByRole("textbox")).toBeNull();
  });

  it("工作/实习分开展示:条目按 plan 归组互不重复;删除后索引平移", async () => {
    const splitInitial: ParsedResume = {
      ...initialParsed,
      experiences: [
        {
          type: "工作",
          company: "杭州某科技有限公司",
          role: "后端开发工程师",
          timeRange: { start: "2020-07", end: "2023-06" },
          description: "负责订单系统开发",
        },
        {
          type: "实习",
          company: "某互联网大厂",
          role: "后端实习生",
          timeRange: { start: "2019-06", end: "2019-09" },
          description: "参与支付网关开发",
        },
      ],
    };
    // 原文顺序:实习经历在 工作经历 之前(非 Schema 顺序)
    const plan: SectionRef[] = [
      { kind: "basicInfo", label: "基本信息", start: 0 },
      { kind: "experiences", label: "实习经历", start: 40, type: "实习", items: [1] },
      { kind: "experiences", label: "工作经历", start: 60, type: "工作", items: [0] },
    ];
    render(
      <ResumeReview
        resumeId="r1"
        initial={splitInitial}
        careerPaths={[]}
        onStartOptimize={vi.fn()}
        optimizing={false}
        sectionPlan={plan}
      />
    );
    // 两个分区标题都在;条目各归其区(无重复渲染)
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toContain("实习经历");
    expect(headings).toContain("工作经历");
    expect(screen.getAllByLabelText("公司 1")).toHaveLength(1);
    expect(screen.getAllByLabelText("公司 2")).toHaveLength(1);
    expect(screen.getByLabelText("公司 1")).toHaveValue("杭州某科技有限公司");
    expect(screen.getByLabelText("公司 2")).toHaveValue("某互联网大厂");
    // 每个分区各自有「添加经历」
    expect(screen.getAllByRole("button", { name: "添加经历" })).toHaveLength(2);

    // 删除实习条目(公司 2):工作条目不受影响;实习分区不再渲染该条目
    const user = userEvent.setup();
    const deletes = screen.getAllByRole("button", { name: "删除此条" });
    await user.click(deletes[0]!); // 块顺序:实习经历区在前 → 第一个删除按钮属于实习条目
    expect(screen.queryByLabelText("公司 2")).toBeNull();
    expect(screen.getByLabelText("公司 1")).toHaveValue("杭州某科技有限公司");
  });
});
