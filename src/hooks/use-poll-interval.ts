"use client";

import { useEffect, useRef } from "react";

/** Runs callback on an interval; skips the first tick (initial data comes from SSR). */
export function usePollInterval(callback: () => void, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      callbackRef.current();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, enabled]);
}
