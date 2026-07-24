"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import type { LandingPlan } from "@/features/marketing/landing-types";
import { formatLandingPrice } from "@/features/marketing/landing-plan-mapper";
import { BezelCard, ICON_STROKE, PrimaryCta, SectionLabel, SectionTitle } from "./landing-ui";
import { cn } from "@/lib/utils";

interface PricingPremiumSectionProps {
  plans: LandingPlan[];
}

export function PricingPremiumSection({ plans }: PricingPremiumSectionProps) {
  const [yearly, setYearly] = useState(false);
  const reduce = useReducedMotion();

  return (
    <section
      id="plans"
      className="relative overflow-x-hidden bg-[#f7f8f6] py-16 text-[#14201c] sm:py-24 lg:py-32"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(15,118,110,0.1),transparent_60%)]"
      />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <div className="max-w-xl">
            <SectionLabel>Plans</SectionLabel>
            <SectionTitle className="mt-3 sm:mt-4">
              Scale with your service, not your stress.
            </SectionTitle>
          </div>

          <div className="flex w-full items-center gap-1 rounded-full bg-white p-1 ring-1 ring-[#14201c]/[0.08] sm:w-auto">
            <button
              type="button"
              onClick={() => setYearly(false)}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:flex-none",
                !yearly ? "bg-[#0f766e] text-white" : "text-[#5c6b64]"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setYearly(true)}
              className={cn(
                "flex-1 rounded-full px-4 py-2 text-sm font-medium transition-[background-color,transform] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] sm:flex-none",
                yearly ? "bg-[#0f766e] text-white" : "text-[#5c6b64]"
              )}
            >
              Yearly
            </button>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:mt-14 sm:gap-6 lg:grid-cols-3">
          {plans.map((plan, i) => {
            const price = yearly ? plan.priceYearly : plan.priceMonthly;
            const isHighlighted = plan.highlighted;

            return (
              <motion.div
                key={plan.id}
                initial={reduce ? false : { opacity: 0, transform: "translateY(16px)" }}
                whileInView={{ opacity: 1, transform: "translateY(0px)" }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06, duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                className={isHighlighted ? "lg:-mt-3 lg:mb-3" : ""}
              >
                <BezelCard
                  className={isHighlighted ? "ring-[#0f766e]/35" : ""}
                  innerClassName={cn(
                    "flex h-full flex-col p-5 sm:p-8",
                    isHighlighted && "bg-[#0f766e]/[0.06] ring-1 ring-[#0f766e]/20"
                  )}
                >
                  {isHighlighted && (
                    <span className="mb-3 inline-flex w-fit rounded-full bg-[#0f766e]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0f766e] sm:mb-4">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-xl font-semibold tracking-tight text-[#14201c]">{plan.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#5c6b64]">{plan.description}</p>
                  <p className="mt-5 font-mono text-3xl font-semibold tracking-tight text-[#14201c] sm:mt-6 sm:text-4xl">
                    {formatLandingPrice(price, plan.currency)}
                    <span className="text-base font-normal text-[#7a8a82]">
                      /{yearly ? "yr" : "mo"}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-[#7a8a82]">{plan.trialDays}-day free trial included</p>

                  <ul className="mt-6 flex-1 space-y-2.5 sm:mt-8 sm:space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm text-[#5c6b64]">
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-[#0f766e]"
                          strokeWidth={ICON_STROKE}
                        />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <PrimaryCta
                    href="/register"
                    className={cn(
                      "mt-7 w-full justify-center sm:mt-8",
                      !isHighlighted && "!bg-white !text-[#14201c] ring-1 ring-[#14201c]/[0.1] hover:!bg-[#eef2ef] !shadow-none"
                    )}
                  >
                    Start Free Trial
                  </PrimaryCta>
                </BezelCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
