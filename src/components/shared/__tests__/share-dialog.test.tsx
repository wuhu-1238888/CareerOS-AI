// 分享对话框测试(6.8):动态 import html-to-image(vi.mock 拦截)、下载触发(toPng pixelRatio 2 →
// dataURL → 临时 <a download>)、失败 toast 可重试。import 失败禁用态见 share-dialog-import-fail.test.tsx
// (mock 工厂抛错与成功路径不能共用一个测试文件的模块注册表)。
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster, toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareDialog } from "../share-dialog";

const toPng = vi.fn();

vi.mock("html-to-image", () => ({ toPng }));

function renderDialog() {
  return render(
    <>
      <Toaster />
      <ShareDialog open onOpenChange={() => undefined} fileName="careeros-测试.png">
        <div>卡片内容</div>
      </ShareDialog>
    </>
  );
}

beforeEach(() => {
  toPng.mockReset();
  toPng.mockResolvedValue("data:image/png;base64,iVBORw0KGgo=");
});

afterEach(() => {
  toast.dismiss();
});

describe("ShareDialog", () => {
  it("动态加载后:渲染预览与「下载 PNG」;点击触发 toPng(pixelRatio 2)+ 临时链接下载 + 成功 toast", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderDialog();
    expect(screen.getByText("分享图片")).toBeInTheDocument();
    expect(screen.getByText("下载图片后分享到微信、朋友圈或其他渠道")).toBeInTheDocument();
    expect(screen.getByText("卡片内容")).toBeInTheDocument();
    const button = await screen.findByRole("button", { name: "下载 PNG" });
    await userEvent.setup().click(button);
    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(1));
    // 截图目标为卡片容器(含 children),pixelRatio 2 高清导出
    const [nodeArg, options] = toPng.mock.calls[0]!;
    expect(nodeArg).toBeInstanceOf(HTMLDivElement);
    expect(nodeArg).toHaveTextContent("卡片内容");
    expect(options).toEqual({ pixelRatio: 2 });
    // 临时 <a download>:dataURL + 指定文件名
    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.href).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(anchor.download).toBe("careeros-测试.png");
    expect(await screen.findByText("图片已生成并开始下载")).toBeInTheDocument();
    clickSpy.mockRestore();
  });

  it("截图失败:错误 toast,按钮恢复可用(可重试)", async () => {
    toPng.mockRejectedValue(new Error("截图失败"));
    renderDialog();
    const button = await screen.findByRole("button", { name: "下载 PNG" });
    await userEvent.setup().click(button);
    expect(await screen.findByText("生成图片失败,请重试")).toBeInTheDocument();
    await waitFor(() => expect(button).toBeEnabled());
    // 重试:再次点击仍会调用 toPng
    await userEvent.setup().click(button);
    await waitFor(() => expect(toPng).toHaveBeenCalledTimes(2));
  });
});
