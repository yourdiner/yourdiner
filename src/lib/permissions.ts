import { StaffRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { getFeatureForModule } from "@/lib/subscription/feature-registry";
import {
  getEffectiveFeatures,
  requireFeature as engineRequireFeature,
  buildSubscriptionState,
  isSubscriptionActive,
} from "@/lib/subscription";

export { isSubscriptionActive, buildSubscriptionState };

export async function getSubscriptionWithPlan(restaurantId: string) {
  const { prisma } = await import("@/lib/db");
  return prisma.subscription.findUnique({
    where: { restaurantId },
    include: {
      plan: true,
      planVersion: {
        include: {
          planFeatures: { include: { feature: true } },
        },
      },
    },
  });
}

function resolveFeatureCode(featureOrModule: string): string {
  return getFeatureForModule(featureOrModule) ?? featureOrModule;
}

export async function getRestaurantFeatureCodes(
  restaurantId: string
): Promise<Set<string>> {
  const { codes } = await getEffectiveFeatures(restaurantId);
  return codes;
}

export async function getRestaurantSubscriptionState(restaurantId: string) {
  const { state } = await getEffectiveFeatures(restaurantId);
  return state;
}

export async function requireWritableSubscription(
  restaurantId: string
): Promise<void> {
  const { state } = await getEffectiveFeatures(restaurantId);
  if (state.isReadOnly) {
    throw new AppError(
      "Your subscription has expired. Renew to continue.",
      "SUBSCRIPTION_SUSPENDED",
      403
    );
  }
}

export async function requirePlanFeature(
  restaurantId: string,
  featureOrModule: string
): Promise<void> {
  await requireWritableSubscription(restaurantId);
  await engineRequireFeature(restaurantId, resolveFeatureCode(featureOrModule));
}

export async function checkPlanFeature(
  restaurantId: string,
  featureOrModule: string
): Promise<boolean> {
  try {
    await requirePlanFeature(restaurantId, featureOrModule);
    return true;
  } catch {
    return false;
  }
}

const ROLE_HIERARCHY: Record<StaffRole, number> = {
  OWNER: 100,
  MANAGER: 80,
  CASHIER: 60,
  STAFF: 40,
  KITCHEN: 30,
  VIEWER: 10,
};

export function hasRole(userRole: StaffRole, requiredRoles: StaffRole[]): boolean {
  return requiredRoles.some(
    (required) => ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required]
  );
}

export function requireStaffRole(role: StaffRole, allowedRoles: StaffRole[]): void {
  if (!hasRole(role, allowedRoles)) {
    throw new AppError("Insufficient permissions", "FORBIDDEN", 403);
  }
}

export const STAFF_WRITE_ROLES: StaffRole[] = [
  StaffRole.OWNER,
  StaffRole.MANAGER,
];

export const STAFF_ORDER_ROLES: StaffRole[] = [
  StaffRole.OWNER,
  StaffRole.MANAGER,
  StaffRole.CASHIER,
  StaffRole.STAFF,
];

export const STAFF_KITCHEN_ROLES: StaffRole[] = [
  StaffRole.OWNER,
  StaffRole.MANAGER,
  StaffRole.KITCHEN,
];
