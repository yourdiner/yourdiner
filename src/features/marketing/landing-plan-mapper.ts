import type { LandingPlan } from "./landing-types";

type VisiblePlan = Awaited<
  ReturnType<typeof import("@/modules/subscription-engine/services/subscription.service").getVisiblePlans>
>[number];

const STATIC_FALLBACK_PLANS: LandingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Everything you need to go digital at one outlet.",
    highlighted: false,
    priceMonthly: 99900,
    priceYearly: 999900,
    currency: "INR",
    trialDays: 14,
    features: [
      "QR digital menu",
      "Staff ordering",
      "Table management",
      "Basic billing",
      "Kitchen display",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    description: "For busy restaurants that want faster service and insights.",
    highlighted: true,
    priceMonthly: 299900,
    priceYearly: 2999900,
    currency: "INR",
    trialDays: 14,
    features: [
      "Everything in Starter",
      "Customer QR ordering",
      "Reservations",
      "Analytics dashboard",
      "Customer database",
      "Takeaway & delivery",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    description: "Multi-outlet operators who need full control at scale.",
    highlighted: false,
    priceMonthly: 499900,
    priceYearly: 4999900,
    currency: "INR",
    trialDays: 14,
    features: [
      "Everything in Professional",
      "Multi-restaurant",
      "Memberships & loyalty",
      "Priority support",
      "Advanced reporting",
    ],
  },
];

export function mapPlansForLanding(rawPlans: VisiblePlan[]): LandingPlan[] {
  if (rawPlans.length === 0) return STATIC_FALLBACK_PLANS;

  const mapped = rawPlans.map((plan, index) => {
    const version = plan.latestVersion;
    const pricing = version?.pricing;
    const features =
      version?.features.map((f) => f.name).filter(Boolean) ?? [];

    const middleIndex = Math.floor(rawPlans.length / 2);

    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      highlighted:
        plan.name.toLowerCase().includes("professional") ||
        index === middleIndex,
      priceMonthly: pricing?.priceMonthly ?? 0,
      priceYearly: pricing?.priceYearly ?? 0,
      currency: pricing?.currency ?? "INR",
      features:
        features.length > 0
          ? features.slice(0, 8)
          : ["Full platform access", "Free trial included"],
      trialDays: version?.trialDays ?? 14,
    } satisfies LandingPlan;
  });

  const hasHighlight = mapped.some((p) => p.highlighted);
  if (!hasHighlight && mapped.length >= 2) {
    mapped[1] = { ...mapped[1], highlighted: true };
  }

  return mapped;
}

export function formatLandingPrice(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
}
