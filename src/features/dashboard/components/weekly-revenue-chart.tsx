"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface WeeklyChartProps {
  data: { label: string; value: number }[];
}

export function WeeklyRevenueChart({ data }: WeeklyChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const animated = useRef(false);

  useEffect(() => {
    animated.current = true;
  }, []);

  return (
    <div className="relative flex h-64 items-end justify-between border-b border-tertiary-fixed px-admin-md pb-admin-base">
      {data.map((day) => {
        const heightPct = Math.max((day.value / max) * 100, 4);
        return (
          <div key={day.label} className="group flex w-full flex-col items-center gap-admin-sm">
            <div
              className={cn(
                "chart-bar w-12 cursor-pointer bg-primary-fixed-dim transition-all hover:bg-primary",
                animated.current && "animate-in"
              )}
              style={{ height: `${heightPct}%` }}
              title={day.value > 0 ? `${day.label}: ${day.value}` : day.label}
            />
            <span className="text-label-sm text-on-surface-variant">{day.label}</span>
          </div>
        );
      })}
    </div>
  );
}
