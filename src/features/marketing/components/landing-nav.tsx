"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { menuItem } from "@/features/marketing/motion";
import { PrimaryCta } from "./landing-ui";

const NAV_LINKS = [
  { href: "#story", label: "Story" },
  { href: "#floor", label: "Floor" },
  { href: "#product", label: "Product" },
  { href: "#flow", label: "Flow" },
  { href: "#plans", label: "Plans" },
];

interface LandingNavProps {
  brandName: string;
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <span className="relative block h-3.5 w-4">
      <span
        className={cn(
          "absolute left-0 h-[1.5px] w-4 rounded-full bg-zinc-100 transition-[transform,top] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          open ? "top-[6px] rotate-45" : "top-0"
        )}
      />
      <span
        className={cn(
          "absolute left-0 top-[6px] h-[1.5px] w-4 rounded-full bg-zinc-100 transition-opacity duration-150 ease-out",
          open ? "opacity-0" : "opacity-100"
        )}
      />
      <span
        className={cn(
          "absolute left-0 h-[1.5px] w-4 rounded-full bg-zinc-100 transition-[transform,top] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          open ? "top-[6px] -rotate-45" : "top-3"
        )}
      />
    </span>
  );
}

export function LandingNav({ brandName }: LandingNavProps) {
  const [elevated, setElevated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setElevated(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-1px 0px 0px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <div ref={sentinelRef} className="absolute top-0 h-px w-full" aria-hidden />

      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 pt-3 sm:pt-5">
        <div
          className={cn(
            "pointer-events-auto mx-auto flex w-[calc(100%-1.5rem)] max-w-5xl items-center justify-between gap-3 rounded-full px-2.5 py-1.5 sm:w-[calc(100%-2rem)] sm:gap-4 sm:px-4 sm:py-2.5",
            "ring-1 transition-[background-color,box-shadow,ring-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
            elevated
              ? "bg-zinc-950/85 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.55)] ring-white/[0.1] backdrop-blur-xl"
              : "bg-zinc-950/50 ring-white/[0.08] backdrop-blur-md"
          )}
        >
          <Link href="/" className="flex min-w-0 items-center gap-2 pl-0.5 sm:gap-2.5 sm:pl-1">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-zinc-950">
              <span className="text-xs font-bold">{brandName.charAt(0)}</span>
            </span>
            <span className="truncate text-sm font-semibold tracking-tight text-zinc-100">
              {brandName}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-3.5 py-2 text-[13px] font-medium text-zinc-400 transition-colors duration-150 ease-out hover:text-zinc-100"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/login"
              className="rounded-full px-3.5 py-2 text-[13px] font-medium text-zinc-400 transition-colors duration-150 ease-out hover:text-zinc-100"
            >
              Login
            </Link>
            <PrimaryCta href="/register" className="!w-auto !py-2 !pl-4 !pr-1.5 !text-[13px]">
              Start Free Trial
            </PrimaryCta>
          </div>

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/[0.1] transition-transform duration-150 ease-out active:scale-[0.97] lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <HamburgerIcon open={mobileOpen} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: reduceMotion ? 1 : 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="fixed inset-0 z-50 bg-zinc-950/96 backdrop-blur-2xl lg:hidden"
          >
            <div className="flex h-full flex-col px-5 pb-8 pt-20 sm:px-6">
              <button
                type="button"
                className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/[0.1] active:scale-[0.97]"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <HamburgerIcon open />
              </button>

              <nav className="flex flex-1 flex-col justify-center gap-1">
                {NAV_LINKS.map((link, i) => (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    custom={i}
                    variants={menuItem}
                    initial="hidden"
                    animate="show"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-1 py-2.5 text-3xl font-semibold tracking-tight text-zinc-100 transition-colors duration-150 ease-out hover:text-sky-400"
                  >
                    {link.label}
                  </motion.a>
                ))}
              </nav>
              <div className="flex flex-col gap-3">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full py-3 text-center text-sm font-semibold text-zinc-300 ring-1 ring-white/[0.12] transition-transform duration-150 ease-out active:scale-[0.97]"
                >
                  Login
                </Link>
                <PrimaryCta
                  href="/register"
                  className="w-full justify-center"
                  onClick={() => setMobileOpen(false)}
                >
                  Start Free Trial
                </PrimaryCta>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
