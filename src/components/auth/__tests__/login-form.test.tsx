// 登录表单组件测试(1.4):jsdom + Testing Library。
// 覆盖:空表单必填、邮箱格式、凭据错误通用提示、成功跳转(含 callbackUrl 站内透传 / 外部地址回退)
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "../login-form";

const mocks = vi.hoisted(() => ({
  signIn: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  get: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => ({ get: mocks.get }),
}));

async function fillForm(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("邮箱"), email);
  await user.type(screen.getByLabelText("密码"), password);
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockReturnValue(null);
});

describe("LoginForm", () => {
  it("空表单提交:两条必填错误,不调用 signIn", async () => {
    render(<LoginForm />);
    await userEvent.setup().click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("请输入邮箱")).toBeInTheDocument();
    expect(screen.getByText("请输入密码")).toBeInTheDocument();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("邮箱格式非法:提示格式错误,不调用 signIn", async () => {
    render(<LoginForm />);
    const user = await fillForm("not-an-email", "password123");
    await user.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByText("邮箱格式不正确")).toBeInTheDocument();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("凭据错误:signIn 返回 error → 通用提示「邮箱或密码错误」,不跳转", async () => {
    mocks.signIn.mockResolvedValue({ error: "CredentialsSignin" });
    render(<LoginForm />);
    const user = await fillForm("test@example.com", "wrong-password");
    await user.click(screen.getByRole("button", { name: "登录" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("邮箱或密码错误");
    expect(mocks.signIn).toHaveBeenCalledWith("credentials", {
      redirect: false,
      email: "test@example.com",
      password: "wrong-password",
    });
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("登录成功且无 callbackUrl → 跳转 /dashboard 并 refresh", async () => {
    mocks.signIn.mockResolvedValue({ ok: true });
    render(<LoginForm />);
    const user = await fillForm("test@example.com", "correct-password");
    await user.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("callbackUrl 为站内路径 → 透传跳转该路径", async () => {
    mocks.signIn.mockResolvedValue({ ok: true });
    mocks.get.mockReturnValue("/settings");
    render(<LoginForm />);
    const user = await fillForm("test@example.com", "correct-password");
    await user.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/settings"));
  });

  it("callbackUrl 为外部地址 → 回退 /dashboard(防开放重定向)", async () => {
    mocks.signIn.mockResolvedValue({ ok: true });
    mocks.get.mockReturnValue("https://evil.example.com/phish");
    render(<LoginForm />);
    const user = await fillForm("test@example.com", "correct-password");
    await user.click(screen.getByRole("button", { name: "登录" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
  });
});
