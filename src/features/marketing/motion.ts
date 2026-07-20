import type { Variants } from "framer-motion";
import { EASE_OUT_STRONG, EASE_ISLAND } from "@/features/marketing/landing-tokens";

/** Shared motion presets — transform + opacity only, strong ease-out */
export const EASE_OUT = EASE_OUT_STRONG;

export const fadeUp: Variants = {
  hidden: { opacity: 0, transform: "translateY(24px)" },
  show: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.55, ease: EASE_OUT },
  },
};

/** Editorial reveal — blur resolves on entry (marketing, once) */
export const fadeUpBlur: Variants = {
  hidden: { opacity: 0, transform: "translateY(20px)", filter: "blur(4px)" },
  show: {
    opacity: 1,
    transform: "translateY(0px)",
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: EASE_OUT },
  },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: EASE_OUT } },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const menuItem: Variants = {
  hidden: { opacity: 0, transform: "translateY(24px)" },
  show: (i: number) => ({
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: 0.4, ease: EASE_ISLAND, delay: 0.08 + i * 0.05 },
  }),
};

/** Scroll-reveal — plays once, slightly early */
export const inViewport = { once: true, margin: "-80px" } as const;

/** Reduced-motion friendly fade (no transform) */
export const fadeOnly: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.3, ease: EASE_OUT } },
};
