import type { OrderInterfaceOrder } from "@/features/dining-session/components/order-interface";

type OrderItem = {
  id: string;
  productId?: string;
  name: string;
  billDisplayName?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  kitchenStatus: string;
  kitchenNotes: string | null;
  notes: string | null;
  variantId?: string | null;
  variantNameSnapshot?: string | null;
  modifiers: unknown;
  revisionNumber: number;
  createdAt: Date | string;
};

type ActiveOrder = {
  id: string;
  status: string;
  total: number;
  subtotal: number;
  discountAmount: number | null;
  promotionDiscountAmount?: number | null;
  items: OrderItem[];
  revisions: { revisionNumber: number; submittedAt: Date | string }[];
};

export function serializeActiveOrder(order: ActiveOrder | null): OrderInterfaceOrder | null {
  if (!order) return null;
  return {
    id: order.id,
    status: order.status,
    total: order.total,
    subtotal: order.subtotal,
    discountAmount: order.discountAmount ?? 0,
    promotionDiscountAmount: order.promotionDiscountAmount ?? 0,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.name,
      billDisplayName: item.billDisplayName ?? null,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      kitchenStatus: item.kitchenStatus,
      kitchenNotes: item.kitchenNotes,
      notes: item.notes,
      variantId: item.variantId ?? null,
      variantNameSnapshot: item.variantNameSnapshot ?? null,
      modifiers: item.modifiers,
      revisionNumber: item.revisionNumber,
      createdAt:
        item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
    })),
    revisions: order.revisions.map((rev) => ({
      ...rev,
      submittedAt:
        rev.submittedAt instanceof Date ? rev.submittedAt.toISOString() : rev.submittedAt,
    })),
  };
}
