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
          className="w-1.5 rounded-full bg-sky-400/80 sm:w-2"
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
      className="relative overflow-x-hidden bg-[#050508] pt-20 pb-12 text-zinc-50 sm:pt-28 sm:pb-16 lg:min-h-[100dvh] lg:pb-24 lg:pt-32"
      onMouseMove={(e) => {
        if (reduce) return;
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
        mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-15%,rgba(14,165,233,0.16),transparent_58%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-24 h-72 w-72 rounded-full bg-sky-500/[0.08] blur-3xl"
      />

      <div className="relative z-[2] mx-auto grid max-w-7xl gap-8 px-5 sm:gap-10 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-12 lg:px-8">
        <motion.div
          variants={fadeUpBlur}
          initial="hidden"
          animate="show"
          className="mx-auto w-full max-w-xl text-center lg:mx-0 lg:text-left"
        >
          <p className="font-[family-name:var(--font-jakarta)] text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            {brandName}
          </p>
          <h1 className="mt-4 text-[2rem] font-semibold leading-[1.08] tracking-tight sm:mt-5 sm:text-5xl lg:text-[3.25rem]">
            Run your restaurant.
            <span className="mt-1 block text-zinc-400">Not your problems.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-[38ch] text-[15px] leading-relaxed text-zinc-400 sm:mt-5 sm:text-base lg:mx-0 lg:max-w-[48ch]">
            Tables, kitchen, billing, and QR ordering — one calm operating system for service.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:justify-center lg:justify-start">
            <PrimaryCta href="/register">Start Free Trial</PrimaryCta>
            <SecondaryCta href="mailto:hello@restaurant-os.com" dark>
              Book Demo
            </SecondaryCta>
          </div>
          <p className="mt-3 text-sm text-zinc-500">No credit card required</p>
        </motion.div>

        <motion.div
          style={reduce ? undefined : { x: parallaxX, y: parallaxY }}
          className="relative mx-auto w-full max-w-md lg:max-w-none"
          initial={reduce ? false : { opacity: 0, transform: "translateY(20px) scale(0.98)" }}
          animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
          transition={{ delay: 0.15, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <div className="rounded-[1.25rem] bg-white/[0.04] p-1 ring-1 ring-white/[0.08] sm:rounded-[1.5rem] sm:p-1.5">
            <div className="overflow-hidden rounded-[calc(1.25rem-0.25rem)] bg-zinc-950/95 sm:rounded-[calc(1.5rem-0.375rem)]">
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2.5 sm:px-4 sm:py-3">
                <span className="h-2 w-2 rounded-full bg-zinc-600 sm:h-2.5 sm:w-2.5" />
                <span className="h-2 w-2 rounded-full bg-zinc-600 sm:h-2.5 sm:w-2.5" />
                <span className="h-2 w-2 rounded-full bg-zinc-600 sm:h-2.5 sm:w-2.5" />
                <span className="ml-1.5 truncate text-[10px] font-medium text-zinc-500">
                  {brandName} / Tonight
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 sm:gap-3 sm:p-4">
                <div className="col-span-2 rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08] sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Today&apos;s revenue
                  </p>
                  <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-zinc-50 sm:text-2xl">
                    ₹{revenue.toLocaleString("en-IN")}
                  </p>
                  <div className="mt-2">
                    <MiniChart />
                  </div>
                </div>

                <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08] sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Tables
                  </p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold text-emerald-400 sm:mt-2 sm:text-3xl">
                    {tables}
                    <span className="text-base text-zinc-500 sm:text-lg">/18</span>
                  </p>
                </div>

                <div className="rounded-xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08] sm:rounded-2xl sm:p-4">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Kitchen
                  </p>
                  <p className="mt-1.5 font-mono text-2xl font-semibold text-amber-300 sm:mt-2 sm:text-3xl">
                    {queue}
                  </p>
                </div>

                <div className="hidden rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08] sm:block">
                  <p className="text-[10px] text-zinc-500">Reservations</p>
                  <p className="mt-1 text-sm font-medium text-zinc-200">7:30 · Table 4</p>
                  <p className="text-sm font-medium text-zinc-200">8:15 · Table 9</p>
                </div>

                <div className="hidden rounded-2xl bg-white/[0.04] p-3 ring-1 ring-white/[0.08] sm:block">
                  <p className="text-[10px] text-zinc-500">Orders</p>
                  <p className="mt-1 text-sm text-zinc-300">T3 · 2 mains firing</p>
                  <p className="text-sm text-zinc-300">T11 · QR reorder</p>
                </div>

                <div className="col-span-2 rounded-xl bg-sky-500/10 p-3 ring-1 ring-sky-400/20 sm:rounded-2xl">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-200">Guest rating tonight</p>
                    <p className="font-mono text-lg font-semibold text-zinc-50">4.8</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-sky-400"
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
