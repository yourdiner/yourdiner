"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

/** Admin UI is designed for light mode only — lock theme while on dashboard routes. */
export function AdminThemeLock() {
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (resolvedTheme !== "light") {
      setTheme("light");
    }
  }, [resolvedTheme, setTheme]);

  return null;
}
