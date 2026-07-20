"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FLOOR_ZONES } from "@/features/marketing/landing-data";
import { SectionLabel, SectionTitle } from "./landing-ui";
import { cn } from "@/lib/utils";

export function InteractiveFloorSection() {
  const [activeId, setActiveId] = useState(FLOOR_ZONES[0].id);
  const reduce = useReducedMotion();
  const active = FLOOR_ZONES.find((z) => z.id === activeId) ?? FLOOR_ZONES[0];

  return (
    <section
      id="floor"
      className="relative overflow-x-hidden bg-[#0a0a0f] py-16 text-zinc-50 sm:py-24 lg:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_80%_10%,rgba(14,165,233,0.12),transparent)]"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div>
            <SectionLabel>Interactive floor</SectionLabel>
            <SectionTitle light className="mt-3 sm:mt-4">
              Tap the room. See how it connects.
            </SectionTitle>
            <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-zinc-400 sm:mt-5 sm:text-lg">
              Tables, kitchen, counter, takeaway, and delivery stay on one live floor — not five
              disconnected tools.
            </p>

            <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:mt-8 [&::-webkit-scrollbar]:hidden lg:flex-wrap">
              {FLOOR_ZONES.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => setActiveId(zone.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]",
                    activeId === zone.id
                      ? "bg-sky-500 text-zinc-950"
                      : "bg-white/10 text-zinc-300 hover:bg-white/[0.14]"
                  )}
                >
                  {zone.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={reduce ? false : { opacity: 0, transform: "translateY(10px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={reduce ? undefined : { opacity: 0, transform: "translateY(-6px)" }}
                transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
                className="mt-5 rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/[0.08] sm:mt-6 sm:p-6"
              >
                <p className="text-sm font-semibold text-sky-400">{active.label}</p>
                <h3 className="mt-1.5 text-lg font-semibold tracking-tight sm:mt-2 sm:text-xl">
                  {active.headline}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-zinc-400 sm:mt-3">
                  {active.detail}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="rounded-[1.25rem] bg-white/[0.03] p-1 ring-1 ring-white/[0.08] sm:rounded-[1.5rem] sm:p-1.5">
            <div className="relative aspect-[4/3] rounded-[calc(1.25rem-0.25rem)] bg-zinc-950/80 p-3 sm:aspect-square sm:rounded-[calc(1.5rem-0.375rem)] sm:p-5">
              <svg viewBox="0 0 100 100" className="h-full w-full" aria-label="Restaurant floor plan">
                {FLOOR_ZONES.map((zone) => {
                  const isActive = zone.id === activeId;
                  return (
                    <g key={zone.id}>
                      <motion.rect
                        x={zone.x}
                        y={zone.y}
                        width={zone.w}
                        height={zone.h}
                        rx={2.5}
                        fill={isActive ? "rgba(14,165,233,0.32)" : "rgba(255,255,255,0.06)"}
                        stroke={isActive ? "rgba(56,189,248,0.95)" : "rgba(255,255,255,0.12)"}
                        strokeWidth={isActive ? 0.6 : 0.4}
                        className="cursor-pointer"
                        onClick={() => setActiveId(zone.id)}
                        whileHover={reduce ? undefined : { scale: 1.02 }}
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        style={{
                          transformOrigin: `${zone.x + zone.w / 2}px ${zone.y + zone.h / 2}px`,
                        }}
                      />
                      <text
                        x={zone.x + zone.w / 2}
                        y={zone.y + zone.h / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="pointer-events-none fill-zinc-300 text-[3.2px] font-medium"
                      >
                        {zone.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
