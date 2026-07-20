import { revalidatePath } from "next/cache";
import { requireStaffTenantSession } from "@/lib/staff-session";
import { requireTenantContext } from "@/lib/tenancy";
import { requireAdminOrderActor, requireOrderActor } from "@/features/dining-session/auth";
import { getErrorMessage } from "@/lib/errors";
import {
  requestBillService,
  closeDiningSessionService,
} from "@/features/dining-session/session.service";
import {
  addItemToOrderService,
  updateOrderItemQuantityService,
  removeOrderItemService,
  submitOrderToKitchenService,
  updateOrderItemConfigService,
} from "@/features/dining-session/order.service";

export type OrderMutationResult = { ok: true } | { ok: false; error: string };

function revalidateStaffOrder(sessionId: string) {
  revalidatePath("/staff/floor");
  revalidatePath(`/staff/order/${sessionId}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${sessionId}`);
}

function revalidateAdminOrder(sessionId: string) {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${sessionId}`);
  revalidatePath(`/admin/orders/${sessionId}/order`);
  revalidatePath("/admin/live-floor");
  revalidatePath("/staff/floor");
  revalidatePath(`/staff/order/${sessionId}`);
}

export type StaffOrderAction =
  | {
      action: "addItem";
      productId: string;
      quantity: number;
      kitchenNotes?: string;
      notes?: string;
      variantId?: string;
      modifierIds?: string[];
    }
  | { action: "updateItemConfig"; itemId: string; variantId?: string | null; modifierIds?: string[]; quantity?: number; notes?: string; kitchenNotes?: string }
  | { action: "updateQty"; itemId: string; quantity: number }
  | { action: "removeItem"; itemId: string }
  | { action: "submitKitchen" }
  | { action: "requestBill" }
  | { action: "closeSession" };

export async function runStaffOrderMutation(
  sessionId: string,
  body: StaffOrderAction
): Promise<OrderMutationResult> {
  try {
    const { staffSession, tenant } = await requireStaffTenantSession();
    const actor = await requireOrderActor();

    switch (body.action) {
      case "addItem":
        await addItemToOrderService(
          sessionId,
          tenant.restaurantId,
          body.productId,
          body.quantity,
          actor,
          {
            kitchenNotes: body.kitchenNotes,
            notes: body.notes,
            staffId: staffSession.staffId,
            variantId: body.variantId,
            modifierIds: body.modifierIds,
          }
        );
        break;
      case "updateItemConfig":
        await updateOrderItemConfigService(
          sessionId,
          tenant.restaurantId,
          body.itemId,
          {
            variantId: body.variantId,
            modifierIds: body.modifierIds,
            quantity: body.quantity ?? 1,
            notes: body.notes,
            kitchenNotes: body.kitchenNotes,
          },
          actor
        );
        break;
      case "updateQty":
        await updateOrderItemQuantityService(
          sessionId,
          tenant.restaurantId,
          body.itemId,
          body.quantity,
          actor
        );
        break;
      case "removeItem":
        await removeOrderItemService(sessionId, tenant.restaurantId, body.itemId, actor);
        break;
      case "submitKitchen":
        await submitOrderToKitchenService(
          sessionId,
          tenant.restaurantId,
          actor,
          staffSession.staffId
        );
        break;
      case "requestBill":
        await requestBillService(sessionId, tenant.restaurantId, actor);
        break;
      case "closeSession":
        await closeDiningSessionService(sessionId, tenant.restaurantId, actor);
        break;
      default:
        return { ok: false, error: "Unknown action" };
    }

    revalidateStaffOrder(sessionId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export type AdminOrderAction = StaffOrderAction;

export async function runAdminOrderMutation(
  sessionId: string,
  body: AdminOrderAction
): Promise<OrderMutationResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });

    switch (body.action) {
      case "addItem":
        await addItemToOrderService(
          sessionId,
          tenant.restaurantId,
          body.productId,
          body.quantity,
          actor,
          {
            kitchenNotes: body.kitchenNotes,
            notes: body.notes,
            variantId: body.variantId,
            modifierIds: body.modifierIds,
          }
        );
        break;
      case "updateItemConfig":
        await updateOrderItemConfigService(
          sessionId,
          tenant.restaurantId,
          body.itemId,
          {
            variantId: body.variantId,
            modifierIds: body.modifierIds,
            quantity: body.quantity ?? 1,
            notes: body.notes,
            kitchenNotes: body.kitchenNotes,
          },
          actor
        );
        break;
      case "updateQty":
        await updateOrderItemQuantityService(
          sessionId,
          tenant.restaurantId,
          body.itemId,
          body.quantity,
          actor
        );
        break;
      case "removeItem":
        await removeOrderItemService(sessionId, tenant.restaurantId, body.itemId, actor);
        break;
      case "submitKitchen":
        await submitOrderToKitchenService(sessionId, tenant.restaurantId, actor);
        break;
      case "requestBill":
        await requestBillService(sessionId, tenant.restaurantId, actor);
        break;
      case "closeSession":
        await closeDiningSessionService(sessionId, tenant.restaurantId, actor);
        break;
      default:
        return { ok: false, error: "Unknown action" };
    }

    revalidateAdminOrder(sessionId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
