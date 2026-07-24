"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DAY_PHASES } from "@/features/marketing/landing-data";
import { SectionLabel, SectionTitle } from "./landing-ui";
import { cn } from "@/lib/utils";

export function DayInRestaurantSection() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const phase = DAY_PHASES[active];

  return (
    <section id="story" className="bg-white py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <SectionLabel>A day inside your restaurant</SectionLabel>
          <SectionTitle className="mt-3 sm:mt-4">
            From first light to last bill, one calm thread.
          </SectionTitle>
          <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-[#5c6b64] sm:mt-5 sm:text-lg">
            Walk through a shift and feel where chaos used to live, without a feature dump.
          </p>
        </div>

        <div className="mt-10 grid gap-6 lg:mt-14 lg:grid-cols-[minmax(0,260px)_1fr] lg:gap-12">
          {/* Mobile: segmented control */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:flex-col lg:gap-2 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {DAY_PHASES.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2.5 text-left transition-[background-color,transform,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] lg:w-full lg:rounded-2xl lg:px-5 lg:py-4",
                  active === i
                    ? "bg-[#0f766e] text-white shadow-[0_12px_32px_-12px_rgba(15,118,110,0.4)]"
                    : "bg-[#f7f8f6] text-[#5c6b64] ring-1 ring-[#14201c]/[0.06] hover:ring-[#14201c]/[0.12]"
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
                  {item.time}
                </span>
                <span className="mt-0.5 block text-sm font-semibold lg:mt-1">
                  {item.title.split(".")[0]}
                </span>
              </button>
            ))}
          </div>

          <div className="rounded-[1.25rem] bg-[#14201c]/[0.03] p-1 ring-1 ring-[#14201c]/[0.06] sm:rounded-[1.5rem] sm:p-1.5">
            <div className="min-h-[280px] rounded-[calc(1.25rem-0.25rem)] bg-[#f7f8f6] p-6 sm:min-h-[320px] sm:rounded-[calc(1.5rem-0.375rem)] sm:p-8 lg:min-h-[360px] lg:p-10">
              <AnimatePresence mode="wait">
                <motion.div
                  key={phase.id}
                  initial={reduce ? false : { opacity: 0, transform: "translateY(12px)" }}
                  animate={{ opacity: 1, transform: "translateY(0px)" }}
                  exit={reduce ? undefined : { opacity: 0, transform: "translateY(-8px)" }}
                  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                >
                  <p className="text-sm font-semibold text-[#0f766e]">{phase.time}</p>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#14201c] sm:mt-3 sm:text-3xl">
                    {phase.title}
                  </h3>
                  <ul className="mt-6 space-y-4 sm:mt-8 sm:space-y-5">
                    {phase.beats.map((beat, i) => (
                      <motion.li
                        key={beat}
                        initial={reduce ? false : { opacity: 0, transform: "translateX(-8px)" }}
                        animate={{ opacity: 1, transform: "translateX(0px)" }}
                        transition={{ delay: 0.05 + i * 0.05, duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                        className="flex gap-3 sm:gap-4"
                      >
                        <span className="mt-2.5 h-px w-6 shrink-0 bg-[#0f766e] sm:w-8" />
                        <span className="text-[15px] leading-relaxed text-[#5c6b64] sm:text-base">
                          {beat}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
