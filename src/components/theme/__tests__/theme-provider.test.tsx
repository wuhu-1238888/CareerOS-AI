// 主题提供者测试(6.9):三态初始化与持久化、dark 类挂载、system 跟随系统、非法存储值回退、themechange 事件。
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "../theme-provider";

// 可控 matchMedia mock(覆盖 setup.ts 全局 stub):matches 由 mediaState 决定,change 监听被捕获
let mediaState: { dark: boolean };
let mediaListener: (() => void) | null;

function installMatchMediaMock() {
  mediaState = { dark: false };
  mediaListener = null;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return mediaState.dark;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, listener: () => void) => {
      mediaListener = listener;
    },
    removeEventListener: vi.fn(),
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Probe:消费 context,暴露三态切换入口
function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme("system")}>set-system</button>
      <button onClick={() => setTheme("light")}>set-light</button>
      <button onClick={() => setTheme("dark")}>set-dark</button>
    </div>
  );
}

const STORAGE_KEY = "careeros-theme";

beforeEach(() => {
  installMatchMediaMock();
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
});

describe("ThemeProvider", () => {
  it("存储为空时默认 system,系统偏好浅色 → 不挂 dark 类", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("切深色 → html 挂 dark 类 + 持久化 + 派发 themechange;切浅色 → 移除", () => {
    const changeSpy = vi.fn();
    window.addEventListener("themechange", changeSpy);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByText("set-dark"));
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("dark");
    fireEvent.click(screen.getByText("set-light"));
    expect(screen.getByTestId("theme").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("light");
    expect(changeSpy).toHaveBeenCalled();
    window.removeEventListener("themechange", changeSpy);
  });

  it("system 态跟随系统偏好:matchMedia 变化 → dark 类随之切换", () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(mediaListener).not.toBeNull();
    mediaState.dark = true;
    act(() => {
      mediaListener?.();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    mediaState.dark = false;
    act(() => {
      mediaListener?.();
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("显式 dark 不监听系统变化(mediaListener 未注册)", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(mediaListener).toBeNull();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("存储值为 dark → 初始即挂 dark 类", () => {
    window.localStorage.setItem(STORAGE_KEY, "dark");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("非法存储值回退 system(系统浅色 → 不挂 dark)", () => {
    window.localStorage.setItem(STORAGE_KEY, "blue");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("system 态下 setTheme('system') 持久化并跟随当前系统偏好", () => {
    mediaState.dark = true;
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    // 初始 system + 系统深色 → 挂 dark
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(screen.getByText("set-system"));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
