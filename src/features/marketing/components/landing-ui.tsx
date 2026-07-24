"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANDING } from "@/features/marketing/landing-tokens";

export const ICON_STROKE = 1.5;

export function LandingGrain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

export function BezelCard({
  children,
  className,
  innerClassName,
  dark,
}: {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.25rem] p-1 ring-1",
        dark
          ? "bg-[#0f3d36]/[0.06] ring-[#0f3d36]/[0.12]"
          : "bg-[#14201c]/[0.03] ring-[#14201c]/[0.06]",
        className
      )}
    >
      <div
        className={cn(
          "h-full rounded-[calc(1.25rem-0.25rem)]",
          dark
            ? "bg-[#0f3d36] shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]"
            : "bg-white shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function PrimaryCta({
  href,
  children,
  className,
  onClick,
  inverted,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  inverted?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group inline-flex w-full items-center justify-center gap-2.5 rounded-full py-3 pl-5 pr-2 text-sm font-semibold sm:w-auto sm:justify-start sm:pl-6",
        "transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "active:scale-[0.97] motion-reduce:transition-none",
        inverted
          ? "bg-white text-[#0f3d36] shadow-[0_8px_28px_-8px_rgba(15,61,54,0.35)] hover:bg-[#ecf4f1]"
          : "bg-[#0f766e] text-white shadow-[0_8px_28px_-8px_rgba(15,118,110,0.45)] hover:bg-[#0d9488]",
        className
      )}
    >
      <span>{children}</span>
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          "group-hover:translate-x-0.5 group-hover:-translate-y-px",
          "motion-reduce:group-hover:translate-x-0 motion-reduce:group-hover:translate-y-0",
          inverted ? "bg-[#0f3d36]/[0.08]" : "bg-white/15"
        )}
      >
        <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
      </span>
    </Link>
  );
}

export function SecondaryCta({
  href,
  children,
  className,
  onClick,
  dark,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  dark?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-sm font-semibold sm:w-auto",
        "ring-1 transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
        "active:scale-[0.97] motion-reduce:transition-none",
        dark
          ? "bg-white/10 text-[#ecf4f1] ring-white/20 hover:bg-white/15"
          : "bg-white text-[#14201c] ring-[#14201c]/[0.1] hover:bg-[#eef2ef]",
        className
      )}
    >
      {children}
    </Link>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f766e]">
      {children}
    </span>
  );
}

export function SectionTitle({
  children,
  className,
  light,
}: {
  children: React.ReactNode;
  className?: string;
  light?: boolean;
}) {
  return (
    <h2
      className={cn(
        "text-[1.75rem] font-semibold leading-[1.15] tracking-tight sm:text-4xl lg:text-5xl lg:leading-[1.05]",
        light ? "text-[#ecf4f1]" : "text-[#14201c]",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function SectionShell({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn(LANDING.space.sectionY, className)}>
      <div className={cn("mx-auto max-w-7xl", LANDING.space.sectionX)}>{children}</div>
    </section>
  );
}

export { LANDING };
