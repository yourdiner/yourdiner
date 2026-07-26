import { getPlatformBrand } from "@/lib/platform-brand";
import { getVisiblePlans } from "@/modules/subscription-engine/services/subscription.service";
import { mapPlansForLanding } from "@/features/marketing/landing-plan-mapper";
import { DinerLanding } from "@/features/marketing/components/diner-landing";

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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <DinerLanding brandName={brandName} plans={plans} />
    </>
  );
}
