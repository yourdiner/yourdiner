"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import type { LandingPlan } from "@/features/marketing/landing-types";
import { formatLandingPrice } from "@/features/marketing/landing-plan-mapper";
import { DINER } from "@/features/marketing/diner-landing-tokens";
import { LANDING_LOGOS, type LandingLogo } from "@/features/marketing/landing-logos";
import { cn } from "@/lib/utils";
import "@/features/marketing/diner-landing.css";

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className}`} aria-hidden>
      {name}
    </span>
  );
}

function Reveal({
  children,
  className = "",
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("diner-reveal", className)}
      style={delayMs ? { transitionDelay: `${delayMs}ms` } : undefined}
    >
      {children}
    </div>
  );
}

function LogoChip({ logo }: { logo: LandingLogo }) {
  return (
    <div className="flex h-14 w-36 shrink-0 items-center justify-center rounded-xl border border-[color:var(--diner-outline)]/60 bg-white px-4 sm:h-16 sm:w-44">
      {logo.src ? (
        <Image
          src={logo.src}
          alt={logo.name}
          width={140}
          height={40}
          className="max-h-8 w-auto object-contain opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0 sm:max-h-10"
        />
      ) : (
        <span className="truncate text-sm font-bold tracking-tight text-[color:var(--diner-on-surface-variant)]/70 sm:text-base">
          {logo.name}
        </span>
      )}
    </div>
  );
}

function LogoMarquee() {
  const logos = LANDING_LOGOS.length > 0 ? LANDING_LOGOS : [{ id: "placeholder", name: "Your logo here" }];
  const loop = [...logos, ...logos];

  return (
    <section className="border-y border-[color:var(--diner-outline)]/30 bg-white py-8 sm:py-10">
      <p className="mb-5 px-4 text-center text-xs font-bold uppercase tracking-widest text-[color:var(--diner-on-surface-variant)] sm:mb-6">
        Trusted by restaurants
      </p>
      <div className="diner-marquee">
        <div className="diner-marquee-track px-4" aria-hidden={false}>
          {loop.map((logo, i) => (
            <LogoChip key={`${logo.id}-${i}`} logo={logo} />
          ))}
        </div>
      </div>
    </section>
  );
}

const SYSTEM_FEATURES = [
  {
    icon: "qr_code_2",
    title: "QR Digital Menu",
    body: "Share a branded public menu guests can browse on any phone — no app install required.",
    span: "lg:col-span-7",
    visual: "menu" as const,
  },
  {
    icon: "smartphone",
    title: "Customer QR Ordering",
    body: "Table QR lets guests identify themselves, place orders, and request the bill from their seat.",
    span: "lg:col-span-5",
    visual: null,
  },
  {
    icon: "room_service",
    title: "Waiter Ordering",
    body: "Staff take tableside orders on the floor POS with variants, modifiers, and send-to-kitchen.",
    span: "lg:col-span-4",
    visual: null,
  },
  {
    icon: "skillet",
    title: "Kitchen Display",
    body: "Live tickets stream to the kitchen with status updates from queued to ready to serve.",
    span: "lg:col-span-4",
    visual: null,
  },
  {
    icon: "event_seat",
    title: "Reservations",
    body: "Book tables, manage conflicts, and seat guests without double-booking the floor.",
    span: "lg:col-span-4",
    visual: null,
  },
  {
    icon: "takeout_dining",
    title: "Takeaway & Delivery",
    body: "Run fulfillment orders alongside dine-in — same menu, kitchen, and billing engine.",
    span: "lg:col-span-5",
    visual: null,
  },
  {
    icon: "analytics",
    title: "Analytics",
    body: "Track sales, covers, and performance so you know what is moving and when.",
    span: "lg:col-span-7",
    visual: "chart" as const,
    dark: true,
  },
] as const;

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
      <div className="relative z-10 overflow-hidden rounded-2xl border border-[color:var(--diner-outline)]/30 shadow-2xl">
        <div className="aspect-[16/11] bg-gradient-to-br from-slate-900 via-slate-800 to-[#0b1c30] p-4 sm:p-5 md:p-6">
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                Live floor
              </p>
              <p className="text-sm font-semibold text-white">Dinner service</p>
            </div>
            <span className="rounded-full bg-[color:var(--diner-primary)]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[color:var(--diner-primary)] sm:px-3">
              Live
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2 sm:gap-2.5 md:gap-3">
            {[
              { n: "01", live: "ok" },
              { n: "02", live: "busy" },
              { n: "03", live: "" },
              { n: "04", live: "" },
              { n: "05", live: "" },
              { n: "06", live: "ok" },
              { n: "07", live: "" },
              { n: "08", live: "" },
            ].map((t) => (
              <div
                key={t.n}
                className={`flex aspect-square items-center justify-center rounded-lg border-2 text-xs font-bold sm:rounded-xl sm:text-sm ${
                  t.live === "ok"
                    ? "border-[color:var(--diner-tertiary)] bg-[color:var(--diner-tertiary)]/20 text-[color:var(--diner-tertiary)]"
                    : t.live === "busy"
                      ? "border-[color:var(--diner-primary)] bg-[color:var(--diner-primary)]/20 text-[color:var(--diner-primary)]"
                      : "border-white/10 bg-white/5 text-white/20"
                }`}
              >
                {t.live ? t.n : ""}
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:mt-5 sm:gap-2">
            {[
              { label: "Covers", value: "86" },
              { label: "Open checks", value: "24" },
              { label: "Avg ticket", value: "₹840" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg bg-white/5 p-2 sm:p-2.5">
                <p className="text-[8px] uppercase tracking-wider text-white/40 sm:text-[9px]">
                  {kpi.label}
                </p>
                <p className="text-base font-bold text-white sm:text-lg">{kpi.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="diner-glass diner-float absolute -right-2 -top-6 z-20 hidden w-44 rounded-2xl p-3 sm:block sm:-right-4 sm:-top-8 sm:w-52 md:-right-6 lg:-right-8 lg:w-56 lg:p-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="rounded-lg bg-[color:var(--diner-tertiary)]/10 p-1.5 sm:p-2">
            <Icon name="trending_up" className="text-base text-[color:var(--diner-tertiary)]" />
          </div>
          <span className="text-[10px] font-bold uppercase text-[color:var(--diner-on-surface-variant)]">
            Daily revenue
          </span>
        </div>
        <div className="text-xl font-bold text-[color:var(--diner-on-surface)] sm:text-2xl">
          ₹1,42,500
        </div>
        <div className="mt-1 text-[10px] font-bold text-[color:var(--diner-tertiary)]">
          +12.5% from yesterday
        </div>
      </div>

      <div className="diner-glass diner-float diner-float-delay-1 absolute left-0 top-1/2 z-20 hidden w-40 -translate-y-1/2 rounded-2xl p-3 lg:block lg:w-48 lg:-translate-x-10 lg:p-4 xl:-translate-x-14">
        <div className="mb-2 flex items-center gap-2">
          <div className="rounded-lg bg-[color:var(--diner-primary)]/10 p-2">
            <Icon name="table_restaurant" className="text-base text-[color:var(--diner-primary)]" />
          </div>
          <span className="text-[10px] font-bold uppercase text-[color:var(--diner-on-surface-variant)]">
            Active tables
          </span>
        </div>
        <div className="text-2xl font-bold text-[color:var(--diner-on-surface)]">
          24 <span className="text-sm font-normal text-[color:var(--diner-on-surface-variant)]">/ 32</span>
        </div>
      </div>

      <div className="diner-glass diner-float diner-float-delay-2 absolute -bottom-4 right-0 z-20 hidden w-52 rounded-2xl p-3 sm:block sm:-bottom-6 sm:right-4 sm:w-56 sm:p-4 md:right-8 md:w-64">
        <div className="mb-2 flex items-center gap-2 sm:mb-3">
          <div className="rounded-lg bg-blue-500/10 p-2">
            <Icon name="outdoor_grill" className="text-base text-blue-500" />
          </div>
          <span className="text-[10px] font-bold uppercase text-[color:var(--diner-on-surface-variant)]">
            Kitchen queue
          </span>
        </div>
        <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-[color:var(--diner-surface-container)]">
          <div className="h-full w-3/4 bg-[color:var(--diner-primary)]" />
        </div>
        <div className="flex justify-between text-xs font-medium text-[color:var(--diner-on-surface)]">
          <span>12 orders pending</span>
          <span>Avg 14m</span>
        </div>
      </div>
    </div>
  );
}

function DashboardMock({ dark = false }: { dark?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border shadow-2xl ${
        dark
          ? "border-white/10 bg-slate-900"
          : "border-[color:var(--diner-outline)] bg-white"
      }`}
    >
      <div
        className={`flex items-center gap-2 border-b px-3 py-2.5 sm:px-4 sm:py-3 ${
          dark ? "border-white/10" : "border-[color:var(--diner-outline)]"
        }`}
      >
        <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span
          className={`ml-2 text-xs font-medium ${
            dark ? "text-white/40" : "text-[color:var(--diner-on-surface-variant)]"
          }`}
        >
          Admin dashboard
        </span>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-4">
        {[
          { label: "Today", value: "₹84,200", tone: DINER.primary },
          { label: "Covers", value: "312", tone: DINER.tertiary },
          { label: "Open tables", value: "18", tone: "#3b82f6" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={`rounded-xl p-2.5 sm:p-3 ${dark ? "bg-white/5" : "bg-[color:var(--diner-surface-container-low)]"}`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-wider ${
                dark ? "text-white/40" : "text-[color:var(--diner-on-surface-variant)]"
              }`}
            >
              {kpi.label}
            </p>
            <p className="mt-1 text-lg font-bold sm:text-xl" style={{ color: dark ? "#fff" : kpi.tone }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>
      <div className="flex items-end gap-1 px-3 pb-4 sm:gap-1.5 sm:px-4 sm:pb-5">
        {[40, 55, 35, 70, 60, 85, 75, 90, 65, 80, 95, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-[color:var(--diner-primary)]/70"
            style={{ height: `${h * 0.65}px`, opacity: 0.4 + (i % 5) * 0.12 }}
          />
        ))}
      </div>
    </div>
  );
}

interface DinerLandingProps {
  brandName: string;
  plans: LandingPlan[];
}

export function DinerLanding({ brandName, plans }: DinerLandingProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const displayPlans = plans.slice(0, 3);
  while (displayPlans.length < 3) {
    displayPlans.push({
      id: `placeholder-${displayPlans.length}`,
      name: displayPlans.length === 2 ? "Global" : "Growth",
      description: null,
      highlighted: false,
      priceMonthly: 0,
      priceYearly: 0,
      currency: "INR",
      features: ["Contact sales for details"],
      trialDays: 14,
    });
  }

  const year = new Date().getFullYear();

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="diner-landing overflow-x-hidden scroll-smooth bg-[color:var(--diner-surface)] font-[family-name:var(--font-jakarta)] text-[color:var(--diner-on-surface)] antialiased selection:bg-[color:var(--diner-primary)]/20">
      <header className="fixed top-0 z-50 w-full border-b border-[color:var(--diner-outline)]/50 bg-[color:var(--diner-surface)]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-3 px-4 sm:h-20 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="truncate font-[family-name:var(--font-jakarta)] text-xl font-bold tracking-tight text-[color:var(--diner-on-surface)] sm:text-2xl"
          >
            {brandName}
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {[
              { href: "#product", label: "Product" },
              { href: "#features", label: "Features" },
              { href: "#pricing", label: "Pricing" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm font-medium text-[color:var(--diner-on-surface-variant)] transition-colors hover:text-[color:var(--diner-primary)]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:gap-4 md:flex">
            <Link
              href="/login"
              className="px-3 py-2 text-sm font-medium transition-colors hover:text-[color:var(--diner-primary)]"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-[color:var(--diner-primary)] px-4 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-[color:var(--diner-primary)]/20 sm:px-6"
            >
              Start Free Trial
            </Link>
          </div>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[color:var(--diner-outline)] bg-white md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <Icon name={mobileOpen ? "close" : "menu"} className="text-xl" />
          </button>
        </div>

        {mobileOpen && (
          <div className="border-t border-[color:var(--diner-outline)]/50 bg-[color:var(--diner-surface)] px-4 pb-6 pt-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {[
                { href: "#product", label: "Product" },
                { href: "#features", label: "Features" },
                { href: "#pricing", label: "Pricing" },
              ].map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-semibold text-[color:var(--diner-on-surface)]"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg border border-[color:var(--diner-outline)] py-3 text-center text-sm font-semibold"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg bg-[color:var(--diner-primary)] py-3 text-center text-sm font-semibold text-white"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="pt-16 sm:pt-20">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1280px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal className="is-visible">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[color:var(--diner-primary)]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[color:var(--diner-primary)] sm:mb-4 sm:px-4 sm:text-xs">
                The Operating System for Dining
              </div>
              <h1 className="mb-4 font-[family-name:var(--font-jakarta)] text-4xl font-bold leading-[1.1] tracking-tight sm:mb-6 sm:text-5xl lg:text-7xl">
                Scale your flavor with{" "}
                <span className="text-[color:var(--diner-primary)]">precision.</span>
              </h1>
              <p className="mb-8 max-w-lg text-base leading-relaxed text-[color:var(--diner-on-surface-variant)] sm:mb-10 sm:text-xl">
                One platform to rule your floor, kitchen, and finances. Built for the world&apos;s
                most ambitious restaurants.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[color:var(--diner-primary)] px-6 py-3.5 font-semibold text-white transition-all hover:shadow-2xl hover:shadow-[color:var(--diner-primary)]/30 sm:px-8 sm:py-4"
                >
                  Get Started <Icon name="arrow_forward" className="text-base" />
                </Link>
                <a
                  href="#product"
                  className="flex items-center justify-center gap-2 rounded-xl border border-[color:var(--diner-outline)] bg-white px-6 py-3.5 font-semibold text-[color:var(--diner-on-surface)] transition-all hover:bg-[color:var(--diner-surface-container-low)] sm:px-8 sm:py-4"
                >
                  <Icon name="play_circle" className="text-base" /> Watch Live Demo
                </a>
              </div>
            </Reveal>
            <Reveal className="is-visible" delayMs={200}>
              <HeroVisual />
            </Reveal>
          </div>
        </section>

        {/* Logo marquee — re-enable when partner logos are ready */}
        {false && <LogoMarquee />}

        {/* Product */}
        <section id="product" className="space-y-16 px-4 py-16 sm:space-y-20 sm:px-6 sm:py-20 lg:space-y-28 lg:px-8 lg:py-28">
          <div className="mx-auto grid max-w-[1280px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal>
              <h2 className="mb-4 font-[family-name:var(--font-jakarta)] text-3xl font-bold sm:mb-6 sm:text-4xl">
                Unified Command Center
              </h2>
              <p className="mb-8 text-base leading-relaxed text-[color:var(--diner-on-surface-variant)] sm:mb-10 sm:text-lg">
                Run tables, kitchen, waiters, and billing from one admin dashboard — live sessions,
                analytics, and menu control in a single place.
              </p>
              <div className="mb-8 space-y-3 sm:mb-10 sm:space-y-4">
                {[
                  "Live floor & session overview",
                  "Menu, categories, and QR codes",
                  "Sales analytics and reports",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-[color:var(--diner-primary)]/10 p-1">
                      <Icon name="check" className="text-sm text-[color:var(--diner-primary)]" />
                    </div>
                    <p className="font-medium">{item}</p>
                  </div>
                ))}
              </div>
              <a
                href="#features"
                className="inline-flex items-center gap-2 font-bold text-[color:var(--diner-primary)] hover:underline"
              >
                Explore features <Icon name="chevron_right" />
              </a>
            </Reveal>
            <Reveal>
              <DashboardMock />
            </Reveal>
          </div>

          <div className="mx-auto grid max-w-[1280px] items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <Reveal className="lg:order-2">
              <h2 className="mb-4 font-[family-name:var(--font-jakarta)] text-3xl font-bold sm:mb-6 sm:text-4xl">
                Precision Floor Management
              </h2>
              <p className="mb-8 text-base leading-relaxed text-[color:var(--diner-on-surface-variant)] sm:mb-10 sm:text-lg">
                Seat guests, assign waiters, and track every table status. Orders sync straight to
                the kitchen display.
              </p>
              <div className="mb-8 space-y-3 sm:mb-10 sm:space-y-4">
                {[
                  "Table map with live status",
                  "Waiter assignment & floor POS",
                  "Send to kitchen in one tap",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="mt-1 rounded-full bg-[color:var(--diner-primary)]/10 p-1">
                      <Icon name="check" className="text-sm text-[color:var(--diner-primary)]" />
                    </div>
                    <p className="font-medium">{item}</p>
                  </div>
                ))}
              </div>
              <a
                href="#features"
                className="inline-flex items-center gap-2 font-bold text-[color:var(--diner-primary)] hover:underline"
              >
                See floor features <Icon name="chevron_right" />
              </a>
            </Reveal>
            <Reveal className="lg:order-1">
              <div className="flex aspect-[16/10] items-center justify-center overflow-hidden rounded-2xl bg-slate-900">
                <div className="grid w-full grid-cols-4 gap-2 p-4 sm:gap-3 sm:p-6 md:gap-4 md:p-8">
                  {["ok", "busy", "", "", "", "ok", "", ""].map((state, i) => (
                    <div
                      key={i}
                      className={`flex aspect-square items-center justify-center rounded-lg border-2 text-xs font-bold sm:rounded-xl sm:text-sm ${
                        state === "ok"
                          ? "border-[color:var(--diner-tertiary)] bg-[color:var(--diner-tertiary)]/20 text-[color:var(--diner-tertiary)]"
                          : state === "busy"
                            ? "border-[color:var(--diner-primary)] bg-[color:var(--diner-primary)]/20 text-[color:var(--diner-primary)]"
                            : "border-white/10 bg-white/5"
                      }`}
                    >
                      {state ? String(i + 1).padStart(2, "0") : ""}
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Features — system capabilities */}
        <section
          id="features"
          className="bg-[color:var(--diner-surface-container-low)]/50 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28"
        >
          <div className="mx-auto max-w-[1280px]">
            <Reveal className="mx-auto mb-10 max-w-2xl text-center sm:mb-14 lg:mb-16">
              <h2 className="mb-3 font-[family-name:var(--font-jakarta)] text-3xl font-bold sm:mb-4 sm:text-4xl lg:text-5xl">
                Everything your restaurant needs.
              </h2>
              <p className="text-base text-[color:var(--diner-on-surface-variant)] sm:text-lg">
                From QR menus to kitchen tickets, waiters, reservations, and analytics — one
                operating system.
              </p>
            </Reveal>

            <div className="diner-bento">
              {SYSTEM_FEATURES.map((feature) => (
                <Reveal
                  key={feature.title}
                  className={cn(
                    "col-span-1 flex flex-col overflow-hidden rounded-2xl border p-5 shadow-sm transition-all hover:shadow-xl sm:p-6 lg:p-8",
                    feature.span,
                    "dark" in feature && feature.dark
                      ? "border-white/5 bg-[color:var(--diner-inverse)] text-white lg:flex-row lg:items-center lg:gap-8"
                      : "border-[color:var(--diner-outline)]/30 bg-white"
                  )}
                >
                  <div className="flex-1">
                    <Icon
                      name={feature.icon}
                      className="mb-3 text-[color:var(--diner-primary)] sm:mb-4"
                    />
                    <h3
                      className={cn(
                        "mb-2 font-bold",
                        feature.visual === "chart" ? "text-xl sm:text-2xl" : "text-lg sm:text-xl lg:text-2xl"
                      )}
                    >
                      {feature.title}
                    </h3>
                    <p
                      className={cn(
                        "text-sm sm:text-base",
                        "dark" in feature && feature.dark
                          ? "text-[color:var(--diner-surface-dim)]"
                          : "text-[color:var(--diner-on-surface-variant)]"
                      )}
                    >
                      {feature.body}
                    </p>
                  </div>
                  {feature.visual === "menu" && (
                    <div className="-mx-5 mt-6 rounded-t-2xl border-x border-t border-[color:var(--diner-outline)] bg-[color:var(--diner-surface-container-low)] p-4 sm:-mx-6 sm:mt-8 lg:-mx-0 lg:mt-8">
                      <div className="flex gap-3">
                        <div className="h-12 w-12 shrink-0 rounded-lg bg-white shadow-sm" />
                        <div className="flex-1 space-y-2 pt-1">
                          <div className="h-3 w-3/4 rounded bg-[color:var(--diner-primary)]/15 sm:h-4" />
                          <div className="h-3 w-1/2 rounded bg-[color:var(--diner-on-surface)]/5 sm:h-4" />
                        </div>
                      </div>
                    </div>
                  )}
                  {feature.visual === "chart" && (
                    <div className="mt-6 flex h-28 w-full items-end gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 sm:mt-0 sm:h-32 lg:w-48">
                      {[50, 75, 100, 66].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t bg-[color:var(--diner-primary)]"
                          style={{ height: `${h}%`, opacity: 0.4 + i * 0.2 }}
                        />
                      ))}
                    </div>
                  )}
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section className="overflow-hidden bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <Reveal className="mx-auto max-w-[1280px] text-center">
            <h2 className="mb-10 font-[family-name:var(--font-jakarta)] text-3xl font-bold sm:mb-14 sm:text-4xl lg:mb-16">
              From seat to kitchen to bill
            </h2>
            <div className="relative mx-auto grid max-w-5xl grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-10 md:flex md:flex-row md:items-start md:justify-between">
              <div className="absolute left-0 top-10 z-0 hidden h-[2px] w-full bg-[color:var(--diner-outline)]/30 md:block" />
              {[
                {
                  icon: "qr_code_2",
                  stage: "Stage 1",
                  title: "Scan & Seat",
                  body: "Guest checks in via table QR.",
                },
                {
                  icon: "touch_app",
                  stage: "Stage 2",
                  title: "Order",
                  body: "Customer or waiter places the order.",
                },
                {
                  icon: "outdoor_grill",
                  stage: "Stage 3",
                  title: "Kitchen",
                  body: "Tickets hit the kitchen display.",
                },
                {
                  icon: "payments",
                  stage: "Stage 4",
                  title: "Checkout",
                  body: "Generate bill and close the session.",
                },
              ].map((step) => (
                <div
                  key={step.stage}
                  className="relative z-10 flex flex-col items-center md:flex-1"
                >
                  <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--diner-outline)] bg-white shadow-xl sm:mb-4 sm:h-20 sm:w-20">
                    <Icon name={step.icon} className="text-2xl text-[color:var(--diner-primary)] sm:text-3xl" />
                  </div>
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-[color:var(--diner-tertiary)] sm:text-xs">
                    {step.stage}
                  </div>
                  <h4 className="mb-1 font-bold">{step.title}</h4>
                  <p className="max-w-[200px] px-2 text-sm text-[color:var(--diner-on-surface-variant)]">
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Dark dashboard */}
        <section className="overflow-hidden bg-[color:var(--diner-inverse)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1280px]">
            <div className="grid items-center gap-10 lg:grid-cols-5 lg:gap-16">
              <Reveal className="lg:col-span-2">
                <h2 className="mb-4 font-[family-name:var(--font-jakarta)] text-3xl font-bold leading-tight text-white sm:mb-6 sm:text-4xl lg:text-5xl">
                  Your business, <br />
                  <span className="text-[color:var(--diner-primary)]">under control.</span>
                </h2>
                <p className="mb-8 text-base leading-relaxed text-[color:var(--diner-surface-dim)] sm:mb-10 sm:text-lg">
                  Monitor live sales, open tables, and kitchen load from the admin dashboard —
                  whether you&apos;re on the floor or off-site.
                </p>
                <div className="flex gap-3 sm:gap-4">
                  <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
                    <div className="mb-1 text-xl font-bold text-[color:var(--diner-primary)] sm:text-2xl">
                      Live
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 sm:text-xs">
                      Floor &amp; kitchen
                    </div>
                  </div>
                  <div className="flex-1 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
                    <div className="mb-1 text-xl font-bold text-[color:var(--diner-primary)] sm:text-2xl">
                      One OS
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-widest text-white/60 sm:text-xs">
                      Menu to bill
                    </div>
                  </div>
                </div>
              </Reveal>
              <Reveal className="relative lg:col-span-3">
                <div className="lg:scale-105 lg:rotate-1">
                  <DashboardMock dark />
                </div>
                <div className="diner-float absolute -top-6 right-0 hidden w-36 rounded-xl bg-white p-3 text-[color:var(--diner-on-surface)] shadow-xl sm:block sm:-top-8 sm:w-40 lg:-top-10">
                  <div className="mb-1 text-[10px] font-bold uppercase tracking-tighter text-[color:var(--diner-on-surface-variant)]">
                    Live Sales
                  </div>
                  <div className="text-lg font-bold sm:text-xl">₹12,405</div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-[color:var(--diner-surface)] px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-[1280px]">
            <Reveal className="mb-10 text-center sm:mb-14 lg:mb-16">
              <h2 className="mb-3 font-[family-name:var(--font-jakarta)] text-3xl font-bold sm:mb-4 sm:text-4xl lg:text-5xl">
                Fair pricing for every scale.
              </h2>
              <p className="text-base text-[color:var(--diner-on-surface-variant)] sm:text-lg">
                Simple billing, no long-term contracts.
              </p>
            </Reveal>

            <div className="grid gap-5 sm:gap-6 md:grid-cols-3 md:items-stretch">
              {displayPlans.map((plan, index) => {
                const highlighted = plan.highlighted || index === 1;
                const priceLabel =
                  plan.priceMonthly > 0
                    ? formatLandingPrice(plan.priceMonthly, plan.currency)
                    : "Custom";
                const features =
                  plan.features.length > 0
                    ? plan.features.slice(0, 6)
                    : ["Full platform access", "Free trial included"];

                return (
                  <Reveal
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col rounded-2xl bg-white p-6 transition-all sm:p-8",
                      highlighted
                        ? "z-10 border-2 border-[color:var(--diner-primary)] shadow-2xl md:scale-[1.03]"
                        : "border border-[color:var(--diner-outline)] shadow-sm hover:shadow-xl"
                    )}
                  >
                    {highlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[color:var(--diner-primary)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white sm:-top-4 sm:px-4">
                        Recommended
                      </div>
                    )}
                    <div
                      className={cn(
                        "mb-3 text-sm font-bold uppercase tracking-widest sm:mb-4",
                        highlighted
                          ? "text-[color:var(--diner-primary)]"
                          : "text-[color:var(--diner-on-surface-variant)]"
                      )}
                    >
                      {plan.name}
                    </div>
                    <div className="mb-5 flex flex-wrap items-baseline gap-1 sm:mb-6">
                      {plan.priceMonthly > 0 ? (
                        <>
                          <span
                            className={cn(
                              "text-4xl font-bold sm:text-5xl",
                              highlighted && "text-[color:var(--diner-primary)]"
                            )}
                          >
                            {priceLabel}
                          </span>
                          <span className="font-medium text-[color:var(--diner-on-surface-variant)]">
                            /mo
                          </span>
                        </>
                      ) : (
                        <span className="text-3xl font-bold sm:text-4xl">{priceLabel}</span>
                      )}
                    </div>
                    <ul className="mb-6 flex-1 space-y-3 sm:mb-8 sm:space-y-4">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Icon
                            name="check_circle"
                            className="mt-0.5 shrink-0 text-base text-[color:var(--diner-primary)]"
                          />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/register"
                      className={cn(
                        "block w-full rounded-xl py-3.5 text-center font-bold transition-all sm:py-4",
                        highlighted
                          ? "bg-[color:var(--diner-primary)] text-white hover:shadow-xl hover:shadow-[color:var(--diner-primary)]/30"
                          : "border border-[color:var(--diner-outline)] hover:bg-[color:var(--diner-surface-container)]"
                      )}
                    >
                      {plan.priceMonthly > 0 ? "Select Plan" : "Contact Sales"}
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <div className="relative mx-auto max-w-[1280px] overflow-hidden rounded-2xl bg-[color:var(--diner-inverse)] px-5 py-12 text-center sm:rounded-3xl sm:px-10 sm:py-16 md:px-16 md:py-24">
            <div
              className="pointer-events-none absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <Reveal className="relative z-10">
              <h2 className="mb-4 font-[family-name:var(--font-jakarta)] text-3xl font-bold leading-tight text-white sm:mb-6 sm:text-4xl lg:text-6xl">
                The future of hospitality <br className="hidden sm:block" />
                is built on {brandName}.
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-base text-[color:var(--diner-surface-dim)] sm:mb-12 sm:text-lg">
                Join restaurants running a unified operating system — menu, floor, kitchen, and
                billing together.
              </p>
              <div className="flex flex-col justify-center gap-3 sm:flex-row sm:gap-4">
                <Link
                  href="/register"
                  className="rounded-xl bg-[color:var(--diner-primary)] px-8 py-3.5 font-bold text-white transition-all hover:shadow-2xl hover:shadow-[color:var(--diner-primary)]/40 active:scale-95 sm:px-12 sm:py-4"
                >
                  Start Your Free Trial
                </Link>
                <Link
                  href="/login"
                  className="rounded-xl border border-white/20 bg-white/10 px-8 py-3.5 font-bold text-white transition-all hover:bg-white/20 active:scale-95 sm:px-12 sm:py-4"
                >
                  Sign in
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--diner-outline)] bg-white px-4 pb-10 pt-14 sm:px-6 sm:pb-12 sm:pt-20 lg:px-8">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-10 grid grid-cols-2 gap-8 sm:mb-12 sm:gap-10 md:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2">
              <Link
                href="/"
                className="mb-4 block font-[family-name:var(--font-jakarta)] text-xl font-bold text-[color:var(--diner-on-surface)] sm:mb-6 sm:text-2xl"
              >
                {brandName}
              </Link>
              <p className="mb-6 max-w-xs text-sm text-[color:var(--diner-on-surface-variant)] sm:mb-8 sm:text-base">
                Precision-engineered software for modern hospitality businesses.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-bold sm:mb-6">Platform</h4>
              <ul className="space-y-3 text-sm text-[color:var(--diner-on-surface-variant)] sm:space-y-4">
                <li>
                  <a className="hover:text-[color:var(--diner-primary)]" href="#product">
                    Admin Dashboard
                  </a>
                </li>
                <li>
                  <a className="hover:text-[color:var(--diner-primary)]" href="#features">
                    Kitchen Display
                  </a>
                </li>
                <li>
                  <a className="hover:text-[color:var(--diner-primary)]" href="#features">
                    Waiter App
                  </a>
                </li>
                <li>
                  <a className="hover:text-[color:var(--diner-primary)]" href="#features">
                    QR Ordering
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold sm:mb-6">Resources</h4>
              <ul className="space-y-3 text-sm text-[color:var(--diner-on-surface-variant)] sm:space-y-4">
                <li>
                  <Link className="hover:text-[color:var(--diner-primary)]" href="/register">
                    Get started
                  </Link>
                </li>
                <li>
                  <a className="hover:text-[color:var(--diner-primary)]" href="#pricing">
                    Pricing
                  </a>
                </li>
                <li>
                  <Link className="hover:text-[color:var(--diner-primary)]" href="/login">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
            <div className="col-span-2 md:col-span-1">
              <h4 className="mb-4 font-bold sm:mb-6">Company</h4>
              <ul className="space-y-3 text-sm text-[color:var(--diner-on-surface-variant)] sm:space-y-4">
                <li>
                  <a className="hover:text-[color:var(--diner-primary)]" href="#product">
                    About
                  </a>
                </li>
                <li>
                  <a className="hover:text-[color:var(--diner-primary)]" href="#pricing">
                    Privacy
                  </a>
                </li>
                <li>
                  <a className="hover:text-[color:var(--diner-primary)]" href="#pricing">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-4 border-t border-[color:var(--diner-outline)] pt-6 sm:gap-6 sm:pt-8 md:flex-row">
            <p className="text-xs text-[color:var(--diner-on-surface-variant)]">
              © {year} {brandName}. All rights reserved.
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-[color:var(--diner-on-surface-variant)] sm:gap-8">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
              <span>Security</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
