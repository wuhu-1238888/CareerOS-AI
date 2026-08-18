import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("首页(任务 1.1 占位)", () => {
  it("渲染空 main 容器", () => {
    const { container } = render(<Home />);
    expect(container.querySelector("main")).toBeInTheDocument();
  });
});
