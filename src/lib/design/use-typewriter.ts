"use client";
// 打字机渲染 hook(7.2,用户拍板方案 ③):服务端落库后,前端对本轮新出现的文本逐字渲染
// (rAF 每 ~20ms 批 2-3 字),替代 SSE 流式;刷新恢复的历史消息直接整段渲染(调用方决定是否启用)。
// 可访问性:prefers-reduced-motion 一次到位;不挂 aria-live(避免整段朗读,状态气泡另用 role=status)。
import { useEffect, useRef, useState } from "react";

const TICK_MS = 20;
const MIN_CHARS = 2;
const MAX_CHARS = 3;

export function useTypewriter(text: string, options?: { onDone?: () => void }): string {
  const [shown, setShown] = useState(() =>
    // 首帧:减少动态效果偏好时直接全量(与 effect 内一致,避免先空后满闪烁)
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? text
      : ""
  );
  const onDoneRef = useRef(options?.onDone);
  onDoneRef.current = options?.onDone;

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(text);
      onDoneRef.current?.();
      return;
    }
    setShown("");
    if (!text) {
      onDoneRef.current?.();
      return;
    }

    let index = 0;
    let tickCount = 0;
    let lastTick = 0;
    let cancelled = false;
    // rAF 优先(浏览器动画帧);jsdom/旧环境无 rAF 时回退 setTimeout(约一帧,手动补时间戳)
    const schedule: (cb: (now: number) => void) => number =
      typeof requestAnimationFrame === "function"
        ? (cb) => requestAnimationFrame(cb)
        : (cb) => window.setTimeout(() => cb(Date.now()), 16);
    const cancel =
      typeof cancelAnimationFrame === "function"
        ? (id: number) => cancelAnimationFrame(id)
        : (id: number) => window.clearTimeout(id);

    const step = (now: number) => {
      if (cancelled) return;
      if (index >= text.length) return; // 已完成:忽略残留帧,不重复回调
      if (now - lastTick >= TICK_MS) {
        lastTick = now;
        // 每 tick 交替推进 2/3 字(按 tick 计数交替,视觉上均匀);到末尾即结束并回调
        tickCount += 1;
        const stepSize = tickCount % 2 === 1 ? MIN_CHARS : MAX_CHARS;
        index = Math.min(text.length, index + stepSize);
        setShown(text.slice(0, index));
        if (index >= text.length) {
          onDoneRef.current?.();
          return;
        }
      }
      rafId = schedule(step);
    };

    let rafId = schedule(step);
    return () => {
      cancelled = true;
      cancel(rafId);
    };
  }, [text]);

  return shown;
}
