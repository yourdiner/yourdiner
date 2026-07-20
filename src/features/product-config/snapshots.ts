import type {
  ConfigurableProduct,
  OrderItemSnapshotFields,
  OrderLineDisplay,
  OrderModifierSnapshot,
  ProductSelection,
} from "./types";
import { priceSelection } from "./pricing";

export function buildOrderItemSnapshots(
  product: ConfigurableProduct,
  selection: ProductSelection
): OrderItemSnapshotFields {
  const priced = priceSelection(product, selection);
  const qty = Math.max(1, selection.quantity);

  return {
    name: product.name,
    variantId: priced.variantId,
    variantNameSnapshot: priced.variantName,
    variantPriceSnapshot: priced.variantPrice,
    basePriceSnapshot: priced.basePrice,
    unitPrice: priced.unitPrice,
    totalPrice: priced.unitPrice * qty,
    modifiers: priced.modifiers,
    configurationKey: priced.configurationKey,
    notes: selection.notes?.trim() || null,
    kitchenNotes: selection.kitchenNotes?.trim() || null,
  };
}

export function parseModifierSnapshots(raw: unknown): OrderModifierSnapshot[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is OrderModifierSnapshot =>
      typeof m === "object" &&
      m !== null &&
      "name" in m &&
      typeof (m as OrderModifierSnapshot).name === "string"
  );
}

export function formatOrderLineDisplay(item: {
  name: string;
  variantNameSnapshot?: string | null;
  modifiers?: unknown;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string | null;
  kitchenNotes?: string | null;
}): OrderLineDisplay {
  const mods = parseModifierSnapshots(item.modifiers);
  return {
    productName: item.name,
    variantName: item.variantNameSnapshot ?? null,
    modifiers: mods.map((m) => m.name),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    notes: item.notes ?? null,
    kitchenNotes: item.kitchenNotes ?? null,
  };
}

export function formatKitchenLines(item: {
  name: string;
  variantNameSnapshot?: string | null;
  modifiers?: unknown;
  quantity: number;
  notes?: string | null;
  kitchenNotes?: string | null;
}): string[] {
  const mods = parseModifierSnapshots(item.modifiers);
  const lines: string[] = [`${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`];
  if (item.variantNameSnapshot) lines.push(item.variantNameSnapshot);
  for (const mod of mods) {
    lines.push(`+ ${mod.name}`);
  }
  const note = item.kitchenNotes || item.notes;
  if (note) lines.push(`Notes: ${note}`);
  return lines;
}
