/** @deprecated Use feature-registry and DB-driven features instead */
export {
  MODULE_FEATURE_MAP,
  FEATURE_UPGRADE_LABELS,
  moduleHasFeature,
  getModuleUpgradeLabel,
  getFeatureForModule,
} from "@/lib/subscription/feature-registry";

export type { FeatureCode } from "@/lib/subscription/feature-registry";
