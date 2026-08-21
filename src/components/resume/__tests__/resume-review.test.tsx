// 简历核对表单测试(4.3):分区渲染与初始值 / 编辑保存(saveParsedData 载荷)/
// 技能拆分 / 方向 chips 与自定义 / 空方向拦截 / 开始优化回调 / 条目增删
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResumeReview } from "../resume-review";
import type { ParsedResume } from "@/lib/resume/analysis-schemas";

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
