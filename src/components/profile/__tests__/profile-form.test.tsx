// 四步采集表单测试(2.2):步进导航、必填校验拦截、可跳过步、提交载荷、草稿持久化与恢复、预填
// 经历时长(PRD 3.1.3 补齐):起止时间输入、至今、时长自动计算展示、校验与序列化
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "../profile-form";
import { computeExperienceDuration } from "@/lib/profile/schemas";
import type { ProfileData } from "@/lib/profile/schemas";

const DRAFT_KEY = "careeros:profile-draft:test-user";

function currentStepTitle(): string | undefined {
  return document.querySelector('[aria-current="step"]')?.textContent ?? undefined;
}

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("学历"));
  await user.click(await screen.findByRole("option", { name: "本科" }));
  await user.type(screen.getByLabelText("专业"), "计算机科学与技术");
  await user.click(screen.getByRole("button", { name: "下一步" }));
  await user.click(screen.getByRole("button", { name: "Python" }));
  await user.click(screen.getByRole("button", { name: "下一步" }));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("ProfileForm", () => {
  it("渲染四步标题与每一步的「为什么」说明", () => {
    render(<ProfileForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByText("教育背景")).toBeInTheDocument();
    expect(screen.getByText("技能")).toBeInTheDocument();
    expect(screen.getByText("经历")).toBeInTheDocument();
    expect(screen.getByText("兴趣与目标")).toBeInTheDocument();
    expect(screen.getByText("帮助 AI 理解你的知识基础与对口行业")).toBeInTheDocument();
    expect(screen.getByText("能力评估与方向推荐的核心依据")).toBeInTheDocument();
    expect(currentStepTitle()).toContain("教育背景");
  });

  it("第一步必填校验:学历与专业缺失时下一步被拦截并给出提示", async () => {
    render(<ProfileForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "下一步" }));
    expect(await screen.findByText("请选择学历")).toBeInTheDocument();
    expect(screen.getByText("请输入专业")).toBeInTheDocument();
    expect(currentStepTitle()).toContain("教育背景");
  });

  it("填写学历与专业后可进入技能步", async () => {
    render(<ProfileForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("学历"));
    await user.click(await screen.findByRole("option", { name: "本科" }));
    await user.type(screen.getByLabelText("专业"), "计算机科学与技术");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(screen.getByText("选择技能")).toBeInTheDocument();
    expect(currentStepTitle()).toContain("技能");
  });

  it("技能必填:无技能时拦截,选择预设技能后放行", async () => {
    render(<ProfileForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("学历"));
    await user.click(await screen.findByRole("option", { name: "本科" }));
    await user.type(screen.getByLabelText("专业"), "计算机科学与技术");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(await screen.findByText("请至少添加一项技能")).toBeInTheDocument();
    expect(currentStepTitle()).toContain("技能");
    await user.click(screen.getByRole("button", { name: "Python" }));
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(currentStepTitle()).toContain("经历");
  });

  it("经历与目标可跳过:仅必填项即提交,载荷中可选项为空数组", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProfileForm draftKey={DRAFT_KEY} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(currentStepTitle()).toContain("兴趣与目标");
    await user.click(screen.getByRole("button", { name: "生成我的画像" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        education: [{ degree: "本科", major: "计算机科学与技术", school: undefined, graduationYear: undefined }],
        skills: [{ name: "Python", level: "熟练" }],
        experiences: [],
        interests: [],
        targets: [],
      })
    );
    // 提交成功后草稿被清除
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("完整载荷:经历(含起止时间与自动时长)/兴趣/目标一并提交", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProfileForm onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await fillRequired(user);
    // 经历步:添加一条实习经历(起止时间 → 时长由系统自动计算,不要求手动填写)
    await user.click(screen.getByRole("button", { name: "添加实习经历" }));
    await user.type(screen.getByLabelText("公司名称"), "示例科技");
    await user.type(screen.getByLabelText("职位"), "后端实习生");
    fireEvent.change(screen.getByLabelText("开始时间"), { target: { value: "2025-06" } });
    fireEvent.change(screen.getByLabelText("结束时间"), { target: { value: "2025-09" } });
    expect(screen.getByText("时长:3个月")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "下一步" }));
    // 目标步:选兴趣 + 添加目标
    await user.click(screen.getByRole("button", { name: "产品经理" }));
    await user.type(screen.getByLabelText("职业目标"), "后端开发工程师");
    await user.click(screen.getByRole("button", { name: "添加" }));
    await user.click(screen.getByRole("button", { name: "生成我的画像" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        education: [{ degree: "本科", major: "计算机科学与技术", school: undefined, graduationYear: undefined }],
        skills: [{ name: "Python", level: "熟练" }],
        experiences: [
          {
            type: "internship",
            organization: "示例科技",
            role: "后端实习生",
            description: "",
            startDate: "2025-06",
            endDate: "2025-09",
            duration: "3个月",
          },
        ],
        interests: ["产品经理"],
        targets: ["后端开发工程师"],
      })
    );
  });

  it("经历时长:勾选「至今」禁用结束时间,时长按当前月份计算并标注至今", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProfileForm onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "添加实习经历" }));
    fireEvent.change(screen.getByLabelText("开始时间"), { target: { value: "2025-01" } });
    await user.click(screen.getByRole("checkbox", { name: "至今" }));
    expect(screen.getByLabelText("结束时间")).toBeDisabled();
    expect(screen.getByText(/时长:.*· 至今/)).toBeInTheDocument();
    // 提交载荷:endDate 为 null(至今)、时长自动计算
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "生成我的画像" }));
    await waitFor(() => {
      const payload = onSubmit.mock.calls[0]![0] as ProfileData;
      expect(payload.experiences[0]).toMatchObject({ endDate: null });
      expect(payload.experiences[0]?.duration).toMatch(/· 至今$/);
    });
  });

  it("经历时长校验:缺开始时间/缺结束时间(未勾选至今)/结束早于开始,依次拦截并提示", async () => {
    render(<ProfileForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "添加实习经历" }));
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(await screen.findByText("请选择开始时间")).toBeInTheDocument();
    expect(currentStepTitle()).toContain("经历");
    fireEvent.change(screen.getByLabelText("开始时间"), { target: { value: "2025-06" } });
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(await screen.findByText("请选择结束时间或勾选「至今」")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("结束时间"), { target: { value: "2025-03" } });
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(await screen.findByText("结束时间不能早于开始时间")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("结束时间"), { target: { value: "2025-09" } });
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(currentStepTitle()).toContain("兴趣与目标");
  });

  it("仅项目经历不受起止时间校验影响(时长仅用于实习/工作经历)", async () => {
    render(<ProfileForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "添加项目经历" }));
    await user.type(screen.getByLabelText("项目名称"), "校园二手交易平台");
    await user.type(screen.getByLabelText("你的角色"), "后端开发");
    await user.click(screen.getByRole("button", { name: "下一步" }));
    expect(currentStepTitle()).toContain("兴趣与目标");
  });

  it("草稿随输入保存,卸载重挂后恢复", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <ProfileForm draftKey={DRAFT_KEY} onSubmit={vi.fn().mockResolvedValue(undefined)} />
    );
    await user.type(screen.getByLabelText("专业"), "软件工程");
    await waitFor(() => expect(localStorage.getItem(DRAFT_KEY)).toContain("软件工程"));
    unmount();
    render(<ProfileForm draftKey={DRAFT_KEY} onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByLabelText("专业")).toHaveValue("软件工程");
  });

  it("草稿优先级高于服务端数据(未提交的编辑不丢失)", async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      education: { degree: "本科", major: "草稿中的专业", school: "", graduationYear: "" },
      skills: [],
      internships: [],
      projects: [],
      interests: [],
      targets: [],
    }));
    const serverData: ProfileData = {
      education: [{ degree: "本科", major: "服务端专业" }],
      skills: [{ name: "Python", level: "熟练" }],
      experiences: [],
      interests: [],
      targets: [],
    };
    render(<ProfileForm draftKey={DRAFT_KEY} initialData={serverData} onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByLabelText("专业")).toHaveValue("草稿中的专业");
  });

  it("initialData 预填学历与专业(2.7 更新画像场景)", () => {
    const serverData: ProfileData = {
      education: [{ degree: "硕士", major: "软件工程", school: "示例大学" }],
      skills: [{ name: "Python", level: "精通" }],
      experiences: [],
      interests: ["人工智能"],
      targets: [],
    };
    render(<ProfileForm initialData={serverData} onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByLabelText("学历")).toHaveTextContent("硕士");
    expect(screen.getByLabelText("专业")).toHaveValue("软件工程");
    expect(screen.getByLabelText("学校(选填)")).toHaveValue("示例大学");
  });

  it("上一步返回且已填内容保留", async () => {
    render(<ProfileForm onSubmit={vi.fn().mockResolvedValue(undefined)} />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "上一步" }));
    expect(currentStepTitle()).toContain("技能");
    expect(screen.getByRole("button", { name: "✓ Python" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "上一步" }));
    expect(currentStepTitle()).toContain("教育背景");
    expect(screen.getByLabelText("专业")).toHaveValue("计算机科学与技术");
  });

  it("提交失败:显示通用错误提示", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("boom"));
    render(<ProfileForm onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "下一步" }));
    await user.click(screen.getByRole("button", { name: "生成我的画像" }));
    expect(await screen.findByText("提交失败,请稍后重试")).toBeInTheDocument();
  });
});

describe("computeExperienceDuration(经历时长自动计算)", () => {
  it("同一年份内:按月差计算", () => {
    expect(computeExperienceDuration("2025-06", "2025-09")).toBe("3个月");
  });

  it("跨年:年+月组合", () => {
    expect(computeExperienceDuration("2025-01", "2026-07")).toBe("1年6个月");
  });

  it("整年:只显示年", () => {
    expect(computeExperienceDuration("2025-01", "2026-01")).toBe("1年");
  });

  it("同月入职与离职:不足1个月", () => {
    expect(computeExperienceDuration("2025-06", "2025-06")).toBe("不足1个月");
  });

  it("至今(endDate 为空):按当前月份计算并标注至今", () => {
    const duration = computeExperienceDuration("2025-01", null);
    // 起止时间固定,时长随当前月份增长,断言格式而非具体值
    expect(duration).toMatch(/(年|个月) · 至今$/);
  });
});
