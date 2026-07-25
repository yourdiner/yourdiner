export interface ConfigurableVariant {
  id: string;
  name: string;
  price: number;
  isActive?: boolean;
  isAvailable?: boolean;
  sku?: string | null;
  prepTimeMinutes?: number | null;
}

export interface ConfigurableVariantGroup {
  id: string;
  name: string;
  isRequired: boolean;
  sortOrder?: number;
  variants: ConfigurableVariant[];
}

export interface ConfigurableModifier {
  id: string;
  name: string;
  price: number;
  isActive?: boolean;
  isAvailable?: boolean;
}

export interface ConfigurableModifierGroup {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder?: number;
  modifiers: ConfigurableModifier[];
}

export interface ConfigurableProduct {
  id: string;
  name: string;
  price: number;
  categoryId?: string;
  description?: string | null;
  shortDescription?: string | null;
  isOutOfStock?: boolean;
  variantGroups: ConfigurableVariantGroup[];
  /** @deprecated flat list — prefer variantGroups */
  variants?: ConfigurableVariant[];
  modifierGroups: ConfigurableModifierGroup[];
  images?: Array<{ media: { url: string } }>;
}

export interface ProductSelection {
  variantId?: string | null;
  modifierIds: string[];
  quantity: number;
  notes?: string;
  kitchenNotes?: string;
}

export interface OrderModifierSnapshot {
  modifierId: string;
  groupId: string;
  groupName: string;
  name: string;
  price: number;
}

export interface PricedSelection {
  unitPrice: number;
  totalPrice: number;
  basePrice: number;
  variantPrice: number | null;
  variantName: string | null;
  variantId: string | null;
  modifiers: OrderModifierSnapshot[];
  configurationKey: string;
  displayName: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface OrderLineDisplay {
  productName: string;
  variantName: string | null;
  modifiers: string[];
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes: string | null;
  kitchenNotes: string | null;
}

export interface OrderItemSnapshotFields {
  name: string;
  variantId: string | null;
  variantNameSnapshot: string | null;
  variantPriceSnapshot: number | null;
  basePriceSnapshot: number;
  unitPrice: number;
  totalPrice: number;
  originalUnitPrice?: number;
  promotionId?: string | null;
  promotionNameSnapshot?: string | null;
  promotionDiscountPaise?: number;
  comboGroupId?: string | null;
  billDisplayName?: string | null;
  modifiers: OrderModifierSnapshot[];
  configurationKey: string;
  notes: string | null;
  kitchenNotes: string | null;
}
