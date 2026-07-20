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
 */
export async function findOrIncrementPendingOrderItem(input: {
  orderId: string;
  productId: string;
  quantity: number;
  snapshots: OrderItemSnapshotFields;
}): Promise<MergePendingOrderItemResult> {
  const { orderId, productId, quantity, snapshots } = input;

  const existingPending = await prisma.orderItem.findFirst({
    where: {
      orderId,
      configurationKey: snapshots.configurationKey,
      kitchenStatus: OrderItemKitchenStatus.PENDING,
    },
  });

  if (existingPending) {
    const newQty = existingPending.quantity + quantity;
    await prisma.orderItem.update({
      where: { id: existingPending.id },
      data: {
        quantity: newQty,
        totalPrice: snapshots.unitPrice * newQty,
      },
    });
    return { itemId: existingPending.id, merged: true, quantity: newQty };
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
      modifiers: snapshots.modifiers as unknown as Prisma.InputJsonValue,
      notes: snapshots.notes,
      kitchenNotes: snapshots.kitchenNotes,
      kitchenStatus: OrderItemKitchenStatus.PENDING,
    },
  });

  return { itemId: created.id, merged: false, quantity };
}
