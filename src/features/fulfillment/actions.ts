"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import {
  createTakeawayOrderMutation,
  createDeliveryOrderMutation,
} from "./fulfillment-mutations";
import {
  listAllOrders,
  getKitchenQueue,
} from "./fulfillment-queries";
import type { OrderListFilters } from "./fulfillment-queries";
import type { KitchenOrderStatus } from "@prisma/client";

/** @deprecated Prefer POST /api/admin/fulfillment-orders */
export async function createTakeawayOrderAction(input: unknown) {
  const result = await createTakeawayOrderMutation(input);
  if (!result.ok) throw new Error(result.error);
  revalidatePath("/admin/orders");
  return { id: result.orderId };
}

/** @deprecated Prefer POST /api/admin/fulfillment-orders */
export async function createDeliveryOrderAction(input: unknown) {
  const result = await createDeliveryOrderMutation(input);
  if (!result.ok) throw new Error(result.error);
  revalidatePath("/admin/orders");
  return { id: result.orderId };
}

export async function getOrdersListAction(filters: OrderListFilters = {}) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId);
  return listAllOrders(tenant.restaurantId, filters);
}

export async function getKitchenQueueAction() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId);
  return getKitchenQueue(tenant.restaurantId);
}

/** @deprecated Prefer POST /api/admin/kitchen/[kitchenOrderId] */
export async function updateKitchenOrderStatusAction(
  kitchenOrderId: string,
  status: KitchenOrderStatus
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { updateKitchenOrderStatusMutation } = await import("./kitchen-mutations");
  return updateKitchenOrderStatusMutation(kitchenOrderId, { status });
}
