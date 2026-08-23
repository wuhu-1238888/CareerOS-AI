import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest 未开 globals,RTL 不会自动注册清理;显式注册防止用例间 DOM 累积
afterEach(() => {
  cleanup();
});

// jsdom 未实现 Pointer Capture / scrollIntoView,Radix Select/Dialog 交互会抛错(M2 起使用)
if (typeof Element !== "undefined" && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
}

// jsdom 未实现 ResizeObserver,recharts ResponsiveContainer 挂载即抛错(2.5 雷达图)
// 空实现即可:jsdom 中图表不会测量渲染,断言走 HTML 图例文本
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom 未实现 matchMedia,ThemeProvider(6.9)挂载即调用;可监听的 stub,matches 恒 false(浅色)
if (typeof window !== "undefined" && !window.matchMedia) {
  const noop = () => {};
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: noop,
      removeListener: noop,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
