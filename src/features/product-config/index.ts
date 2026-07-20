export type {
  ConfigurableProduct,
  ConfigurableVariant,
  ConfigurableVariantGroup,
  ConfigurableModifier,
  ConfigurableModifierGroup,
  ProductSelection,
  OrderModifierSnapshot,
  PricedSelection,
  ValidationResult,
  OrderLineDisplay,
  OrderItemSnapshotFields,
} from "./types";

export {
  getVariantGroups,
  getDisplayFromPrice,
  hasRequiredVariants,
  findVariant,
  findModifier,
  getActiveModifierGroups,
} from "./product-helpers";

export {
  computeUnitPrice,
  computeTotalPrice,
  priceSelection,
  computeBasePrice,
} from "./pricing";

export { validateSelection, canAddToOrder } from "./validation";

export {
  buildConfigurationKey,
  cartLineKey,
  normalizeInstructionNote,
} from "./cart-key";

// Server-only helpers (Prisma) must NOT be re-exported here — client components
// import this barrel. Use `@/features/product-config/merge-pending-order-item` instead.

export {
  buildOrderItemSnapshots,
  formatOrderLineDisplay,
  formatKitchenLines,
  parseModifierSnapshots,
} from "./snapshots";

export { ProductConfiguratorSheet } from "./components/product-configurator-sheet";
export type { ConfiguratorConfirmPayload } from "./components/product-configurator-sheet";
export { OrderLineItem, KitchenTicketItem } from "./components/order-line-item";
