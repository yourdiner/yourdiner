import type { PromotionTargetScope, PromotionType } from "@prisma/client";
import type { ConfigurableProduct, ProductSelection, PricedSelection } from "@/features/product-config";

export type PromotionTargetDTO = {
  productId: string | null;
  categoryId: string | null;
};

export type PromotionComboComponentDTO = {
  productId: string;
  quantity: number;
  sortOrder: number;
};

export type PromotionDayPriceDTO = {
  daysOfWeek: number[];
  fixedPricePaise: number;
};

/** Normalized promotion used by the pure pricing engine. */
export type EnginePromotion = {
  id: string;
  restaurantId: string;
  name: string;
  billLabel: string | null;
  type: PromotionType;
  targetScope: PromotionTargetScope;
  priority: number;
  stackable: boolean;
  isActive: boolean;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  daysOfWeek: number[];
  fixedPricePaise: number | null;
  percentOff: number | null;
  flatOffPaise: number | null;
  minOrderAmountPaise: number | null;
  targets: PromotionTargetDTO[];
  comboComponents: PromotionComboComponentDTO[];
  dayPrices: PromotionDayPriceDTO[];
};

export type PriceLineContext = {
  product: ConfigurableProduct & { categoryId?: string };
  selection: ProductSelection;
  promotions: EnginePromotion[];
  /** Instant used for window checks (restaurant-local day/time already applied via helpers). */
  now: Date;
  /** Weekday 0=Sun..6=Sat in restaurant timezone */
  dayOfWeek: number;
  /** Minutes since midnight in restaurant timezone */
  minutesOfDay: number;
};

export type AppliedPromotionAudit = {
  promotionId: string;
  promotionName: string;
  discountPaise: number;
};

export type PricedLine = PricedSelection & {
  originalUnitPrice: number;
  promotionId: string | null;
  promotionNameSnapshot: string | null;
  promotionDiscountPaise: number;
  applied: AppliedPromotionAudit[];
};

export type ComboLineInput = {
  id?: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  originalUnitPrice: number;
  name: string;
  /** Already in an explicit combo — do not auto-rematch. */
  comboGroupId?: string | null;
  /** Explicit combo: skip auto-match. */
  explicitCombo?: boolean;
  promotionId?: string | null;
  promotionNameSnapshot?: string | null;
  promotionDiscountPaise?: number;
  billDisplayName?: string | null;
};

export type ComboMatchedLine = ComboLineInput & {
  comboGroupId: string | null;
  billDisplayName: string | null;
  unitPrice: number;
  totalPrice: number;
  originalUnitPrice: number;
  promotionId: string | null;
  promotionNameSnapshot: string | null;
  promotionDiscountPaise: number;
};

export type TaxSettingsInput = {
  taxPercent: number;
  taxInclusive: boolean;
};

export type PriceOrderInput = {
  lineTotalPaise: number;
  taxSettings: TaxSettingsInput;
  billPromotions: EnginePromotion[];
  manualDiscountPaise: number;
  deliveryChargesPaise?: number;
};

export type PriceOrderResult = {
  subtotal: number;
  promotionDiscountAmount: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  appliedBillPromotion: AppliedPromotionAudit | null;
};
