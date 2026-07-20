import { cache } from "react";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export const subscriptionInclude = {
  plan: true,
  planVersion: {
    include: {
      planFeatures: { include: { feature: true } },
      pricing: { orderBy: { effectiveFrom: "desc" as const }, take: 5 },
    },
  },
  scheduledPlan: true,
  scheduledPlanVersion: true,
  payments: { orderBy: { createdAt: "desc" as const }, take: 20 },
  invoices: { orderBy: { createdAt: "desc" as const }, take: 20 },
  events: { orderBy: { createdAt: "desc" as const }, take: 50 },
} satisfies Prisma.SubscriptionInclude;

/** Slim include for plan feature gating — avoids payments/invoices/events. */
export const subscriptionFeaturesInclude = {
  plan: true,
  planVersion: {
    include: {
      planFeatures: { include: { feature: true } },
    },
  },
} satisfies Prisma.SubscriptionInclude;

export type SubscriptionWithRelations = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionInclude;
}>;

export type SubscriptionForFeatureAccess = Prisma.SubscriptionGetPayload<{
  include: typeof subscriptionFeaturesInclude;
}>;

export const findSubscriptionForFeatureAccess = cache(async (restaurantId: string) => {
  return prisma.subscription.findUnique({
    where: { restaurantId },
    include: subscriptionFeaturesInclude,
  });
});

export const findSubscriptionByRestaurantId = cache(async (restaurantId: string) => {
  return prisma.subscription.findUnique({
    where: { restaurantId },
    include: subscriptionInclude,
  });
});

export async function findSubscriptionById(id: string) {
  return prisma.subscription.findUnique({
    where: { id },
    include: subscriptionInclude,
  });
}

export async function findSubscriptionByRazorpayId(razorpaySubscriptionId: string) {
  return prisma.subscription.findFirst({
    where: { razorpaySubscriptionId },
    include: subscriptionInclude,
  });
}

export async function logSubscriptionEvent(
  subscriptionId: string,
  type: Prisma.SubscriptionEventCreateInput["type"],
  metadata: Record<string, unknown> = {},
  actorUserId?: string
) {
  return prisma.subscriptionEvent.create({
    data: {
      subscriptionId,
      type,
      metadata: metadata as Prisma.InputJsonValue,
      actorUserId,
    },
  });
}
