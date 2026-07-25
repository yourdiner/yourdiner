import "server-only";

import { prisma } from "@/lib/db";
import { OrderItemKitchenStatus, type Prisma } from "@prisma/client";
import type { OrderItemSnapshotFields } from "./types";

export type MergePendingOrderItemResult = {
  itemId: string;
  merged: boolean;
  quantity: number;
};

/**
 * Single source of truth for PENDING order-line create-or-merge.
 * Identical configurationKey → bump quantity; otherwise create a new line.
 * Promo/combo fields are part of the persisted snapshot; configurationKey already
 * encodes product config. Lines with comboGroupId never merge.
 */
export async function findOrIncrementPendingOrderItem(input: {
  orderId: string;
  productId: string;
  quantity: number;
  snapshots: OrderItemSnapshotFields;
}): Promise<MergePendingOrderItemResult> {
  const { orderId, productId, quantity, snapshots } = input;

  if (!snapshots.comboGroupId) {
    const existingPending = await prisma.orderItem.findFirst({
      where: {
        orderId,
        configurationKey: snapshots.configurationKey,
        kitchenStatus: OrderItemKitchenStatus.PENDING,
        comboGroupId: null,
        // Same promo context so promo'd and non-promo lines don't merge
        promotionId: snapshots.promotionId ?? null,
      },
    });

    if (existingPending) {
      const newQty = existingPending.quantity + quantity;
      await prisma.orderItem.update({
        where: { id: existingPending.id },
        data: {
          quantity: newQty,
          unitPrice: snapshots.unitPrice,
          totalPrice: snapshots.unitPrice * newQty,
          originalUnitPrice: snapshots.originalUnitPrice ?? snapshots.unitPrice,
          promotionDiscountPaise: snapshots.promotionDiscountPaise ?? 0,
        },
      });
      return { itemId: existingPending.id, merged: true, quantity: newQty };
    }
  }

  const created = await prisma.orderItem.create({
    data: {
      orderId,
      productId,
      variantId: snapshots.variantId,
      name: snapshots.name,
      variantNameSnapshot: snapshots.variantNameSnapshot,
      variantPriceSnapshot: snapshots.variantPriceSnapshot,
      basePriceSnapshot: snapshots.basePriceSnapshot,
      configurationKey: snapshots.configurationKey,
      quantity,
      unitPrice: snapshots.unitPrice,
      totalPrice: snapshots.totalPrice,
      originalUnitPrice: snapshots.originalUnitPrice ?? snapshots.unitPrice,
      promotionId: snapshots.promotionId ?? null,
      promotionNameSnapshot: snapshots.promotionNameSnapshot ?? null,
      promotionDiscountPaise: snapshots.promotionDiscountPaise ?? 0,
      comboGroupId: snapshots.comboGroupId ?? null,
      billDisplayName: snapshots.billDisplayName ?? null,
      modifiers: snapshots.modifiers as unknown as Prisma.InputJsonValue,
      notes: snapshots.notes,
      kitchenNotes: snapshots.kitchenNotes,
      kitchenStatus: OrderItemKitchenStatus.PENDING,
    },
  });

  return { itemId: created.id, merged: false, quantity };
}
