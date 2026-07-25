import { prisma } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { AppError } from "@/lib/errors";
import { requireTenantContext } from "@/lib/tenancy";
import {
  getRestaurantFeatureCodes,
  requireWritableSubscription,
} from "@/lib/permissions";
import {
  createCustomerActor,
  type OrderActor,
} from "@/features/dining-session/auth";
import {
  lookupCustomerPublicByPhone,
} from "@/features/dining-session/customer.service";
import {
  requestBillService,
  callWaiterService,
} from "@/features/dining-session/session.service";
import {
  addItemToOrderService,
  updateOrderItemQuantityService,
  removeOrderItemService,
  submitOrderToKitchenService,
  updateOrderItemConfigService,
} from "@/features/dining-session/order.service";
import { OrderStatus, TableSessionStatus } from "@prisma/client";
import {
  createPendingCustomerSession,
  getBlockingTableSession,
  loadCustomerTableSessionByToken,
  requireCustomerTableSession,
  getSessionTokenFromRequest,
  resolveTerminalTableSessionByToken,
  touchTableSession,
} from "@/lib/table-sessions";
import { clearCustomerSessionCookie } from "@/lib/customer-session-cookie";
import { resolveTableByQrSlug } from "@/lib/table-qr";
import { getTableAvailability } from "@/features/tables/table-availability.service";

export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: string; code?: string };

/** Premium plan: customer scans table QR and orders from their phone. */
export async function restaurantHasCustomerQrOrdering(
  restaurantId: string
): Promise<boolean> {
  try {
    await requireWritableSubscription(restaurantId);
    const codes = await getRestaurantFeatureCodes(restaurantId);
    return codes.has("customer_qr_ordering");
  } catch {
    return false;
  }
}

/** Professional (waiter_ordering) and Premium (customer_qr_ordering) can run table QR ordering. */
export async function restaurantHasCustomerOrdering(
  restaurantId: string
): Promise<boolean> {
  try {
    await requireWritableSubscription(restaurantId);
    const codes = await getRestaurantFeatureCodes(restaurantId);
    return codes.has("customer_qr_ordering") || codes.has("waiter_ordering");
  } catch {
    return false;
  }
}

async function assertCustomerOrderingEnabled(restaurantId: string) {
  await requireWritableSubscription(restaurantId);
  const codes = await getRestaurantFeatureCodes(restaurantId);
  if (codes.has("customer_qr_ordering") || codes.has("waiter_ordering")) {
    return;
  }
  throw new AppError(
    "Customer ordering is not available on your plan",
    "FEATURE_LOCKED",
    403
  );
}

async function requireActiveCustomerOrderingContext(tableId?: string) {
  const tenant = await requireTenantContext();
  await assertCustomerOrderingEnabled(tenant.restaurantId);
  const session = await requireCustomerTableSession(tenant.restaurantId, {
    requireActive: true,
    tableId,
  });
  if (!session.diningSessionId) {
    throw new AppError("Session not ready for ordering", "PENDING_APPROVAL", 403);
  }
  const actor = createCustomerActor(session.customerName || session.customerPhone || "Guest");
  return { tenant, session, actor, diningSessionId: session.diningSessionId };
}

export async function lookupCustomerForOrder(
  restaurantId: string,
  phone: string
) {
  await assertCustomerOrderingEnabled(restaurantId);
  return lookupCustomerPublicByPhone(restaurantId, phone);
}

export async function getCustomerSessionStatus(tableSlug: string) {
  try {
    const tenant = await requireTenantContext();
    await assertCustomerOrderingEnabled(tenant.restaurantId);
    const table = await resolveTableByQrSlug(tenant.restaurantId, tableSlug);

    const token = await getSessionTokenFromRequest();
    if (token) {
      const ownSession = await loadCustomerTableSessionByToken(token, tenant.restaurantId);
      if (ownSession && ownSession.tableId === table.id) {
        return {
          ok: true as const,
          data: {
            status: ownSession.status,
            tableSessionId: ownSession.tableSessionId,
            diningSessionId: ownSession.diningSessionId,
            customerName: ownSession.customerName,
            firstOrderApprovedAt: ownSession.firstOrderApprovedAt,
            tableOccupied: false,
          },
        };
      }

      const terminal = await resolveTerminalTableSessionByToken(
        token,
        tenant.restaurantId,
        table.id
      );
      if (terminal) {
        await clearCustomerSessionCookie();
        return {
          ok: true as const,
          data: {
            status: terminal.status,
            tableOccupied: false,
          },
        };
      }
    }

    const blocking = await getBlockingTableSession(table.id);
    if (blocking && blocking.sessionToken !== token) {
      return {
        ok: true as const,
        data: {
          status: "TABLE_OCCUPIED" as const,
          tableOccupied: true,
        },
      };
    }

    const availability = await getTableAvailability(tenant.restaurantId, table.id);
    if (availability && availability.status !== "AVAILABLE") {
      return {
        ok: true as const,
        data: {
          status: "TABLE_OCCUPIED" as const,
          tableOccupied: true,
        },
      };
    }

    return {
      ok: true as const,
      data: {
        status: blocking?.status ?? "NONE",
        tableOccupied: false,
        tableSessionId: blocking?.id ?? null,
        diningSessionId: blocking?.diningSessionId ?? null,
        customerName: blocking?.customer?.name ?? null,
        firstOrderApprovedAt: blocking?.firstOrderApprovedAt ?? null,
      },
    };
  } catch (error) {
    return { ok: false as const, error: getErrorMessage(error) };
  }
}

export async function startCustomerSessionFromTableSlug(input: {
  tableSlug: string;
  phone: string;
  name: string;
  deviceId?: string;
}): Promise<ServiceResult<{ tableSessionId: string; status: string; customerName: string }>> {
  try {
    const tenant = await requireTenantContext();
    await assertCustomerOrderingEnabled(tenant.restaurantId);
    const table = await resolveTableByQrSlug(tenant.restaurantId, input.tableSlug);

    const blocking = await getBlockingTableSession(table.id);
    if (blocking) {
      return {
        ok: false,
        error:
          "This table already has an active dining session. Please contact restaurant staff.",
        code: "TABLE_HAS_ACTIVE_SESSION",
      };
    }

    const session = await createPendingCustomerSession({
      restaurantId: tenant.restaurantId,
      tableId: table.id,
      phone: input.phone,
      name: input.name,
      deviceId: input.deviceId,
    });

    return {
      ok: true,
      data: {
        tableSessionId: session.tableSessionId,
        status: session.status,
        customerName: session.customerName || input.name,
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message, code: error.code };
    }
    return { ok: false, error: getErrorMessage(error) };
  }
}

/** @deprecated Use startCustomerSessionFromTableSlug */
export async function startCustomerSessionFromTableToken(input: {
  tableToken: string;
  phone: string;
  name: string;
  guestCount?: number;
}) {
  return startCustomerSessionFromTableSlug({
    tableSlug: input.tableToken,
    phone: input.phone,
    name: input.name,
  });
}

export type CustomerOrderAction =
  | {
      action: "addItem";
      productId: string;
      quantity: number;
      variantId?: string;
      modifierIds?: string[];
      notes?: string;
    }
  | { action: "updateItemConfig"; itemId: string; variantId?: string | null; modifierIds?: string[]; quantity?: number; notes?: string }
  | { action: "updateQty"; itemId: string; quantity: number }
  | { action: "removeItem"; itemId: string }
  | { action: "submitOrder" }
  | { action: "requestBill" }
  | { action: "callWaiter" };

export async function runCustomerOrderMutation(
  diningSessionId: string,
  _tableSlug: string,
  body: CustomerOrderAction
): Promise<ServiceResult<{ awaitingApproval?: boolean }>> {
  try {
    const { tenant, session, actor } = await requireActiveCustomerOrderingContext();
    if (session.diningSessionId !== diningSessionId) {
      throw new AppError("Session mismatch", "FORBIDDEN", 403);
    }

    switch (body.action) {
      case "addItem":
        await addItemToOrderService(
          diningSessionId,
          tenant.restaurantId,
          body.productId,
          body.quantity,
          actor,
          {
            variantId: body.variantId,
            modifierIds: body.modifierIds,
            notes: body.notes,
          }
        );
        break;
      case "updateItemConfig":
        await updateOrderItemConfigService(
          diningSessionId,
          tenant.restaurantId,
          body.itemId,
          {
            variantId: body.variantId,
            modifierIds: body.modifierIds,
            quantity: body.quantity ?? 1,
            notes: body.notes,
          },
          actor
        );
        break;
      case "updateQty":
        await updateOrderItemQuantityService(
          diningSessionId,
          tenant.restaurantId,
          body.itemId,
          body.quantity,
          actor
        );
        break;
      case "removeItem":
        await removeOrderItemService(
          diningSessionId,
          tenant.restaurantId,
          body.itemId,
          actor
        );
        break;
      case "submitOrder": {
        const result = await submitOrderToKitchenService(
          diningSessionId,
          tenant.restaurantId,
          actor
        );
        if (result?.awaitingApproval) {
          return { ok: true, data: { awaitingApproval: true } };
        }
        break;
      }
      case "requestBill":
        await requestBillService(diningSessionId, tenant.restaurantId, actor);
        break;
      case "callWaiter":
        await callWaiterService(diningSessionId, tenant.restaurantId, actor);
        break;
      default:
        return { ok: false, error: "Unknown action" };
    }

    await touchTableSession(session.tableSessionId);
    return { ok: true, data: {} };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message, code: error.code };
    }
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function getCustomerActiveOrder(diningSessionId: string): Promise<
  ServiceResult<{
    id: string;
    status: string;
    total: number;
    subtotal: number;
    discountAmount: number;
    promotionDiscountAmount?: number;
    items: Array<{
      id: string;
      productId?: string;
      name: string;
      billDisplayName?: string | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      kitchenStatus: string;
      variantId?: string | null;
      variantNameSnapshot?: string | null;
      modifiers?: unknown;
      notes?: string | null;
      kitchenNotes?: string | null;
    }>;
  } | null>
> {
  try {
    const { tenant, session } = await requireActiveCustomerOrderingContext();
    if (session.diningSessionId !== diningSessionId) {
      throw new AppError("Session mismatch", "FORBIDDEN", 403);
    }

    const order = await prisma.order.findFirst({
      where: {
        diningSessionId,
        restaurantId: tenant.restaurantId,
        status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
      },
      include: {
        items: { orderBy: { createdAt: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!order) {
      return { ok: true, data: null };
    }

    return {
      ok: true,
      data: {
        id: order.id,
        status: order.status,
        total: Number(order.total),
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        promotionDiscountAmount: Number(order.promotionDiscountAmount ?? 0),
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId ?? undefined,
          name: item.name,
          billDisplayName: item.billDisplayName ?? null,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
          kitchenStatus: item.kitchenStatus,
          variantId: item.variantId,
          variantNameSnapshot: item.variantNameSnapshot,
          modifiers: item.modifiers,
          notes: item.notes,
          kitchenNotes: item.kitchenNotes,
        })),
      },
    };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message, code: error.code };
    }
    return { ok: false, error: getErrorMessage(error) };
  }
}

export function isCustomerSessionEndedError(code?: string) {
  return code === "SESSION_ENDED" || code === "SESSION_REJECTED";
}

export { TableSessionStatus };
