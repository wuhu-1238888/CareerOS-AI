// 修改密码表单测试(1.8):必填/一致性校验、成功后清空并提示、当前密码错误映射到字段
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasswordForm } from "../password-form";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    user: {
      changePassword: { useMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.isPending }) },
    },
  },
}));

async function fill(current: string, next: string, confirm: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("当前密码"), current);
  await user.type(screen.getByLabelText("新密码"), next);
  await user.type(screen.getByLabelText("确认新密码"), confirm);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PasswordForm", () => {
  it("空表单提交:三条必填提示,不调用接口", async () => {
    render(<PasswordForm />);
    await userEvent.setup().click(screen.getByRole("button", { name: "修改密码" }));
    expect(await screen.findByText("请输入当前密码")).toBeInTheDocument();
    expect(screen.getByText("请输入新密码")).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("新密码不足 8 位与两次不一致:给出对应提示", async () => {
    render(<PasswordForm />);
    const user = await fill("old-pass-123", "short", "different");
    await user.click(screen.getByRole("button", { name: "修改密码" }));
    expect(await screen.findByText("新密码至少 8 位")).toBeInTheDocument();
    expect(screen.getByText("两次输入的新密码不一致")).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("修改成功:清空三个输入框并显示成功提示", async () => {
    mocks.mutateAsync.mockResolvedValue({ ok: true });
    render(<PasswordForm />);
    const user = await fill("old-pass-123", "new-pass-456", "new-pass-456");
    await user.click(screen.getByRole("button", { name: "修改密码" }));
    expect(await screen.findByText("密码已修改,下次登录请使用新密码")).toBeInTheDocument();
    expect(screen.getByLabelText("当前密码")).toHaveValue("");
    expect(screen.getByLabelText("新密码")).toHaveValue("");
    expect(screen.getByLabelText("确认新密码")).toHaveValue("");
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      currentPassword: "old-pass-123",
      newPassword: "new-pass-456",
    });
  });

  it("当前密码错误(BAD_REQUEST):错误映射到当前密码字段", async () => {
    mocks.mutateAsync.mockRejectedValue(
      Object.assign(new Error("当前密码不正确"), { data: { code: "BAD_REQUEST" } })
    );
    render(<PasswordForm />);
    const user = await fill("wrong-pass-123", "new-pass-456", "new-pass-456");
    await user.click(screen.getByRole("button", { name: "修改密码" }));
    await waitFor(() => expect(screen.getByText("当前密码不正确")).toBeInTheDocument());
  });
});
