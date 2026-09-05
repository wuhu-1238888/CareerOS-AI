// 通用 Tabs 组件测试(IA 调整 2026-09,按 DesignSystem L634):受控选中、点击切换、←→ 键循环、仅渲染选中面板、a11y 布线
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Tabs } from "../tabs";

const ITEMS = [
  { value: "a", label: "标签 A", content: <p>面板 A</p> },
  { value: "b", label: "标签 B", content: <p>面板 B</p> },
  { value: "c", label: "标签 C", content: <p>面板 C</p> },
];

describe("Tabs", () => {
  it("渲染 tablist/tab/tabpanel,选中项 aria-selected=true 且仅其面板渲染", () => {
    render(<Tabs items={ITEMS} value="b" onValueChange={vi.fn()} aria-label="测试标签" />);
    const tablist = screen.getByRole("tablist", { name: "测试标签" });
    const tabs = within(tablist).getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(within(tablist).getByRole("tab", { name: "标签 B" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(within(tablist).getByRole("tab", { name: "标签 A" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    // 选中 tab 的 aria-controls 指向当前面板
    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveTextContent("面板 B");
    expect(panel).not.toHaveTextContent("面板 A");
  });

  it("点击触发 onValueChange(受控,不自行切换)", async () => {
    const onChange = vi.fn();
    render(<Tabs items={ITEMS} value="a" onValueChange={onChange} />);
    await userEvent.setup().click(screen.getByRole("tab", { name: "标签 C" }));
    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("←→ 键循环切换并聚焦(受控时仅回调)", async () => {
    const onChange = vi.fn();
    render(<Tabs items={ITEMS} value="a" onValueChange={onChange} />);
    const first = screen.getByRole("tab", { name: "标签 A" });
    first.focus();
    await userEvent.setup().keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith("c");
    // 焦点已随虚拟选择移到「标签 C」,再右移循环回首项
    onChange.mockClear();
    await userEvent.setup().keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("未知 value 回落首项", () => {
    render(<Tabs items={ITEMS} value="unknown" onValueChange={vi.fn()} />);
    expect(screen.getByRole("tab", { name: "标签 A" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("面板 A");
  });
});
