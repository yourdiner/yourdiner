import { getRestaurantSettingsCached } from "@/lib/request-cache";

export type OrderSettings = {
  allowOrderRevisions?: boolean;
  maxRevisions?: number;
  requireCustomerPhone?: boolean;
  autoCloseSessionOnBill?: boolean;
  requireFirstOrderApproval?: boolean;
  customerSessionInactivityMinutes?: number;
};

export function parseOrderSettings(raw: unknown): OrderSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    allowOrderRevisions: o.allowOrderRevisions !== false,
    maxRevisions: typeof o.maxRevisions === "number" ? o.maxRevisions : 10,
    requireCustomerPhone: o.requireCustomerPhone === true,
    autoCloseSessionOnBill: o.autoCloseSessionOnBill === true,
    // Off by default: table-session approval is the gate; orders go to kitchen directly.
    requireFirstOrderApproval: o.requireFirstOrderApproval === true,
    customerSessionInactivityMinutes:
      typeof o.customerSessionInactivityMinutes === "number"
        ? o.customerSessionInactivityMinutes
        : 120,
  };
}

export async function getRestaurantOrderSettings(restaurantId: string): Promise<OrderSettings> {
  const settings = await getRestaurantSettingsCached(restaurantId);
  return parseOrderSettings(settings?.orderSettings);
}
