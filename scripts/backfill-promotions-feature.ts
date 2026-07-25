/**
 * Backfill `promotions` onto existing Premium plans so cafes already on Premium
 * unlock Marketing → Promotions without re-subscribing.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PREMIUM_SLUGS = ["premium", "customer_ordering"];

async function main() {
  const feature = await prisma.feature.upsert({
    where: { code: "promotions" },
    create: {
      code: "promotions",
      name: "Promotions",
      category: "marketing",
      sortOrder: 11,
      isActive: true,
    },
    update: { name: "Promotions", isActive: true, category: "marketing" },
  });

  const plans = await prisma.plan.findMany({
    where: {
      OR: [
        { slug: { in: PREMIUM_SLUGS } },
        { name: { equals: "Premium", mode: "insensitive" } },
      ],
    },
  });

  if (plans.length === 0) {
    console.log("No Premium plan rows found. Listing all plans:");
    const all = await prisma.plan.findMany({ select: { id: true, slug: true, name: true } });
    console.log(all);
    return;
  }

  for (const plan of plans) {
    const existing = Array.isArray(plan.features)
      ? (plan.features as unknown[]).filter((c): c is string => typeof c === "string")
      : [];
    const features = existing.includes("promotions")
      ? existing
      : [...existing, "promotions"];

    await prisma.plan.update({
      where: { id: plan.id },
      data: { features },
    });

    const versions = await prisma.planVersion.findMany({
      where: { planId: plan.id },
      select: { id: true, versionNumber: true },
    });

    for (const version of versions) {
      await prisma.planFeature.upsert({
        where: {
          planVersionId_featureId: {
            planVersionId: version.id,
            featureId: feature.id,
          },
        },
        create: {
          planVersionId: version.id,
          featureId: feature.id,
          enabled: true,
        },
        update: { enabled: true },
      });
    }

    console.log(
      `Updated plan ${plan.slug} (${plan.name}): features=${features.length}, versions=${versions.length}`
    );
  }

  const premiumSubs = await prisma.subscription.count({
    where: { planId: { in: plans.map((p) => p.id) } },
  });
  console.log(`Premium subscriptions that should now see promotions: ${premiumSubs}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
