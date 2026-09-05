"use client";
// 通用受控 Tabs(按 DesignSystem L634):40px 高;选中 14px/500 ink + 2px green-600 下划线;
// 未选中 ink-muted,hover ink;←→ 键循环切换焦点与选中。
// 仅渲染当前选中项的面板(条件渲染,非 hidden)——轮询/上传类内容组件卸载即停。
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

export function Tabs({
  items,
  value,
  onValueChange,
  "aria-label": ariaLabel = "标签页",
  className,
}: {
  items: TabItem[];
  value: string;
  onValueChange: (value: string) => void;
  /** tablist 无障碍名称 */
  "aria-label"?: string;
  className?: string;
}) {
  const baseId = useId().replace(/:/g, "");
  const triggers = useRef<Array<HTMLButtonElement | null>>([]);
  // 未知 value 回落首项
  const selectedIndex = Math.max(0, items.findIndex((item) => item.value === value));
  const selected = items[selectedIndex]!;

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + delta + items.length) % items.length;
    onValueChange(items[nextIndex]!.value);
    triggers.current[nextIndex]?.focus();
  }

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex items-center gap-6 border-b border-hairline"
      >
        {items.map((item, index) => {
          const active = index === selectedIndex;
          return (
            <button
              key={item.value}
              ref={(el) => {
                triggers.current[index] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.value}`}
              aria-selected={active}
              aria-controls={`${baseId}-panel-${item.value}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onValueChange(item.value)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                "-mb-px inline-flex h-10 items-center border-b-2 px-1 text-body-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-green-600 font-medium text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${selected.value}`}
        aria-labelledby={`${baseId}-tab-${selected.value}`}
      >
        {selected.content}
      </div>
    </div>
  );
}
