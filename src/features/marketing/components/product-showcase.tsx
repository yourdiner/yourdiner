"use client";

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { PRODUCT_SCREENS } from "@/features/marketing/landing-data";
import { SectionLabel, SectionTitle } from "./landing-ui";
import { cn } from "@/lib/utils";

function ScreenContent({ id }: { id: string }) {
  if (id === "dashboard") {
    return (
      <div className="grid grid-cols-3 gap-2 p-3 sm:p-4">
        <div className="col-span-2 rounded-xl bg-zinc-900/80 p-3 ring-1 ring-white/[0.06]">
          <p className="text-[9px] text-zinc-500">Revenue</p>
          <p className="font-mono text-lg font-semibold text-zinc-100">₹1.2L</p>
        </div>
        <div className="rounded-xl bg-emerald-500/10 p-3 ring-1 ring-emerald-500/20">
          <p className="text-[9px] text-emerald-400/80">Live</p>
          <p className="font-mono text-lg font-semibold text-emerald-300">18</p>
        </div>
        {[1, 2, 3].map((n) => (
          <div key={n} className="rounded-xl bg-zinc-900/60 p-2 ring-1 ring-white/[0.04]">
            <div className="h-8 rounded-lg bg-white/[0.04]" />
          </div>
        ))}
      </div>
    );
  }
  if (id === "orders") {
    return (
      <div className="space-y-2 p-3 sm:p-4">
        {["T4 · Dine-in", "T9 · QR reorder", "Pickup #218"].map((row, i) => (
          <div
            key={row}
            className="flex items-center justify-between rounded-xl bg-zinc-900/70 px-3 py-2 ring-1 ring-white/[0.05]"
          >
            <span className="text-xs text-zinc-300">{row}</span>
            <span className="text-[10px] text-sky-400">{i === 0 ? "Firing" : "New"}</span>
          </div>
        ))}
      </div>
    );
  }
  if (id === "kitchen") {
    return (
      <div className="grid grid-cols-2 gap-2 p-3 sm:p-4">
        {["Grill", "Cold", "Fry", "Expo"].map((station) => (
          <div key={station} className="rounded-xl bg-zinc-900/70 p-2 ring-1 ring-white/[0.05]">
            <p className="text-[9px] font-medium text-zinc-500">{station}</p>
            <div className="mt-2 space-y-1">
              <div className="h-6 rounded-md bg-amber-500/15 ring-1 ring-amber-500/25" />
              <div className="h-6 rounded-md bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (id === "reservations") {
    return (
      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[8px] text-zinc-500">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {Array.from({ length: 14 }).map((_, i) => (
            <div
              key={i}
              className={`aspect-square rounded-md ${
                i === 8 || i === 11 ? "bg-sky-500/30 ring-1 ring-sky-400/40" : "bg-white/[0.03]"
              }`}
            />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="p-3 sm:p-4">
      <div className="flex h-24 items-end gap-1">
        {[40, 65, 50, 80, 72, 95, 68].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-md bg-sky-400/70" style={{ height: `${h}%` }} />
        ))}
      </div>
      <p className="mt-3 text-center text-[10px] text-zinc-500">Weekly revenue trend</p>
    </div>
  );
}

export function ProductShowcaseSection() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const screen = PRODUCT_SCREENS[active];

  return (
    <section id="product" className="bg-[#fafafa] py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
          <div className="max-w-xl">
            <SectionLabel>Product</SectionLabel>
            <SectionTitle className="mt-3 sm:mt-4">Built like premium software feels.</SectionTitle>
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {PRODUCT_SCREENS.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(i)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]",
                  active === i
                    ? "bg-zinc-950 text-zinc-50"
                    : "bg-white text-zinc-600 ring-1 ring-zinc-950/[0.08] hover:ring-zinc-950/[0.15]"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:mt-14 lg:grid-cols-2 lg:items-center lg:gap-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={screen.id}
              initial={reduce ? false : { opacity: 0, transform: "translateY(10px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={reduce ? undefined : { opacity: 0, transform: "translateY(-6px)" }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
            >
              <h3 className="text-xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                {screen.title}
              </h3>
              <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-zinc-500 sm:mt-4 sm:text-lg">
                {screen.description}
              </p>
            </motion.div>
          </AnimatePresence>

          <motion.div
            initial={reduce ? false : { opacity: 0, transform: "translateY(16px)" }}
            whileInView={{ opacity: 1, transform: "translateY(0px)" }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          >
            <div className="rounded-[1.25rem] bg-zinc-950/[0.04] p-1 ring-1 ring-zinc-950/[0.06] sm:rounded-[1.5rem] sm:p-1.5">
              <div className="overflow-hidden rounded-[calc(1.25rem-0.25rem)] bg-zinc-950 shadow-[0_24px_48px_-20px_rgba(24,24,27,0.35)] sm:rounded-[calc(1.5rem-0.375rem)]">
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 sm:px-4 sm:py-3">
                  <span className="h-2 w-2 rounded-full bg-zinc-600" />
                  <span className="h-2 w-2 rounded-full bg-zinc-600" />
                  <span className="h-2 w-2 rounded-full bg-zinc-600" />
                  <span className="ml-2 text-[10px] text-zinc-500">{screen.label}</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={screen.id}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={reduce ? undefined : { opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ScreenContent id={screen.id} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
