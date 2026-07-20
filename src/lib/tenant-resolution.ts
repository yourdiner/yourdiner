import { CustomDomainStatus } from "@prisma/client";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { isSubscriptionActive } from "@/lib/subscription-status";
import { toTenantHostKey } from "@/lib/tenancy-keys";
import { normalizeHostname } from "@/lib/hostname-utils";
import type { TenantContext } from "@/lib/tenancy-types";

export { toTenantHostKey };

type RestaurantRow = { id: string };

function toTenantContext(
  restaurant: {
    id: string;
    uuid: string;
    subdomain: string;
    slug: string;
    name: string;
    status: import("@prisma/client").RestaurantStatus;
    customDomain: string | null;
    customDomainStatus: CustomDomainStatus;
    subscription: {
      status: import("@prisma/client").SubscriptionStatus;
      gracePeriodEndsAt: Date | null;
      trialEndsAt: Date | null;
    } | null;
  }
): TenantContext {
  const subscriptionActive = restaurant.subscription
    ? isSubscriptionActive(
        restaurant.subscription.status,
        restaurant.subscription.gracePeriodEndsAt,
        restaurant.subscription.trialEndsAt
      )
    : false;

  // Prefer the restaurant's configured subdomain (e.g. olivetree) over the
  // short UUID host key so QR / absolute links match what staff browse on.
  const subdomain = restaurant.subdomain?.trim().toLowerCase();
  const tenantKey =
    subdomain || toTenantHostKey(restaurant.uuid);

  return {
    restaurantId: restaurant.id,
    uuid: restaurant.uuid,
    tenantKey,
    slug: restaurant.slug,
    name: restaurant.name,
    restaurantStatus: restaurant.status,
    subscriptionActive,
    customDomain: restaurant.customDomain,
    customDomainStatus: restaurant.customDomainStatus,
  };
}

/** Only fields needed for TenantContext — avoid loading full Subscription rows. */
const restaurantInclude = {
  subscription: {
    select: {
      status: true,
      gracePeriodEndsAt: true,
      trialEndsAt: true,
    },
  },
} as const;

/** Resolve tenant by subdomain or shortened uuid host key without scanning all restaurants. */
export const resolveTenantByHostLabel = cache(
  async (hostLabel: string): Promise<TenantContext | null> => {
    const normalizedKey = hostLabel.toLowerCase();

    let restaurant = await prisma.restaurant.findFirst({
      where: {
        OR: [{ subdomain: normalizedKey }, { uuid: hostLabel }],
      },
      include: restaurantInclude,
    });

    if (!restaurant) {
      const matches = await prisma.$queryRaw<RestaurantRow[]>`
        SELECT id
        FROM "Restaurant"
        WHERE LOWER(SUBSTRING(REPLACE(uuid::text, '-', ''), 1, 8)) = ${normalizedKey}
        LIMIT 1
      `;

      if (matches[0]) {
        restaurant = await prisma.restaurant.findUnique({
          where: { id: matches[0].id },
          include: restaurantInclude,
        });
      }
    }

    if (!restaurant) return null;
    return toTenantContext(restaurant);
  }
);

/** Resolve tenant by verified custom domain (e.g. homecafe.in). */
export const resolveTenantByCustomDomain = cache(
  async (hostname: string): Promise<TenantContext | null> => {
    const normalized = normalizeHostname(hostname);

    const restaurant = await prisma.restaurant.findFirst({
      where: {
        customDomain: normalized,
        customDomainStatus: CustomDomainStatus.ACTIVE,
        status: { not: "DELETED" },
      },
      include: restaurantInclude,
    });

    if (!restaurant) return null;
    return toTenantContext(restaurant);
  }
);

/** @deprecated Use resolveTenantByHostLabel */
export async function resolveTenantBySubdomain(
  subdomain: string
): Promise<TenantContext | null> {
  return resolveTenantByHostLabel(subdomain);
}
