import { getPlatformBrand } from "@/lib/platform-brand";
import { getVisiblePlans } from "@/modules/subscription-engine/services/subscription.service";
import { mapPlansForLanding } from "@/features/marketing/landing-plan-mapper";
import { LandingNav } from "@/features/marketing/components/landing-nav";
import { HeroDashboard } from "@/features/marketing/components/hero-dashboard";
import { DayInRestaurantSection } from "@/features/marketing/components/day-in-restaurant";
import { InteractiveFloorSection } from "@/features/marketing/components/interactive-floor";
import { ProductShowcaseSection } from "@/features/marketing/components/product-showcase";
import { MoneyPipelineSection } from "@/features/marketing/components/money-pipeline";
import { OrderTimelineSection } from "@/features/marketing/components/order-timeline";
import { PricingPremiumSection } from "@/features/marketing/components/pricing-premium";
import { TrialFinaleSection } from "@/features/marketing/components/trial-finale";
import { LandingFooter } from "@/features/marketing/components/landing-footer";
import { LandingGrain } from "@/features/marketing/components/landing-ui";

function buildJsonLd(brandName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: brandName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      description: "Free trial available",
    },
    description:
      "Restaurant operating system for tables, reservations, kitchen, billing, QR ordering, takeaway, delivery and customer management.",
  };
}

export default async function HomePage() {
  const { brandName } = await getPlatformBrand();

  let plans = mapPlansForLanding([]);
  try {
    const rawPlans = await getVisiblePlans();
    plans = mapPlansForLanding(rawPlans);
  } catch {
    // Use static fallback when DB is unavailable
  }

  const jsonLd = buildJsonLd(brandName);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#050508] font-[family-name:var(--font-jakarta)] antialiased">
      <LandingGrain />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <LandingNav brandName={brandName} />

      <main className="relative z-[2]">
        <HeroDashboard brandName={brandName} />
        <DayInRestaurantSection />
        <InteractiveFloorSection />
        <ProductShowcaseSection />
        <MoneyPipelineSection brandName={brandName} />
        <OrderTimelineSection />
        <PricingPremiumSection plans={plans} />
        <TrialFinaleSection />
      </main>

      <LandingFooter brandName={brandName} />
    </div>
  );
}
