"use client";

import { motion, useReducedMotion } from "framer-motion";
import { PrimaryCta } from "./landing-ui";

export function TrialFinaleSection() {
  const reduce = useReducedMotion();

  return (
    <section id="trial" className="relative overflow-x-hidden bg-[#0f3d36] py-20 sm:py-28 lg:py-36">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_100%,rgba(15,118,110,0.45),transparent_55%)]"
      />

      <div className="relative mx-auto max-w-5xl px-5 text-center sm:px-6 lg:px-8">
        <motion.h2
          initial={reduce ? false : { opacity: 0, transform: "translateY(20px)" }}
          whileInView={{ opacity: 1, transform: "translateY(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.23, 1, 0.32, 1] }}
          className="text-[2rem] font-semibold tracking-tight text-[#ecf4f1] sm:text-5xl lg:text-6xl lg:leading-[1.05]"
        >
          Start your free trial.
        </motion.h2>
        <motion.p
          initial={reduce ? false : { opacity: 0, transform: "translateY(14px)" }}
          whileInView={{ opacity: 1, transform: "translateY(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: 0.08, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
          className="mx-auto mt-4 max-w-[38ch] text-[15px] leading-relaxed text-[#a8c4bc] sm:mt-6 sm:text-lg"
        >
          Set up your menu, map your floor, and run a real service night before you pay anything.
        </motion.p>
        <motion.div
          initial={reduce ? false : { opacity: 0, transform: "translateY(12px)" }}
          whileInView={{ opacity: 1, transform: "translateY(0px)" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ delay: 0.14, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
          className="mt-8 flex justify-center sm:mt-10"
        >
          <PrimaryCta href="/register" inverted className="sm:text-base">
            Start Free Trial
          </PrimaryCta>
        </motion.div>
        <p className="mt-3 text-sm text-[#7a9e94] sm:mt-4">No credit card required</p>
      </div>
    </section>
  );
}
