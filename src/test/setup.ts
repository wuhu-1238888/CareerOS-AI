import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// vitest 未开 globals,RTL 不会自动注册清理;显式注册防止用例间 DOM 累积
afterEach(() => {
  cleanup();
});
