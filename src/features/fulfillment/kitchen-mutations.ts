import { revalidatePath } from "next/cache";
import { z } from "zod";
import { OrderItemKitchenStatus } from "@prisma/client";
import { getErrorMessage } from "@/lib/errors";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import {
  advanceKitchenTicketItems,
  advanceOrderItemKitchenStatus,
} from "./kitchen-item.service";

const updateTicketStatusSchema = z.object({
  status: z.enum(["COOKING", "READY"]),
});

const updateItemStatusSchema = z.object({
  status: z.enum(["PREPARING", "READY", "SERVED"]),
});

export type KitchenMutationResult = { ok: true } | { ok: false; error: string };

async function requireKitchenStaff() {
  const tenant = await requireTenantContext();
  await requirePlanFeature(tenant.restaurantId, "kitchen");
  await requireRestaurantStaff(tenant.restaurantId, [
    "OWNER",
    "MANAGER",
    "CASHIER",
    "KITCHEN",
  ]);
  return tenant;
}

export async function updateKitchenOrderStatusMutation(
  kitchenOrderId: string,
  input: unknown
): Promise<KitchenMutationResult> {
  try {
    const tenant = await requireKitchenStaff();
    const { status } = updateTicketStatusSchema.parse(input);
    await advanceKitchenTicketItems(kitchenOrderId, tenant.restaurantId, status);

    revalidatePath("/dashboard/kitchen");
    revalidatePath("/admin/kitchen");
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function updateKitchenItemStatusMutation(
  orderItemId: string,
  input: unknown
): Promise<KitchenMutationResult> {
  try {
    const tenant = await requireKitchenStaff();
    const { status } = updateItemStatusSchema.parse(input);
    await advanceOrderItemKitchenStatus(
      orderItemId,
      tenant.restaurantId,
      status as OrderItemKitchenStatus
    );

    revalidatePath("/dashboard/kitchen");
    revalidatePath("/admin/kitchen");
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
