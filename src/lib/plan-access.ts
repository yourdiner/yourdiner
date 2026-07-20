import { prisma } from "@/lib/db";
import {
  moduleHasFeature,
  getModuleUpgradeLabel,
} from "@/lib/subscription/feature-registry";
import { getRestaurantFeatureCodes } from "@/lib/permissions";

export { getModuleUpgradeLabel };

export async function getRestaurantEnabledFeatures(
  restaurantId: string
): Promise<Set<string>> {
  return getRestaurantFeatureCodes(restaurantId);
}

export async function restaurantHasModuleAccess(
  restaurantId: string,
  module: string
): Promise<boolean> {
  const codes = await getRestaurantFeatureCodes(restaurantId);
  return moduleHasFeature(codes, module);
}

export async function getRestaurantPlanSlug(restaurantId: string): Promise<string> {
  const subscription = await prisma.subscription.findUnique({
    where: { restaurantId },
    include: { plan: true },
  });
  return subscription?.plan.slug || "starter";
}

export async function restaurantHasFeature(
  restaurantId: string,
  featureCode: string
): Promise<boolean> {
  const codes = await getRestaurantFeatureCodes(restaurantId);
  return codes.has(featureCode);
}
