// 纠偏弹窗测试(2.6):必选校验、提交载荷(note 去空格/空为 undefined)、成功关闭、失败提示、取消重置
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CorrectionDialog } from "../correction-dialog";

describe("CorrectionDialog", () => {
  it("未选择任何部分提交:拦截并提示", async () => {
    render(<CorrectionDialog open onOpenChange={vi.fn()} onSubmit={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "提交反馈" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("请选择不准确的部分");
  });

  it("选择方向+能力+说明:提交载荷正确(note 去空格),成功后关闭", async () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CorrectionDialog open onOpenChange={onOpenChange} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("推荐方向不准确"));
    await user.click(screen.getByText("能力评估不准确"));
    await user.type(screen.getByLabelText(/补充说明/), "  我想做产品方向  ");
    await user.click(screen.getByRole("button", { name: "提交反馈" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        areas: ["direction", "ability"],
        note: "我想做产品方向",
      })
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("空说明:note 为 undefined", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CorrectionDialog open onOpenChange={vi.fn()} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.click(screen.getByText("优势判断不准确"));
    await user.click(screen.getByRole("button", { name: "提交反馈" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ areas: ["strength"], note: undefined })
    );
  });

  it("提交失败:显示错误且弹窗不关闭", async () => {
    const onOpenChange = vi.fn();
    render(
      <CorrectionDialog
        open
        onOpenChange={onOpenChange}
        onSubmit={vi.fn().mockRejectedValue(new Error("网络错误"))}
      />
    );
    const user = userEvent.setup();
    await user.click(screen.getByText("推荐方向不准确"));
    await user.click(screen.getByRole("button", { name: "提交反馈" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("网络错误");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("取消:关闭弹窗", async () => {
    const onOpenChange = vi.fn();
    render(<CorrectionDialog open onOpenChange={onOpenChange} onSubmit={vi.fn()} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "取消" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
