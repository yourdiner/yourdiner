/**
 * Declarative map of app modules/routes → subscription feature codes.
 * Feature enablement is DB-driven; this registry only defines which code guards what.
 */
export const FEATURE_CODES = [
  "qr_menu",
  "staff_accounts",
  "waiter_ordering",
  "customer_qr_ordering",
  "reservations",
  "kitchen_dashboard",
  "fulfillment_orders",
  "customer_database",
  "membership",
  "coupons",
  "promotions",
  "analytics",
  "feedback",
  "multi_branch",
  "api_access",
] as const;

export type FeatureCode = (typeof FEATURE_CODES)[number];

/** Sidebar module key → feature code required */
export const MODULE_FEATURE_MAP: Record<string, FeatureCode> = {
  products: "qr_menu",
  categories: "qr_menu",
  branding: "qr_menu",
  qr_codes: "qr_menu",
  search: "qr_menu",
  theme: "qr_menu",
  menu: "qr_menu",
  tables: "qr_menu",
  orders: "kitchen_dashboard",
  kitchen: "kitchen_dashboard",
  fulfillment: "fulfillment_orders",
  staff: "staff_accounts",
  customers: "customer_database",
  reservations: "reservations",
  customer_ordering: "waiter_ordering",
  membership: "membership",
  loyalty: "membership",
  analytics: "analytics",
  coupons: "coupons",
  promotions: "promotions",
  feedback: "feedback",
  multi_branch: "multi_branch",
  api_access: "api_access",
};

/** Route prefix → feature code (tenant paths use /admin) */
export const ROUTE_FEATURE_MAP: Record<string, FeatureCode> = {
  "/admin/products": "qr_menu",
  "/admin/categories": "qr_menu",
  "/admin/branding": "qr_menu",
  "/admin/qr-codes": "qr_menu",
  "/admin/tables": "qr_menu",
  "/admin/orders": "kitchen_dashboard",
  "/admin/kitchen": "kitchen_dashboard",
  "/admin/live-floor": "kitchen_dashboard",
  "/admin/waiters": "staff_accounts",
  "/admin/customers": "customer_database",
  "/admin/analytics": "analytics",
  "/admin/reservations": "reservations",
  "/admin/promotions": "promotions",
  "/customer-order": "customer_qr_ordering",
  "/public-menu": "qr_menu",
};

/** Human-readable upgrade labels */
export const FEATURE_UPGRADE_LABELS: Record<string, string> = {
  qr_menu: "Starter",
  staff_accounts: "Professional",
  waiter_ordering: "Professional",
  kitchen_dashboard: "Starter",
  fulfillment_orders: "Professional",
  reservations: "Starter",
  customer_qr_ordering: "Professional",
  customer_database: "Premium",
  membership: "Premium",
  analytics: "Premium",
  coupons: "Premium",
  promotions: "Premium",
  feedback: "Premium",
  multi_branch: "Premium",
  api_access: "Premium",
};

export function getFeatureForModule(module: string): FeatureCode | null {
  return MODULE_FEATURE_MAP[module] ?? null;
}

export function getFeatureForRoute(path: string): FeatureCode | null {
  const normalized = path.replace("/dashboard", "/admin");
  for (const [prefix, code] of Object.entries(ROUTE_FEATURE_MAP)) {
    if (normalized === prefix || normalized.startsWith(`${prefix}/`)) {
      return code;
    }
  }
  return null;
}

export function moduleHasFeature(
  enabledFeatures: Set<string>,
  module: string
): boolean {
  const required = getFeatureForModule(module);
  if (!required) return true;
  return enabledFeatures.has(required);
}

export function getModuleUpgradeLabel(module: string): string {
  const code = getFeatureForModule(module);
  if (!code) return "a higher plan";
  return FEATURE_UPGRADE_LABELS[code] || "a higher plan";
}
