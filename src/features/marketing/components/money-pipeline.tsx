"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PAIN_POINTS } from "@/features/marketing/landing-data";
import { SectionLabel, SectionTitle } from "./landing-ui";

export function MoneyPipelineSection({ brandName }: { brandName: string }) {
  const reduce = useReducedMotion();

  return (
    <section
      id="problems"
      className="relative overflow-x-hidden bg-[#eef2ef] py-16 text-[#14201c] sm:py-24 lg:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_15%_85%,rgba(185,28,28,0.06),transparent)]"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <SectionLabel>Why revenue leaks</SectionLabel>
          <SectionTitle className="mt-3 sm:mt-4">
            Small frictions compound into lost covers.
          </SectionTitle>
          <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-[#5c6b64] sm:mt-5 sm:text-lg">
            Most restaurants do not fail from one big mistake. They bleed from waiting, rework,
            and tools that never talk to each other.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:mt-14 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {PAIN_POINTS.map((point, i) => (
            <motion.div
              key={point.id}
              initial={reduce ? false : { opacity: 0, transform: "translateY(14px)" }}
              whileInView={{ opacity: 1, transform: "translateY(0px)" }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className="rounded-2xl bg-white p-4 ring-1 ring-red-200/80 shadow-[0_8px_24px_-16px_rgba(20,32,28,0.12)] sm:p-5"
            >
              <p className="text-sm font-semibold text-[#14201c]">{point.label}</p>
              <p className="mt-1.5 text-sm text-red-700/90 sm:mt-2">{point.cost}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, transform: "translateY(12px) scale(0.98)" }}
          whileInView={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="mt-12 rounded-[1.25rem] bg-[#0f766e]/10 p-1 ring-1 ring-[#0f766e]/20 sm:mt-16 sm:rounded-[1.5rem] sm:p-1.5"
        >
          <div className="rounded-[calc(1.25rem-0.25rem)] bg-white px-5 py-8 text-center sm:rounded-[calc(1.5rem-0.375rem)] sm:px-12 sm:py-12">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0f766e] sm:text-sm">
              With {brandName}
            </p>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight text-[#14201c] sm:mt-4 sm:text-4xl">
              Everything becomes connected.
            </h3>
            <p className="mx-auto mt-3 max-w-[44ch] text-[15px] leading-relaxed text-[#5c6b64] sm:mt-4 sm:text-base">
              One floor, one kitchen queue, one customer record. Fewer handoffs, fewer mistakes,
              more covers without adding headcount.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
