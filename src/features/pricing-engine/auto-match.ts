import "server-only";

import { prisma } from "@/lib/db";
import { OrderItemKitchenStatus } from "@prisma/client";
import { loadActivePromotions } from "./load-active";
import { matchCombos } from "./match-combos";

/**
 * Auto-match COMBO promotions against PENDING (draft) lines on an order.
 * Explicit combo lines (billDisplayName set with comboGroupId from addCombo) are locked.
 */
export async function autoMatchCombosOnOrder(orderId: string, restaurantId: string) {
  const items = await prisma.orderItem.findMany({
    where: {
      orderId,
      kitchenStatus: OrderItemKitchenStatus.PENDING,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!items.length) return;

  const productIds = [...new Set(items.map((i) => i.productId))];
  const promotions = await loadActivePromotions(restaurantId, { productIds });
  const combos = promotions.filter((p) => p.type === "COMBO");
  if (!combos.length) return;

  const matched = matchCombos(
    items.map((i) => ({
      id: i.id,
      productId: i.productId,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      totalPrice: i.totalPrice,
      originalUnitPrice: i.originalUnitPrice ?? i.unitPrice,
      name: i.name,
      comboGroupId: i.comboGroupId,
      // Lock lines that were created via explicit add-combo
      explicitCombo: Boolean(i.comboGroupId && i.billDisplayName),
      promotionId: i.promotionId,
      promotionNameSnapshot: i.promotionNameSnapshot,
      promotionDiscountPaise: i.promotionDiscountPaise,
      billDisplayName: i.billDisplayName,
    })),
    combos
  );

  await prisma.$transaction(
    matched.map((line, idx) => {
      const item = items[idx];
      return prisma.orderItem.update({
        where: { id: item.id },
        data: {
          unitPrice: line.unitPrice,
          totalPrice: line.totalPrice,
          originalUnitPrice: line.originalUnitPrice,
          promotionId: line.promotionId,
          promotionNameSnapshot: line.promotionNameSnapshot,
          promotionDiscountPaise: line.promotionDiscountPaise,
          comboGroupId: line.comboGroupId,
          billDisplayName: line.billDisplayName,
        },
      });
    })
  );
}
