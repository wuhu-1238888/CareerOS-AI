// 简历核对表单测试(4.3):分区渲染与初始值 / 编辑保存(saveParsedData 载荷)/
// 技能拆分 / 方向 chips 与自定义 / 空方向拦截 / 开始优化回调 / 条目增删;
// 4.10:sectionPlan 模式(原文顺序渲染 / 自定义模块只读 / 工作实习分开展示 / 虚拟分区兜底)
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// 技能上限校验(30 项 / 单条 50 字):前端预校验 + 计数 + 技能区中文提示 + 拦截保存/优化
describe("ResumeReview(skills 上限校验)", () => {
  const manySkills = (n: number) => Array.from({ length: n }, (_, i) => `技能${i}`).join("\n");

  function renderReview(
    onStart: (parsed: ParsedResume, direction: string) => Promise<void> = vi.fn()
  ) {
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careerPaths}
        onStartOptimize={onStart}
        optimizing={false}
      />
    );
  }

  it("初始 3 项显示计数;清空后 0 项可正常保存空数组", async () => {
    renderReview();
    expect(screen.getByText("已识别 3 / 30 项")).toBeInTheDocument();
    const user = userEvent.setup();
    const skillsInput = screen.getByLabelText("技能列表");
    await user.clear(skillsInput);
    expect(screen.getByText("已识别 0 / 30 项")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    await waitFor(() =>
      expect(mocks.saveMutateAsync).toHaveBeenCalledWith({
        resumeId: "r1",
        parsedData: expect.objectContaining({ skills: [] }),
      })
    );
  });

  it("技能超过 30 项:计数变红 + 保存被拦截,输入保留且不调 API", async () => {
    renderReview();
    const user = userEvent.setup();
    const skillsInput = screen.getByLabelText("技能列表");
    await user.clear(skillsInput);
    fireEvent.change(skillsInput, { target: { value: manySkills(31) } });
    expect(screen.getByText("已识别 31 / 30 项")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    expect(
      await screen.findByText("技能最多 30 项,当前 31 项,请删除或合并 1 项后再保存。")
    ).toBeInTheDocument();
    expect(mocks.saveMutateAsync).not.toHaveBeenCalled();
    // 拦截不清空用户输入
    expect(screen.getByLabelText("技能列表")).toHaveValue(manySkills(31));
  });

  it("技能超过 30 项点「开始优化」:拦截且不触发回调", async () => {
    const onStart = vi.fn();
    renderReview(onStart);
    const user = userEvent.setup();
    const skillsInput = screen.getByLabelText("技能列表");
    await user.clear(skillsInput);
    fireEvent.change(skillsInput, { target: { value: manySkills(31) } });
    await user.click(screen.getByRole("button", { name: "开始优化" }));
    expect(
      await screen.findByText("技能最多 30 项,当前 31 项,请删除或合并 1 项后再开始优化。")
    ).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();
    expect(mocks.saveMutateAsync).not.toHaveBeenCalled();
  });

  it("31 行含 1 条重复:自动去重后 30 / 30,保存成功且载荷无重复", async () => {
    renderReview();
    const user = userEvent.setup();
    const skillsInput = screen.getByLabelText("技能列表");
    await user.clear(skillsInput);
    fireEvent.change(skillsInput, { target: { value: `${manySkills(30)}\n技能0` } });
    expect(screen.getByText("已识别 30 / 30 项")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    await waitFor(() => expect(mocks.saveMutateAsync).toHaveBeenCalled());
    const payload = mocks.saveMutateAsync.mock.calls[0]![0] as {
      parsedData: { skills: string[] };
    };
    expect(payload.parsedData.skills).toHaveLength(30);
    expect(new Set(payload.parsedData.skills).size).toBe(30);
  });

  it("单条技能超过 50 字:保存拦截并提示精简", async () => {
    renderReview();
    const user = userEvent.setup();
    const skillsInput = screen.getByLabelText("技能列表");
    await user.clear(skillsInput);
    fireEvent.change(skillsInput, { target: { value: "a".repeat(51) } });
    expect(screen.getByText("已识别 1 / 30 项")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    expect(
      await screen.findByText("单个技能最多 50 字,请精简超长技能后再保存。")
    ).toBeInTheDocument();
    expect(mocks.saveMutateAsync).not.toHaveBeenCalled();
  });

  it("超限报错后删减至合法:错误消失,可正常保存", async () => {
    renderReview();
    const user = userEvent.setup();
    const skillsInput = screen.getByLabelText("技能列表");
    await user.clear(skillsInput);
    fireEvent.change(skillsInput, { target: { value: manySkills(31) } });
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    await screen.findByText("技能最多 30 项,当前 31 项,请删除或合并 1 项后再保存。");
    await user.clear(skillsInput);
    fireEvent.change(skillsInput, { target: { value: manySkills(30) } });
    // 输入即清错(DesignRules L220:不逐键打断)
    expect(screen.queryByText(/技能最多 30 项/)).toBeNull();
    expect(screen.getByText("已识别 30 / 30 项")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    await waitFor(() => expect(mocks.saveMutateAsync).toHaveBeenCalled());
    expect(await screen.findByText("核对结果已保存")).toBeInTheDocument();
  });

  it("其他字段后端校验失败:显示字段中文消息而非裸 JSON", async () => {
    mocks.saveMutateAsync.mockRejectedValueOnce(
      new Error(
        '{"code":"too_small","minimum":1,"type":"string","inclusive":true,"exact":false,"message":"学校不能为空","path":["parsedData","education",0,"school"]}'
      )
    );
    renderReview();
    await userEvent.setup().click(screen.getByRole("button", { name: "保存核对结果" }));
    expect(await screen.findByText("学校不能为空")).toBeInTheDocument();
    // 无裸 JSON / 字段名泄漏
    expect(screen.queryByText(/parsedData/)).toBeNull();
    expect(screen.queryByText(/too_small/)).toBeNull();
  });
});

// 校验失败自动定位:点击保存/优化遇到校验错误 → 平滑滚动到第一个错误字段所在分区,错误提示第一眼可见
describe("ResumeReview(校验失败自动定位)", () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    scrollIntoView = vi.fn();
    // jsdom 无 scrollIntoView,挂 prototype mock 验证滚动定位(与 roadmap/profile 测试先例同款)
    Element.prototype.scrollIntoView =
      scrollIntoView as unknown as typeof Element.prototype.scrollIntoView;
  });

  afterEach(() => {
    // 恢复 setup.ts 的 noop stub
    Element.prototype.scrollIntoView = () => {};
  });

  const manySkills = (n: number) => Array.from({ length: n }, (_, i) => `技能${i}`).join("\n");

  /** 第 callIndex 次 scrollIntoView 调用所定位元素上的 data-field 值 */
  function scrolledField(callIndex = 0): string | undefined {
    const el = scrollIntoView.mock.instances[callIndex] as HTMLElement | undefined;
    return el?.dataset.field;
  }

  function renderReview(
    onStart: (parsed: ParsedResume, direction: string) => Promise<void> = vi.fn(),
    careers: string[] = careerPaths
  ) {
    render(
      <ResumeReview
        resumeId="r1"
        initial={initialParsed}
        careerPaths={careers}
        onStartOptimize={onStart}
        optimizing={false}
      />
    );
  }

  it("Case A:无错误点保存 → 正常保存,不触发定位", async () => {
    renderReview();
    await userEvent.setup().click(screen.getByRole("button", { name: "保存核对结果" }));
    await waitFor(() => expect(mocks.saveMutateAsync).toHaveBeenCalled());
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("Case B:技能 31 条点保存 → 拦截 + 平滑滚动到技能区 + 聚焦技能输入,输入保留", async () => {
    renderReview();
    const user = userEvent.setup();
    const skillsInput = screen.getByLabelText("技能列表");
    await user.clear(skillsInput);
    fireEvent.change(skillsInput, { target: { value: manySkills(31) } });
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    expect(
      await screen.findByText("技能最多 30 项,当前 31 项,请删除或合并 1 项后再保存。")
    ).toBeInTheDocument();
    expect(mocks.saveMutateAsync).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrolledField()).toBe("skills");
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(document.activeElement).toBe(screen.getByLabelText("技能列表"));
    // 拦截不清空用户输入
    expect(screen.getByLabelText("技能列表")).toHaveValue(manySkills(31));
  });

  it("Case C:技能 31 条点「开始优化」→ 不触发回调,滚动定位到技能区", async () => {
    const onStart = vi.fn();
    renderReview(onStart);
    const user = userEvent.setup();
    const skillsInput = screen.getByLabelText("技能列表");
    await user.clear(skillsInput);
    fireEvent.change(skillsInput, { target: { value: manySkills(31) } });
    await user.click(screen.getByRole("button", { name: "开始优化" }));
    expect(
      await screen.findByText("技能最多 30 项,当前 31 项,请删除或合并 1 项后再开始优化。")
    ).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrolledField()).toBe("skills");
  });

  it("Case D:方向为空 + 技能 31 条 → 只定位第一个错误(方向);修复后再点定位技能", async () => {
    const onStart = vi.fn();
    renderReview(onStart, []); // 无推荐方向 → 方向为空,与技能超限构成双错误
    const user = userEvent.setup();
    const skillsInput = screen.getByLabelText("技能列表");
    await user.clear(skillsInput);
    fireEvent.change(skillsInput, { target: { value: manySkills(31) } });
    await user.click(screen.getByRole("button", { name: "开始优化" }));
    expect(await screen.findByText("请选择或填写目标方向")).toBeInTheDocument();
    // 多错误只定位第一个:方向
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrolledField()).toBe("direction");
    expect(document.activeElement).toBe(screen.getByLabelText("目标方向(可自定义)"));
    // 修复方向后再点 → 定位下一个错误:技能
    await user.type(screen.getByLabelText("目标方向(可自定义)"), "算法工程师");
    await user.click(screen.getByRole("button", { name: "开始优化" }));
    expect(
      await screen.findByText("技能最多 30 项,当前 31 项,请删除或合并 1 项后再开始优化。")
    ).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(scrolledField(1)).toBe("skills");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("Case E:修复全部错误后 → 保存与开始优化恢复正常,不再触发定位", async () => {
    const onStart = vi.fn().mockResolvedValue(undefined);
    renderReview(onStart, []);
    const user = userEvent.setup();
    const skillsInput = screen.getByLabelText("技能列表");
    await user.clear(skillsInput);
    fireEvent.change(skillsInput, { target: { value: manySkills(31) } });
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    await screen.findByText("技能最多 30 项,当前 31 项,请删除或合并 1 项后再保存。");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    // 删减技能至合法 + 补填方向
    fireEvent.change(skillsInput, { target: { value: manySkills(30) } });
    await user.type(screen.getByLabelText("目标方向(可自定义)"), "算法工程师");
    await user.click(screen.getByRole("button", { name: "保存核对结果" }));
    await waitFor(() => expect(mocks.saveMutateAsync).toHaveBeenCalled());
    expect(await screen.findByText("核对结果已保存")).toBeInTheDocument();
    // 修复后的保存与优化均不再新增定位调用
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "开始优化" }));
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
