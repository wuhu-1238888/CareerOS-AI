// 注册表单组件测试(1.4):jsdom + Testing Library。
// 覆盖:空表单必填、密码长度、重复邮箱、服务端字段错误映射、成功后自动登录跳转、自动登录失败兜底提示
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RegisterForm } from "../register-form";

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
  signIn: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    user: {
      register: {
        useMutation: () => ({ mutateAsync: mocks.mutateAsync, isPending: mocks.isPending }),
      },
    },
  },
}));
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

// 与组件 catch 分支一致的结构化错误对象(规避 instanceof 依赖)
const CONFLICT_ERROR = Object.assign(new Error("conflict"), { data: { code: "CONFLICT" } });
const ZOD_ERROR = Object.assign(new Error("zod"), {
  data: { zodError: { fieldErrors: { password: ["密码至少 8 位"] } } },
});

async function fillForm(name: string, email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("昵称"), name);
  await user.type(screen.getByLabelText("邮箱"), email);
  await user.type(screen.getByLabelText("密码"), password);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RegisterForm", () => {
  it("空表单提交:三条必填错误,不调用注册接口", async () => {
    render(<RegisterForm />);
    await userEvent.setup().click(screen.getByRole("button", { name: "免费注册" }));
    expect(await screen.findByText("请输入昵称")).toBeInTheDocument();
    expect(screen.getByText("请输入邮箱")).toBeInTheDocument();
    expect(screen.getByText("请输入密码")).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("密码不足 8 位:提示长度错误,不调用注册接口", async () => {
    render(<RegisterForm />);
    const user = await fillForm("小明", "new@example.com", "short");
    await user.click(screen.getByRole("button", { name: "免费注册" }));
    expect(await screen.findByText("密码至少 8 位")).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("邮箱重复(CONFLICT):显示「该邮箱已注册」", async () => {
    mocks.mutateAsync.mockRejectedValue(CONFLICT_ERROR);
    render(<RegisterForm />);
    const user = await fillForm("小明", "dup@example.com", "password123");
    await user.click(screen.getByRole("button", { name: "免费注册" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("该邮箱已注册");
  });

  it("服务端字段错误(zodError):映射到对应字段提示", async () => {
    mocks.mutateAsync.mockRejectedValue(ZOD_ERROR);
    render(<RegisterForm />);
    const user = await fillForm("小明", "ok@example.com", "password123");
    await user.click(screen.getByRole("button", { name: "免费注册" }));
    expect(mocks.mutateAsync).toHaveBeenCalled(); // 客户端校验已放行,走服务端分支
    expect(await screen.findByText("密码至少 8 位")).toBeInTheDocument();
  });

  it("注册成功:以同凭据自动登录并跳转 /dashboard", async () => {
    mocks.mutateAsync.mockResolvedValue({ id: "u1" });
    mocks.signIn.mockResolvedValue({ ok: true });
    render(<RegisterForm />);
    const user = await fillForm("小明", "new@example.com", "password123");
    await user.click(screen.getByRole("button", { name: "免费注册" }));
    await waitFor(() =>
      expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
        redirect: false,
        email: "new@example.com",
        password: "password123",
      })
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("注册成功但自动登录失败:提示去登录页,不跳转", async () => {
    mocks.mutateAsync.mockResolvedValue({ id: "u1" });
    mocks.signIn.mockResolvedValue({ error: "CredentialsSignin" });
    render(<RegisterForm />);
    const user = await fillForm("小明", "new@example.com", "password123");
    await user.click(screen.getByRole("button", { name: "免费注册" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("自动登录失败");
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
