/** Client-safe loyalty settings helpers (no database imports). */

export type LoyaltySettings = {
  enabled: boolean;
  earnPercentOfBill: number;
  pointValueInRupees: number;
};

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  enabled: false,
  earnPercentOfBill: 5,
  pointValueInRupees: 1,
};

export function parseLoyaltySettings(raw: unknown): LoyaltySettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_LOYALTY_SETTINGS };
  const o = raw as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    earnPercentOfBill:
      typeof o.earnPercentOfBill === "number"
        ? Math.min(100, Math.max(0, o.earnPercentOfBill))
        : DEFAULT_LOYALTY_SETTINGS.earnPercentOfBill,
    pointValueInRupees:
      typeof o.pointValueInRupees === "number" && o.pointValueInRupees > 0
        ? o.pointValueInRupees
        : DEFAULT_LOYALTY_SETTINGS.pointValueInRupees,
  };
}

export function loyaltyPointsToPaise(
  points: number,
  pointValueInRupees: number
): number {
  return Math.round(points * pointValueInRupees * 100);
}

export function computeEarnedPoints(
  billAmountPaise: number,
  earnPercentOfBill: number
): number {
  return Math.floor((billAmountPaise / 100) * (earnPercentOfBill / 100));
}
