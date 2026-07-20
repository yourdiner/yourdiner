/** Premium SaaS landing tokens — Linear / Vercel tier, zinc + restrained accent */

export const EASE_OUT_STRONG = [0.23, 1, 0.32, 1] as const;
export const EASE_ISLAND = [0.32, 0.72, 0, 1] as const;
export const EASE_IN_OUT = [0.77, 0, 0.175, 1] as const;

export const LANDING = {
  bg: {
    void: "#050508",
    canvas: "#0a0a0f",
    mist: "#f4f4f5",
    paper: "#fafafa",
  },
  text: {
    primary: "#fafafa",
    secondary: "#a1a1aa",
    ink: "#18181b",
    muted: "#71717a",
  },
  /** Soft sky — less “default AI purple”, still readable on dark */
  accent: "#38bdf8",
  accentStrong: "#0ea5e9",
  accentGlow: "rgba(14, 165, 233, 0.28)",
  glass: {
    border: "rgba(255,255,255,0.08)",
    fill: "rgba(255,255,255,0.04)",
    highlight: "rgba(255,255,255,0.12)",
  },
  radius: {
    shell: "1.25rem",
    inner: "calc(1.25rem - 0.25rem)",
    pill: "9999px",
  },
  space: {
    sectionY: "py-16 sm:py-24 lg:py-32",
    sectionX: "px-5 sm:px-6 lg:px-8",
  },
} as const;
