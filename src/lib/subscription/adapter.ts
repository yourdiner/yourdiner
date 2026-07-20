/**
 * Thin adapter wiring restaurant tenancy to the subscription engine.
 */
export {
  getEffectiveFeatures,
  requireFeature,
  hasFeature,
  subscribeRestaurant,
  getVisiblePlans,
  startTrial,
} from "@/lib/subscription";

export {
  getRestaurantSubscriptionState,
  getRestaurantFeatureCodes,
  requirePlanFeature,
  requireWritableSubscription,
} from "@/lib/permissions";

export {
  getFeatureForModule,
  getFeatureForRoute,
  moduleHasFeature,
  MODULE_FEATURE_MAP,
} from "@/lib/subscription/feature-registry";

export { mapSubscriptionError } from "@/lib/subscription/route-guard";
