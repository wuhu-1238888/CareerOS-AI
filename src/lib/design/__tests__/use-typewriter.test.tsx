// 打字机渲染 hook 测试(7.2):逐字推进(rAF 手动驱动帧)/ 完成回调 onDone / reduced-motion
// 一次到位 / 卸载清理不再推进 / 无 rAF 环境回退 setTimeout。jsdom 的 matchMedia 由 setup.ts
// 统一 stub(matches false),reduced-motion 用例临时覆盖。
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTypewriter } from "../use-typewriter";

function Probe({ text, onDone }: { text: string; onDone?: () => void }) {
  const shown = useTypewriter(text, { onDone });
  return <p data-testid="out">{shown}</p>;
}

const TEXT = "你好世界面试官"; // 7 字:2 + 3 + 2 = 7,三帧打满恰好完成

let rafCallback: ((now: number) => void) | null = null;

// 手动驱动 rAF:每帧回调存起,测试按帧时间戳推进(浏览器语义)
beforeEach(() => {
  rafCallback = null;
  vi.stubGlobal("requestAnimationFrame", (cb: (now: number) => void) => {
    rafCallback = cb;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    rafCallback = null;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function frame(now: number) {
  act(() => {
    rafCallback?.(now);
  });
}

describe("useTypewriter(7.2)", () => {
  it("逐字推进:每 ~20ms 一帧批 2-3 字交替,到末尾停止并触发 onDone 一次", () => {
    const onDone = vi.fn();
    render(<Probe text={TEXT} onDone={onDone} />);
    const out = () => screen.getByTestId("out").textContent;

    expect(out()).toBe(""); // 首帧前为空
    frame(20);
    expect(out()).toBe("你好"); // index 0 → 2 字
    frame(40);
    expect(out()).toBe("你好世界面"); // index 2 → 3 字
    frame(60);
    expect(out()).toBe(TEXT); // index 5 → 2 字(截断到末尾)
    expect(onDone).toHaveBeenCalledTimes(1);

    // 完成后额外帧不再推进/不再重复回调
    frame(80);
    expect(out()).toBe(TEXT);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("同一帧内未到 20ms 不推进(帧节流)", () => {
    render(<Probe text={TEXT} />);
    frame(8);
    expect(screen.getByTestId("out").textContent).toBe("");
    frame(20);
    expect(screen.getByTestId("out").textContent).toBe("你好");
  });

  it("prefers-reduced-motion:一次到位整段渲染并触发 onDone", () => {
    const original = window.matchMedia;
    const media = { matches: true, media: "", onchange: null, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false } as unknown as MediaQueryList;
    window.matchMedia = (query: string) => ({ ...media, media: query });
    const onDone = vi.fn();
    render(<Probe text={TEXT} onDone={onDone} />);
    expect(screen.getByTestId("out").textContent).toBe(TEXT);
    expect(onDone).toHaveBeenCalledTimes(1);
    window.matchMedia = original;
  });

  it("卸载后不再推进(cancelled 清理,不抛错)", () => {
    const { unmount } = render(<Probe text={TEXT} />);
    frame(20);
    expect(screen.getByTestId("out").textContent).toBe("你好");
    unmount();
    // 卸载时 cleanup 已 cancel 当前帧;再手动触发残留回调不应抛错
    expect(() => frame(40)).not.toThrow();
  });

  it("无 rAF 环境回退 setTimeout(约一帧)仍逐字推进", () => {
    vi.stubGlobal("requestAnimationFrame", undefined);
    // Date 一并 fake:回退路径用 Date.now() 做帧节流,真实时钟下 fake timers 永远不满 20ms 阈值
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    render(<Probe text={TEXT} />);
    expect(screen.getByTestId("out").textContent).toBe("");
    act(() => {
      vi.advanceTimersByTime(160);
    });
    expect(screen.getByTestId("out").textContent).toBe(TEXT);
  });
});
