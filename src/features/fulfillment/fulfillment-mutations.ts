import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { OrderStatus } from "@prisma/client";
import { requireTenantContext } from "@/lib/tenancy";
import { requireAdminOrderActor } from "@/features/dining-session/auth";
import { requirePlanFeature } from "@/lib/permissions";
import {
  createTakeawayOrderSchema,
  createDeliveryOrderSchema,
} from "./schemas";
import {
  addItemToFulfillmentOrder,
  updateFulfillmentItemConfig,
  updateFulfillmentItemQty,
  removeFulfillmentItem,
  submitFulfillmentToKitchen,
  transitionFulfillmentStatus,
  cancelFulfillmentOrder,
  createTakeawayOrder,
  createDeliveryOrder,
} from "./fulfillment-order.service";
import {
  recordFulfillmentPayment,
  completeFulfillmentOrder,
} from "./fulfillment-payment.service";

export type FulfillmentMutationResult = { ok: true } | { ok: false; error: string };

export type FulfillmentCreateResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

export async function createTakeawayOrderMutation(
  input: unknown
): Promise<FulfillmentCreateResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireAdminOrderActor({
      adminRoles: ["OWNER", "MANAGER", "CASHIER"],
    });
    const staffId =
      actor.type === "admin" || actor.type === "staff" ? actor.staffId : undefined;
    await requirePlanFeature(tenant.restaurantId, "fulfillment_orders");

    const data = createTakeawayOrderSchema.parse(input);
    const order = await createTakeawayOrder(tenant.restaurantId, {
      phone: data.phone,
      name: data.name,
      pickupTime: data.pickupTime ? new Date(data.pickupTime) : null,
      notes: data.notes,
      staffId,
    });

    revalidatePath("/admin/orders");
    return { ok: true, orderId: order.id };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function createDeliveryOrderMutation(
  input: unknown
): Promise<FulfillmentCreateResult> {
  try {
    const tenant = await requireTenantContext();
    const actor = await requireAdminOrderActor({
      adminRoles: ["OWNER", "MANAGER", "CASHIER"],
    });
    const staffId =
      actor.type === "admin" || actor.type === "staff" ? actor.staffId : undefined;
    await requirePlanFeature(tenant.restaurantId, "fulfillment_orders");

    const data = createDeliveryOrderSchema.parse(input);
    const order = await createDeliveryOrder(tenant.restaurantId, {
      phone: data.phone,
      name: data.name,
      address: data.address,
      landmark: data.landmark,
      instructions: data.instructions,
      deliveryCharges: data.deliveryCharges,
      estimatedDeliveryAt: data.estimatedDeliveryAt
        ? new Date(data.estimatedDeliveryAt)
        : null,
      deliveryPartner: data.deliveryPartner,
      notes: data.notes,
      staffId,
    });

    if (!order) {
      return { ok: false, error: "Failed to create order" };
    }

    revalidatePath("/admin/orders");
    return { ok: true, orderId: order.id };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export type FulfillmentOrderAction =
  | {
      action: "addItem";
      productId: string;
      quantity: number;
      kitchenNotes?: string;
      notes?: string;
      variantId?: string;
      modifierIds?: string[];
    }
  | {
      action: "updateItemConfig";
      itemId: string;
      variantId?: string | null;
      modifierIds?: string[];
      quantity?: number;
      notes?: string;
      kitchenNotes?: string;
    }
  | { action: "updateQty"; itemId: string; quantity: number }
  | { action: "removeItem"; itemId: string }
  | { action: "submitKitchen" }
  | { action: "markReady" }
  | { action: "markPickedUp" }
  | { action: "markOutForDelivery" }
  | { action: "markDelivered" }
  | {
      action: "recordPayment";
      amount: number;
      method: "CASH" | "CARD" | "UPI" | "OTHER";
      notes?: string;
    }
  | { action: "complete" }
  | { action: "cancel" };

function revalidateFulfillmentOrder(orderId: string) {
  revalidatePath("/admin/orders");
  revalidatePath("/admin/kitchen");
  revalidatePath(`/admin/orders/takeaway/${orderId}`);
  revalidatePath(`/admin/orders/delivery/${orderId}`);
}

export async function runFulfillmentOrderMutation(
  orderId: string,
  body: FulfillmentOrderAction
): Promise<FulfillmentMutationResult> {
  try {
    const tenant = await requireTenantContext();
    await requirePlanFeature(tenant.restaurantId, "fulfillment_orders");
    const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
    const staffId = actor.type === "staff" ? actor.staffId : undefined;

    switch (body.action) {
      case "addItem":
        await addItemToFulfillmentOrder(
          orderId,
          tenant.restaurantId,
          body.productId,
          body.quantity,
          {
            kitchenNotes: body.kitchenNotes,
            notes: body.notes,
            variantId: body.variantId,
            modifierIds: body.modifierIds,
            staffId,
          }
        );
        break;
      case "updateItemConfig":
        await updateFulfillmentItemConfig(orderId, tenant.restaurantId, body.itemId, {
          variantId: body.variantId,
          modifierIds: body.modifierIds,
          quantity: body.quantity,
          notes: body.notes,
          kitchenNotes: body.kitchenNotes,
        });
        break;
      case "updateQty":
        await updateFulfillmentItemQty(
          orderId,
          tenant.restaurantId,
          body.itemId,
          body.quantity
        );
        break;
      case "removeItem":
        await removeFulfillmentItem(orderId, tenant.restaurantId, body.itemId);
        break;
      case "submitKitchen":
        await submitFulfillmentToKitchen(orderId, tenant.restaurantId, staffId);
        break;
      case "markReady": {
        const order = await prisma.order.findFirst({
          where: { id: orderId, restaurantId: tenant.restaurantId },
          select: { orderType: true },
        });
        if (!order) return { ok: false, error: "Order not found" };
        const target =
          order.orderType === "TAKEAWAY" ? OrderStatus.READY_FOR_PICKUP : OrderStatus.READY;
        await transitionFulfillmentStatus(orderId, tenant.restaurantId, target);
        break;
      }
      case "markPickedUp":
        await transitionFulfillmentStatus(orderId, tenant.restaurantId, OrderStatus.PICKED_UP);
        break;
      case "markOutForDelivery":
        await transitionFulfillmentStatus(
          orderId,
          tenant.restaurantId,
          OrderStatus.OUT_FOR_DELIVERY
        );
        break;
      case "markDelivered":
        await transitionFulfillmentStatus(orderId, tenant.restaurantId, OrderStatus.DELIVERED);
        break;
      case "recordPayment":
        await recordFulfillmentPayment(orderId, tenant.restaurantId, {
          amount: body.amount,
          method: body.method,
          notes: body.notes,
        });
        break;
      case "complete":
        await completeFulfillmentOrder(orderId, tenant.restaurantId);
        break;
      case "cancel":
        await cancelFulfillmentOrder(orderId, tenant.restaurantId);
        break;
      default:
        return { ok: false, error: "Unknown action" };
    }

    revalidateFulfillmentOrder(orderId);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}
