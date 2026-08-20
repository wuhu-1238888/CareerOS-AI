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
