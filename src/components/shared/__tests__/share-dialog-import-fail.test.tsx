// 分享对话框 import 失败态(6.8):mock 工厂抛错 → 动态 import 拒绝 → 下载按钮禁用。
// 与 share-dialog.test.tsx 分文件:Vitest 对 mocked 模块的动态 import 缓存跨用例不清,
// 抛错工厂与成功工厂不能共存于同一文件的模块注册表。
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShareDialog } from "../share-dialog";

vi.mock("html-to-image", () => {
  throw new Error("模块加载失败");
});

describe("ShareDialog import 失败", () => {
  it("下载按钮禁用并显示「图片组件加载失败」", async () => {
    render(
      <ShareDialog open onOpenChange={() => undefined}>
        <div>卡片内容</div>
      </ShareDialog>
    );
    const button = await screen.findByRole("button", { name: "图片组件加载失败" });
    expect(button).toBeDisabled();
    expect(screen.getByText("卡片内容")).toBeInTheDocument();
  });
});
