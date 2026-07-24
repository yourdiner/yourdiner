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
      className="relative overflow-x-hidden bg-[#f7f8f6] py-16 text-[#14201c] sm:py-24 lg:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_80%_10%,rgba(15,118,110,0.1),transparent)]"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div>
            <SectionLabel>Interactive floor</SectionLabel>
            <SectionTitle className="mt-3 sm:mt-4">
              Tap the room. See how it connects.
            </SectionTitle>
            <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[#5c6b64] sm:mt-5 sm:text-lg">
              Tables, kitchen, counter, takeaway, and delivery stay on one live floor, not five
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
                      ? "bg-[#0f766e] text-white"
                      : "bg-white text-[#5c6b64] ring-1 ring-[#14201c]/[0.08] hover:ring-[#14201c]/[0.14]"
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
                className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-[#14201c]/[0.08] shadow-[0_12px_32px_-20px_rgba(15,61,54,0.2)] sm:mt-6 sm:p-6"
              >
                <p className="text-sm font-semibold text-[#0f766e]">{active.label}</p>
                <h3 className="mt-1.5 text-lg font-semibold tracking-tight text-[#14201c] sm:mt-2 sm:text-xl">
                  {active.headline}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-[#5c6b64] sm:mt-3">
                  {active.detail}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="rounded-[1.25rem] bg-[#14201c]/[0.04] p-1 ring-1 ring-[#14201c]/[0.08] sm:rounded-[1.5rem] sm:p-1.5">
            <div className="relative aspect-[4/3] rounded-[calc(1.25rem-0.25rem)] bg-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:aspect-square sm:rounded-[calc(1.5rem-0.375rem)] sm:p-5">
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
                        fill={isActive ? "rgba(15,118,110,0.22)" : "rgba(20,32,28,0.04)"}
                        stroke={isActive ? "rgba(15,118,110,0.95)" : "rgba(20,32,28,0.12)"}
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
                        className="pointer-events-none fill-[#5c6b64] text-[3.2px] font-medium"
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
