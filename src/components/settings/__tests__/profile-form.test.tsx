// 基本资料表单测试(1.8):预填昵称、保存提交与 invalidate 同步、头像配色选择、空昵称校验
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileForm } from "../profile-form";

const mocks = vi.hoisted(() => ({
  meData: { id: "u1", name: "旧昵称", avatarColor: null as string | null },
  meLoading: false,
  mutateAsync: vi.fn(),
  isPending: false,
  invalidate: vi.fn(),
}));

vi.mock("@/trpc/client", () => ({
  trpc: {
    useUtils: () => ({ user: { me: { invalidate: mocks.invalidate } } }),
    user: {
      me: { useQuery: () => ({ data: mocks.meData, isLoading: mocks.meLoading }) },
      updateProfile: {
        // 模拟 tRPC 行为:mutateAsync 成功后触发组件传入的 onSuccess
        useMutation: (opts?: { onSuccess?: () => void | Promise<void> }) => ({
          mutateAsync: async (input: unknown) => {
            const result = await mocks.mutateAsync(input);
            await opts?.onSuccess?.();
            return result;
          },
          isPending: mocks.isPending,
        }),
      },
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.meData = { id: "u1", name: "旧昵称", avatarColor: null };
  mocks.meLoading = false;
  mocks.invalidate.mockResolvedValue(undefined);
  mocks.mutateAsync.mockResolvedValue({ id: "u1", name: "新昵称", avatarColor: "#7c5cfc" });
});

describe("ProfileForm", () => {
  it("查询返回后预填昵称", async () => {
    render(<ProfileForm />);
    await waitFor(() => expect(screen.getByLabelText("昵称")).toHaveValue("旧昵称"));
  });

  it("修改昵称并保存:调用接口并 invalidate 顶栏资料,显示已保存", async () => {
    render(<ProfileForm />);
    await waitFor(() => expect(screen.getByLabelText("昵称")).toHaveValue("旧昵称"));
    const input = screen.getByLabelText("昵称");
    await userEvent.setup().clear(input);
    await userEvent.setup().type(input, "新昵称");
    await userEvent.setup().click(screen.getByRole("button", { name: "保存资料" }));
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ name: "新昵称", avatarColor: null })
    );
    await waitFor(() => expect(mocks.invalidate).toHaveBeenCalled());
    expect(await screen.findByText("已保存,顶栏头像已同步")).toBeInTheDocument();
  });

  it("选择头像配色后保存携带颜色值", async () => {
    render(<ProfileForm />);
    await waitFor(() => expect(screen.getByLabelText("昵称")).toHaveValue("旧昵称"));
    await userEvent.setup().click(screen.getByRole("button", { name: "头像颜色:罗兰紫" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "保存资料" }));
    await waitFor(() =>
      expect(mocks.mutateAsync).toHaveBeenCalledWith({ name: "旧昵称", avatarColor: "#7c5cfc" })
    );
  });

  it("清空昵称保存:提示必填,不调用接口", async () => {
    render(<ProfileForm />);
    await waitFor(() => expect(screen.getByLabelText("昵称")).toHaveValue("旧昵称"));
    await userEvent.setup().clear(screen.getByLabelText("昵称"));
    await userEvent.setup().click(screen.getByRole("button", { name: "保存资料" }));
    expect(await screen.findByText("请输入昵称")).toBeInTheDocument();
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it("服务端字段错误映射到昵称提示", async () => {
    mocks.mutateAsync.mockRejectedValue(
      Object.assign(new Error("zod"), { data: { zodError: { fieldErrors: { name: ["昵称最多 30 个字符"] } } } })
    );
    render(<ProfileForm />);
    await waitFor(() => expect(screen.getByLabelText("昵称")).toHaveValue("旧昵称"));
    await userEvent.setup().clear(screen.getByLabelText("昵称"));
    await userEvent.setup().type(screen.getByLabelText("昵称"), "超长昵称".repeat(10));
    await userEvent.setup().click(screen.getByRole("button", { name: "保存资料" }));
    expect(await screen.findByText("昵称最多 30 个字符")).toBeInTheDocument();
  });
});
