"use client";

import { useEffect, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { PrimaryCta, SecondaryCta } from "./landing-ui";
import { fadeUpBlur } from "@/features/marketing/motion";

interface HeroDashboardProps {
  brandName: string;
}

function useAnimatedNumber(target: number, duration = 1.6) {
  const [value, setValue] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      setValue(target);
      return;
    }
    let start: number | null = null;
    let frame: number;
    const step = (ts: number) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / (duration * 1000), 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduce]);

  return value;
}

function MiniChart() {
  const bars = [42, 68, 55, 82, 74, 91, 63];
  return (
    <div className="flex h-10 items-end gap-1 sm:h-12">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-1.5 rounded-full bg-[#0f766e]/80 sm:w-2"
          initial={{ height: 0 }}
          animate={{ height: `${h}%` }}
          transition={{ delay: 0.35 + i * 0.05, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        />
      ))}
    </div>
  );
}

export function HeroDashboard({ brandName }: HeroDashboardProps) {
  const revenue = useAnimatedNumber(84720);
  const tables = useAnimatedNumber(14);
  const queue = useAnimatedNumber(6);
  const reduce = useReducedMotion();

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 60, damping: 20 });
  const springY = useSpring(mouseY, { stiffness: 60, damping: 20 });
  const parallaxX = useTransform(springX, [-0.5, 0.5], [-10, 10]);
  const parallaxY = useTransform(springY, [-0.5, 0.5], [-6, 6]);

  return (
    <section
      id="hero"
      className="relative overflow-x-hidden bg-[#f7f8f6] pt-20 pb-12 text-[#14201c] sm:pt-28 sm:pb-16 lg:min-h-[100dvh] lg:pb-24 lg:pt-28"
      onMouseMove={(e) => {
        if (reduce) return;
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
        mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(15,118,110,0.14),transparent_58%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-[#0f766e]/[0.1] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 bottom-10 h-56 w-56 rounded-full bg-[#14b8a6]/[0.08] blur-3xl"
      />

      <div className="relative z-[2] mx-auto grid max-w-7xl gap-8 px-5 sm:gap-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8">
        <motion.div
          variants={fadeUpBlur}
          initial="hidden"
          animate="show"
          className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left"
        >
          <p className="font-[family-name:var(--font-jakarta)] text-2xl font-semibold tracking-tight text-[#0f766e] sm:text-3xl">
            {brandName}
          </p>
          <h1 className="mt-4 text-[2rem] font-semibold leading-[1.08] tracking-tight text-[#14201c] sm:mt-5 sm:text-5xl lg:text-[3.25rem]">
            Run your restaurant.
            <span className="mt-1 block text-[#5c6b64]">Not your problems.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[38ch] text-[15px] leading-relaxed text-[#5c6b64] sm:mt-5 sm:text-base lg:mx-0 lg:max-w-[48ch]">
            Tables, kitchen, billing, and QR ordering. One calm operating system for service.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
            <PrimaryCta href="/register">Start Free Trial</PrimaryCta>
            <SecondaryCta href="mailto:hello@restaurant-os.com">Book Demo</SecondaryCta>
          </div>
          <p className="mt-3 text-sm text-[#7a8a82]">No credit card required</p>
        </motion.div>

        <motion.div
          style={reduce ? undefined : { x: parallaxX, y: parallaxY }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
          initial={reduce ? false : { opacity: 0, transform: "translateY(20px) scale(0.98)" }}
          animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="rounded-[1.25rem] bg-[#14201c]/[0.04] p-1 ring-1 ring-[#14201c]/[0.08] shadow-[0_24px_64px_-28px_rgba(15,61,54,0.35)] sm:rounded-[1.5rem] sm:p-1.5">
            <div className="overflow-hidden rounded-[calc(1.25rem-0.25rem)] bg-white sm:rounded-[calc(1.5rem-0.375rem)]">
              <div className="flex items-center gap-2 border-b border-[#14201c]/[0.06] bg-[#eef2ef]/60 px-3 py-2.5 sm:px-4 sm:py-3">
                <span className="h-2 w-2 rounded-full bg-[#c4d0ca] sm:h-2.5 sm:w-2.5" />
                <span className="h-2 w-2 rounded-full bg-[#c4d0ca] sm:h-2.5 sm:w-2.5" />
                <span className="h-2 w-2 rounded-full bg-[#c4d0ca] sm:h-2.5 sm:w-2.5" />
                <span className="ml-1.5 truncate text-[10px] font-medium text-[#7a8a82]">
                  {brandName} / Tonight
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-4">
                <div className="col-span-2 rounded-xl bg-[#eef2ef]/80 p-3 ring-1 ring-[#14201c]/[0.05] sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#7a8a82]">
                    Today&apos;s revenue
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-[#14201c] sm:text-2xl">
                    ₹{revenue.toLocaleString("en-IN")}
                  </p>
                  <div className="mt-2">
                    <MiniChart />
                  </div>
                </div>

                <div className="rounded-xl bg-[#eef2ef]/80 p-3 ring-1 ring-[#14201c]/[0.05] sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#7a8a82]">
                    Tables
                  </p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold text-[#0f766e] sm:mt-2 sm:text-3xl">
                    {tables}
                    <span className="text-base text-[#7a8a82] sm:text-lg">/18</span>
                  </p>
                </div>

                <div className="rounded-xl bg-[#eef2ef]/80 p-3 ring-1 ring-[#14201c]/[0.05] sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-[#7a8a82]">
                    Kitchen
                  </p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold text-[#b45309] sm:mt-2 sm:text-3xl">
                    {queue}
                  </p>
                </div>

                <div className="hidden rounded-2xl bg-[#eef2ef]/80 p-3 ring-1 ring-[#14201c]/[0.05] sm:block">
                  <p className="text-[10px] text-[#7a8a82]">Reservations</p>
                  <p className="mt-1 text-sm font-medium text-[#14201c]">7:30 · Table 4</p>
                  <p className="text-sm font-medium text-[#14201c]">8:15 · Table 9</p>
                </div>

                <div className="hidden rounded-2xl bg-[#eef2ef]/80 p-3 ring-1 ring-[#14201c]/[0.05] sm:block">
                  <p className="text-[10px] text-[#7a8a82]">Orders</p>
                  <p className="mt-1 text-sm text-[#5c6b64]">T3 · 2 mains firing</p>
                  <p className="text-sm text-[#5c6b64]">T11 · QR reorder</p>
                </div>

                <div className="col-span-2 rounded-xl bg-[#0f766e]/10 p-3 ring-1 ring-[#0f766e]/20 sm:rounded-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-[#14201c]">Guest rating tonight</p>
                    <p className="font-mono text-lg font-semibold text-[#0f766e]">4.8</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#0f766e]/15">
                    <motion.div
                      className="h-full rounded-full bg-[#0f766e]"
                      initial={{ width: "0%" }}
                      animate={{ width: "96%" }}
                      transition={{ delay: 0.7, duration: 0.9, ease: [0.23, 1, 0.32, 1] }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
