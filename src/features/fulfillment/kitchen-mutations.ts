import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getErrorMessage } from "@/lib/errors";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { updateKitchenOrderStatus } from "./fulfillment-queries";

const updateStatusSchema = z.object({
  status: z.enum(["COOKING", "READY"]),
});

export type KitchenMutationResult = { ok: true } | { ok: false; error: string };

export async function updateKitchenOrderStatusMutation(
  kitchenOrderId: string,
  input: unknown
): Promise<KitchenMutationResult> {
  try {
    const tenant = await requireTenantContext();
    await requirePlanFeature(tenant.restaurantId, "kitchen");
    await requireRestaurantStaff(tenant.restaurantId, [
      "OWNER",
      "MANAGER",
      "CASHIER",
      "KITCHEN",
    ]);

    const { status } = updateStatusSchema.parse(input);
    const updated = await updateKitchenOrderStatus(
      kitchenOrderId,
      tenant.restaurantId,
      status
    );
    if (!updated) return { ok: false, error: "Kitchen ticket not found" };

    revalidatePath("/admin/kitchen");
    revalidatePath("/admin/orders");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
