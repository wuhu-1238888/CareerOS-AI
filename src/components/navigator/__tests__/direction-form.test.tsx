// 方向选择表单测试(3.2):推荐卡渲染与选中态、自定义输入互斥、周时 1–80 校验、阶段三选一、提交载荷
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DirectionForm, type SuggestedDirection } from "../direction-form";

const suggested: SuggestedDirection[] = [
  { directionName: "后端开发", matchScore: 85, strengths: ["Python 熟练", "有实习经历"] },
  { directionName: "数据分析", matchScore: 70, strengths: ["SQL 基础"] },
];

describe("DirectionForm", () => {
  it("有推荐方向:渲染推荐卡(名称 + 匹配度),初始未选中", () => {
    render(<DirectionForm suggestedDirections={suggested} onSubmit={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /后端开发/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("85")).toBeInTheDocument();
    expect(screen.getByText("70")).toBeInTheDocument();
    expect(screen.getByText("Python 熟练 · 有实习经历")).toBeInTheDocument();
  });

  it("无推荐方向(无画像):仅自定义输入可用", () => {
    render(<DirectionForm suggestedDirections={null} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByLabelText("自定义方向")).toBeInTheDocument();
  });

  it("推荐卡点击选中/切换/再点取消", async () => {
    render(<DirectionForm suggestedDirections={suggested} onSubmit={vi.fn()} />);
    const user = userEvent.setup();
    const cardA = screen.getByRole("radio", { name: /后端开发/ });
    const cardB = screen.getByRole("radio", { name: /数据分析/ });
    await user.click(cardA);
    expect(cardA).toHaveAttribute("aria-checked", "true");
    await user.click(cardB);
    expect(cardA).toHaveAttribute("aria-checked", "false");
    expect(cardB).toHaveAttribute("aria-checked", "true");
    await user.click(cardB);
    expect(cardB).toHaveAttribute("aria-checked", "false");
  });

  it("输入自定义方向后推荐卡取消选中,提交用自定义值", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<DirectionForm suggestedDirections={suggested} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    const cardA = screen.getByRole("radio", { name: /后端开发/ });
    await user.click(cardA);
    await user.type(screen.getByLabelText("自定义方向"), "产品经理");
    expect(cardA).toHaveAttribute("aria-checked", "false");
    await user.type(screen.getByLabelText("每周可投入时间"), "8");
    await user.click(screen.getByRole("button", { name: "接近入门" }));
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ direction: "产品经理", weeklyHours: 8, currentStage: "接近入门" })
    );
  });

  it("全空提交:三条校验错误且不调用 onSubmit", async () => {
    const onSubmit = vi.fn();
    render(<DirectionForm suggestedDirections={suggested} onSubmit={onSubmit} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "生成成长路线" }));
    expect(screen.getByText("请选择或输入目标方向")).toBeInTheDocument();
    expect(screen.getByText("请输入 1–80 之间的整数")).toBeInTheDocument();
    expect(screen.getByText("请选择当前阶段")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("周时校验:0 / 81 / 非整数均拦截,方向超长拦截", async () => {
    const onSubmit = vi.fn();
    render(<DirectionForm suggestedDirections={suggested} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /后端开发/ }));
    await user.click(screen.getByRole("button", { name: "有一定基础" }));

    const hours = screen.getByLabelText("每周可投入时间");
    await user.type(hours, "0");
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    expect(screen.getByText("请输入 1–80 之间的整数")).toBeInTheDocument();

    await user.clear(hours);
    await user.type(hours, "81");
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    expect(screen.getByText("请输入 1–80 之间的整数")).toBeInTheDocument();

    await user.clear(hours);
    fireEvent.change(hours, { target: { value: "abc" } });
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    expect(screen.getByText("请输入 1–80 之间的整数")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();

    await user.clear(hours);
    await user.type(hours, "10");
    await user.type(screen.getByLabelText("自定义方向"), "这是一个超过三十个字的目标方向名称用于测试长度限制校验逻辑是否正确生效");
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    expect(screen.getByText("目标方向最多 30 字")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("阶段 chips:三选一,点击切换", async () => {
    render(<DirectionForm suggestedDirections={suggested} onSubmit={vi.fn()} />);
    const user = userEvent.setup();
    const novice = screen.getByRole("button", { name: "完全新手" });
    const basic = screen.getByRole("button", { name: "有一定基础" });
    await user.click(novice);
    expect(novice).toHaveAttribute("aria-pressed", "true");
    await user.click(basic);
    expect(novice).toHaveAttribute("aria-pressed", "false");
    expect(basic).toHaveAttribute("aria-pressed", "true");
  });

  it("提交载荷:选推荐卡 + 周时 + 阶段,提交正确输入", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<DirectionForm suggestedDirections={suggested} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /后端开发/ }));
    await user.type(screen.getByLabelText("每周可投入时间"), "10");
    await user.click(screen.getByRole("button", { name: "有一定基础" }));
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        direction: "后端开发",
        weeklyHours: 10,
        currentStage: "有一定基础",
      })
    );
  });

  it("提交失败:展示服务端错误提示", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("网络错误"));
    render(<DirectionForm suggestedDirections={suggested} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /后端开发/ }));
    await user.type(screen.getByLabelText("每周可投入时间"), "10");
    await user.click(screen.getByRole("button", { name: "完全新手" }));
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("提交失败,请稍后重试");
  });

  it("提交中:按钮禁用并显示生成中", async () => {
    const onSubmit = vi.fn().mockImplementation(() => new Promise(() => undefined));
    render(<DirectionForm suggestedDirections={suggested} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /后端开发/ }));
    await user.type(screen.getByLabelText("每周可投入时间"), "10");
    await user.click(screen.getByRole("button", { name: "完全新手" }));
    await user.click(screen.getByRole("button", { name: "生成成长路线" }));
    expect(await screen.findByRole("button", { name: "生成中…" })).toBeDisabled();
  });
});
