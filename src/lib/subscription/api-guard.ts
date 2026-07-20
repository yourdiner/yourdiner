import { NextRequest, NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/tenancy";
import { isRestaurantOperational } from "@/lib/restaurant-access";
import { requirePlanFeature, requireWritableSubscription } from "@/lib/permissions";
import { mapSubscriptionError } from "@/lib/subscription/route-guard";
import { getFeatureForRoute } from "@/lib/subscription/feature-registry";

type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

export function withSubscriptionGuard(
  handler: RouteHandler,
  options?: { feature?: string; writable?: boolean; routePath?: string }
): RouteHandler {
  return async (request, context) => {
    try {
      const tenant = await requireTenantContext();
      if (!isRestaurantOperational(tenant.restaurantStatus)) {
        return NextResponse.json(
          { ok: false, error: "Restaurant is not active", code: "RESTAURANT_INACTIVE" },
          { status: 403 }
        );
      }
      const feature =
        options?.feature ??
        (options?.routePath ? getFeatureForRoute(options.routePath) : null);

      if (options?.writable !== false) {
        await requireWritableSubscription(tenant.restaurantId);
      }

      if (feature) {
        await requirePlanFeature(tenant.restaurantId, feature);
      }

      return handler(request, context);
    } catch (error) {
      const mapped = mapSubscriptionError(error);
      if (mapped) {
        return NextResponse.json(mapped.body, { status: mapped.status });
      }
      throw error;
    }
  };
}
