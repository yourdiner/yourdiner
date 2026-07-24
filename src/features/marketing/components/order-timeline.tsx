"use client";

import { useState } from "react";
import {
  Armchair,
  BellRing,
  CalendarCheck,
  ChefHat,
  ClipboardList,
  Receipt,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FLOW_STEPS } from "@/features/marketing/landing-data";
import { EASE_OUT_STRONG } from "@/features/marketing/landing-tokens";
import { BezelCard, ICON_STROKE, SectionTitle } from "./landing-ui";
import { cn } from "@/lib/utils";

const STEP_VISUALS: {
  icon: LucideIcon;
  tint: string;
  image: string;
}[] = [
  {
    icon: CalendarCheck,
    tint: "from-[#0f766e]/25 via-teal-500/10 to-[#eef2ef]",
    image: "https://picsum.photos/seed/cafe-reservation-hold/900/700",
  },
  {
    icon: Armchair,
    tint: "from-[#0f766e]/20 via-emerald-500/10 to-[#eef2ef]",
    image: "https://picsum.photos/seed/restaurant-floor-seating/900/700",
  },
  {
    icon: ClipboardList,
    tint: "from-emerald-500/20 via-teal-500/10 to-[#eef2ef]",
    image: "https://picsum.photos/seed/waiter-order-pad/900/700",
  },
  {
    icon: ChefHat,
    tint: "from-amber-500/20 via-orange-500/10 to-[#eef2ef]",
    image: "https://picsum.photos/seed/kitchen-pass-tickets/900/700",
  },
  {
    icon: BellRing,
    tint: "from-rose-500/15 via-pink-500/10 to-[#eef2ef]",
    image: "https://picsum.photos/seed/expo-ready-service/900/700",
  },
  {
    icon: Receipt,
    tint: "from-[#0f766e]/20 via-teal-500/10 to-[#eef2ef]",
    image: "https://picsum.photos/seed/restaurant-bill-settle/900/700",
  },
  {
    icon: UserRoundCheck,
    tint: "from-teal-500/20 via-[#0f766e]/10 to-[#eef2ef]",
    image: "https://picsum.photos/seed/returning-guest-profile/900/700",
  },
];

export function OrderTimelineSection() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const step = FLOW_STEPS[active];
  const visual = STEP_VISUALS[active];
  const Icon = visual.icon;
  const progress = FLOW_STEPS.length > 1 ? active / (FLOW_STEPS.length - 1) : 1;

  return (
    <section id="flow" className="relative overflow-x-hidden bg-white py-16 sm:py-24 lg:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_0%_0%,rgba(15,118,110,0.08),transparent_55%)]"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <motion.div
          className="max-w-2xl"
          initial={reduce ? false : { opacity: 0, transform: "translateY(16px)" }}
          whileInView={{ opacity: 1, transform: "translateY(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.45, ease: EASE_OUT_STRONG }}
        >
          <SectionTitle>One thread from booking to return visit.</SectionTitle>
          <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-[#5c6b64] sm:mt-5 sm:text-lg">
            Every handoff stays on the same guest record. Floor, kitchen, and till share context
            without re-entry or lost tickets.
          </p>
        </motion.div>

        <div className="mt-10 lg:mt-14">
          <div className="relative">
            <div className="hidden lg:block">
              <div className="absolute left-[3.5%] right-[3.5%] top-[2.15rem] h-px bg-[#e2e8e4]" />
              <motion.div
                aria-hidden
                className="absolute left-[3.5%] top-[2.15rem] h-px w-[93%] origin-left bg-[#0f766e]"
                initial={false}
                animate={{ transform: `scaleX(${progress})` }}
                transition={{ duration: 0.3, ease: EASE_OUT_STRONG }}
              />
            </div>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] lg:grid lg:grid-cols-7 lg:gap-3 lg:overflow-visible lg:pb-0 lg:snap-none [&::-webkit-scrollbar]:hidden">
              {FLOW_STEPS.map((item, i) => {
                const StepIcon = STEP_VISUALS[i].icon;
                const isActive = active === i;
                const isPast = i < active;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActive(i)}
                    className={cn(
                      "group relative flex min-w-[8.5rem] shrink-0 snap-start flex-col rounded-2xl p-3.5 text-left sm:min-w-[9.5rem] sm:p-4",
                      "transition-[transform,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
                      "active:scale-[0.97] motion-reduce:transition-none",
                      isActive
                        ? "bg-[#0f766e] text-white shadow-[0_16px_40px_-16px_rgba(15,118,110,0.45)]"
                        : "bg-[#f7f8f6] text-[#5c6b64] ring-1 ring-[#14201c]/[0.06] hover:ring-[#14201c]/[0.12]"
                    )}
                  >
                    <span
                      className={cn(
                        "relative z-[1] flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200 sm:h-9 sm:w-9",
                        isActive
                          ? "bg-white/20 text-white"
                          : isPast
                            ? "bg-[#0f766e]/10 text-[#0f766e]"
                            : "bg-white text-[#7a8a82]"
                      )}
                    >
                      <StepIcon className="h-4 w-4" strokeWidth={ICON_STROKE} />
                    </span>
                    <span className="mt-2.5 text-sm font-semibold leading-snug sm:mt-3">
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:mt-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <BezelCard>
              <div className="flex min-h-[220px] flex-col justify-between p-6 sm:min-h-[260px] sm:p-10">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step.id}
                    initial={reduce ? false : { opacity: 0, transform: "translateY(12px)" }}
                    animate={{ opacity: 1, transform: "translateY(0px)" }}
                    exit={reduce ? undefined : { opacity: 0, transform: "translateY(-8px)" }}
                    transition={{ duration: 0.28, ease: EASE_OUT_STRONG }}
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0f766e]/10 text-[#0f766e]">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={ICON_STROKE} />
                    </span>
                    <h3 className="mt-4 text-xl font-semibold tracking-tight text-[#14201c] sm:mt-5 sm:text-3xl">
                      {step.title}
                    </h3>
                    <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[#5c6b64] sm:mt-4 sm:text-base">
                      {step.description}
                    </p>
                  </motion.div>
                </AnimatePresence>

                <div className="mt-6 flex gap-2 sm:mt-8">
                  <button
                    type="button"
                    onClick={() => setActive((i) => Math.max(0, i - 1))}
                    disabled={active === 0}
                    className="rounded-full px-4 py-2 text-sm font-semibold text-[#5c6b64] transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] enabled:hover:text-[#14201c] enabled:active:scale-[0.97] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setActive((i) => Math.min(FLOW_STEPS.length - 1, i + 1))}
                    disabled={active === FLOW_STEPS.length - 1}
                    className="rounded-full bg-[#0f766e] px-5 py-2 text-sm font-semibold text-white transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] enabled:hover:bg-[#0d9488] enabled:active:scale-[0.97] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            </BezelCard>
          </div>

          <div className="lg:col-span-5">
            <BezelCard innerClassName="overflow-hidden">
              <div className="relative aspect-[5/4] w-full sm:aspect-[4/3] lg:aspect-auto lg:min-h-[300px]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step.id}
                    className="absolute inset-0"
                    initial={reduce ? false : { opacity: 0, transform: "scale(1.02)" }}
                    animate={{ opacity: 1, transform: "scale(1)" }}
                    exit={reduce ? undefined : { opacity: 0, transform: "scale(0.99)" }}
                    transition={{ duration: 0.35, ease: EASE_OUT_STRONG }}
                  >
                    <div className={cn("absolute inset-0 bg-gradient-to-br", visual.tint)} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={visual.image}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-80 mix-blend-multiply"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f3d36]/55 via-[#0f3d36]/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
                      <p className="text-sm font-semibold text-white">{step.title}</p>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </BezelCard>
          </div>
        </div>
      </div>
    </section>
  );
}
