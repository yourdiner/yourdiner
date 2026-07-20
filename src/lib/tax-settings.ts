import { getRestaurantSettingsCached } from "@/lib/request-cache";

export type TaxSettings = {
  taxPercent: number;
  taxInclusive: boolean;
};

export const DEFAULT_TAX_SETTINGS: TaxSettings = {
  taxPercent: 5,
  taxInclusive: false,
};

export function parseTaxSettings(raw: {
  taxPercent?: number | null;
  taxInclusive?: boolean | null;
} | null | undefined): TaxSettings {
  return {
    taxPercent:
      typeof raw?.taxPercent === "number"
        ? Math.min(100, Math.max(0, raw.taxPercent))
        : DEFAULT_TAX_SETTINGS.taxPercent,
    taxInclusive: raw?.taxInclusive === true,
  };
}

export async function getRestaurantTaxSettings(restaurantId: string): Promise<TaxSettings> {
  const settings = await getRestaurantSettingsCached(restaurantId);
  return parseTaxSettings(settings);
}

export function computeTaxAmount(
  subtotalPaise: number,
  taxPercent: number,
  taxInclusive: boolean
): number {
  if (subtotalPaise <= 0 || taxPercent <= 0) return 0;
  if (taxInclusive) {
    return Math.round(subtotalPaise - subtotalPaise / (1 + taxPercent / 100));
  }
  return Math.round(subtotalPaise * (taxPercent / 100));
}

export function computeOrderTotal(
  subtotalPaise: number,
  taxAmountPaise: number,
  discountPaise: number,
  taxInclusive: boolean
): number {
  if (taxInclusive) {
    return Math.max(0, subtotalPaise - discountPaise);
  }
  return Math.max(0, subtotalPaise + taxAmountPaise - discountPaise);
}
