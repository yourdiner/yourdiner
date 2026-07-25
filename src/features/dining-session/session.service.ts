import { prisma } from "@/lib/db";
import { getActiveDiningSessionForTable } from "@/lib/dining-session";
import { getRestaurantOrderSettings } from "@/lib/order-settings";
import {
  computeOrderTotal,
  getRestaurantTaxSettings,
} from "@/lib/tax-settings";
import {
  computeEarnedPoints,
  loyaltyPointsToPaise,
} from "@/lib/loyalty-settings";
import { getRestaurantLoyaltySettings } from "@/lib/loyalty-settings.server";
import { AppError } from "@/lib/errors";
import {
  DiningSessionStatus,
  DiningSessionSource,
  OrderItemKitchenStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "@prisma/client";
import type { OrderActor } from "./auth";
import { assertSessionStaffAccess } from "./session-access.service";
import { actorStaffId, actorUserId } from "./auth-helpers";
import { canOverrideTable } from "./permissions";
import { appendSessionEvent } from "./timeline.service";
import { findOrCreateCustomer } from "./customer.service";
import { syncOrderPaymentStatus, sumCompletedPayments } from "@/lib/order-payment-status";
import {
  assertTableAvailableForSession,
  getRestaurantTablesAvailability,
} from "@/features/tables/table-availability.service";
import {
  assertSessionReservationAllowed,
  logReservationOverride,
} from "@/features/reservations/reservation-conflict.service";
import { consolidateOpenOrdersForSession, refreshBillableOrderTotal } from "@/features/dining-session/order.service";

export type StartSessionInput = {
  restaurantId: string;
  tableId: string;
  guestCount: number;
  customerPhone?: string;
  customerName?: string;
  notes?: string;
  staffId?: string | null;
  reservationId?: string | null;
  source?: DiningSessionSource;
  /** Set after WARN double-confirm UI acknowledges an overlapping reservation. */
  reservationOverrideAcknowledged?: boolean;
  actor: OrderActor;
};

export async function startDiningSessionService(input: StartSessionInput) {
  const settings = await getRestaurantOrderSettings(input.restaurantId);
  if (settings.requireCustomerPhone && !input.customerPhone?.trim()) {
    throw new AppError("Customer phone is required", "VALIDATION", 400);
  }

  const table = await prisma.table.findFirst({
    where: { id: input.tableId, restaurantId: input.restaurantId, isActive: true },
  });
  if (!table) throw new AppError("Table not found", "NOT_FOUND", 404);

  if (input.source !== DiningSessionSource.CUSTOMER_QR) {
    const { getBlockingTableSession } = await import("@/lib/table-sessions");
    const pendingCustomer = await getBlockingTableSession(input.tableId);
    if (pendingCustomer) {
      throw new AppError(
        "This table has a pending or active customer QR session",
        "TABLE_HAS_ACTIVE_SESSION",
        409
      );
    }

    // Customer QR approval already holds a PENDING_APPROVAL table session that marks
    // the table OCCUPIED — skip that gate when converting the QR session into a dining session.
    await assertTableAvailableForSession(input.restaurantId, input.tableId, {
      reservationId: input.reservationId,
    });
  }

  // Shared reservation conflict gate (BLOCK / WARN + override). Status AVAILABLE ≠ always eligible.
  const conflictGate = await assertSessionReservationAllowed({
    restaurantId: input.restaurantId,
    tableId: input.tableId,
    excludeReservationId: input.reservationId,
    overrideAcknowledged: input.reservationOverrideAcknowledged,
  });

  let customerId: string | undefined;
  let guestName = input.customerName?.trim();
  const guestPhone = input.customerPhone?.replace(/\D/g, "").slice(-10) || "0000000000";

  if (input.customerPhone?.trim()) {
    const customer = await findOrCreateCustomer(
      input.restaurantId,
      input.customerPhone,
      input.customerName
    );
    if (customer) {
      customerId = customer.id;
      guestName = customer.name;
    }
  }

  const assignedStaffId = input.staffId ?? (input.actor.type === "staff" ? input.actor.staffId : null);

  const session = await prisma.$transaction(async (tx) => {
    const diningSession = await tx.diningSession.create({
      data: {
        restaurantId: input.restaurantId,
        tableId: input.tableId,
        staffId: assignedStaffId,
        customerId,
        guestName: guestName || null,
        guestPhone,
        guestCount: input.guestCount,
        notes: input.notes?.trim() || null,
        reservationId: input.reservationId || null,
        source: input.source ?? DiningSessionSource.STAFF,
        status: DiningSessionStatus.ACTIVE,
        startedByUserId: actorUserId(input.actor),
        startedByStaffId: input.actor.type === "staff" ? input.actor.staffId : actorStaffId(input.actor),
      },
    });

    return diningSession;
  });

  await appendSessionEvent({
    diningSessionId: session.id,
    type: "SESSION_STARTED",
    message: `Session started at table ${table.name || table.number}`,
    metadata: { tableId: table.id, guestCount: input.guestCount },
    actor: input.actor,
  });

  if (conflictGate.overridden) {
    await logReservationOverride({
      restaurantId: input.restaurantId,
      tableId: input.tableId,
      actor: input.actor,
      conflict: conflictGate.conflict,
    });
  }

  if (assignedStaffId) {
    await appendSessionEvent({
      diningSessionId: session.id,
      type: "WAITER_ASSIGNED",
      message: "Waiter assigned to session",
      metadata: { staffId: assignedStaffId },
      actor: input.actor,
    });
  }

  return session;
}

export async function requestBillService(
  sessionId: string,
  restaurantId: string,
  actor: OrderActor
) {
  await assertSessionStaffAccess(sessionId, restaurantId, actor);
  const session = await prisma.diningSession.findFirst({
    where: { id: sessionId, restaurantId, status: DiningSessionStatus.ACTIVE },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND", 404);

  await prisma.diningSession.update({
    where: { id: sessionId },
    data: { status: DiningSessionStatus.BILL_REQUESTED },
  });

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "BILL_REQUESTED",
    message: "Bill requested",
    actor,
  });
}

export async function callWaiterService(
  sessionId: string,
  restaurantId: string,
  actor: OrderActor
) {
  const session = await prisma.diningSession.findFirst({
    where: {
      id: sessionId,
      restaurantId,
      status: { in: [DiningSessionStatus.ACTIVE, DiningSessionStatus.BILL_REQUESTED] },
    },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND", 404);

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const recentCall = await prisma.diningSessionEvent.findFirst({
    where: {
      diningSessionId: sessionId,
      type: "WAITER_CALLED",
      createdAt: { gte: twoMinutesAgo },
    },
  });
  if (recentCall) {
    throw new AppError("Waiter was already notified recently", "RATE_LIMITED", 429);
  }

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "WAITER_CALLED",
    message: "Customer requested waiter assistance",
    actor,
  });
}

export async function closeDiningSessionService(
  sessionId: string,
  restaurantId: string,
  actor: OrderActor
) {
  await assertSessionStaffAccess(sessionId, restaurantId, actor);
  const session = await prisma.diningSession.findFirst({
    where: {
      id: sessionId,
      restaurantId,
      status: { in: [DiningSessionStatus.ACTIVE, DiningSessionStatus.BILL_REQUESTED] },
    },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND", 404);

  await prisma.$transaction(async (tx) => {
    await tx.diningSession.update({
      where: { id: sessionId },
      data: { status: DiningSessionStatus.CLOSED, closedAt: new Date() },
    });
    await tx.order.updateMany({
      where: {
        diningSessionId: sessionId,
        status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
      },
      data: { status: OrderStatus.COMPLETED },
    });
  });

  await syncOrderPaymentStatus(
    (
      await prisma.order.findFirst({
        where: { diningSessionId: sessionId, restaurantId },
        select: { id: true },
      })
    )?.id ?? ""
  );

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "SESSION_CLOSED",
    message: "Session closed",
    actor,
  });

  if (session.reservationId) {
    const { completeReservationFromSession } = await import(
      "@/features/reservations/reservation.service"
    );
    await completeReservationFromSession(session.reservationId, restaurantId);
  }
}

export async function reassignWaiterService(
  sessionId: string,
  restaurantId: string,
  newWaiterId: string | null,
  actor: OrderActor
) {
  const session = await prisma.diningSession.findFirst({
    where: {
      id: sessionId,
      restaurantId,
      status: { in: [DiningSessionStatus.ACTIVE, DiningSessionStatus.BILL_REQUESTED] },
    },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND", 404);

  if (newWaiterId) {
    const waiter = await prisma.staff.findFirst({
      where: { id: newWaiterId, restaurantId, isActive: true },
    });
    if (!waiter) throw new AppError("Waiter not found", "NOT_FOUND", 404);
  }

  await prisma.diningSession.update({
    where: { id: sessionId },
    data: { staffId: newWaiterId },
  });

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "WAITER_REASSIGNED",
    message: newWaiterId ? "Waiter reassigned" : "Waiter unassigned",
    metadata: { staffId: newWaiterId },
    actor,
  });
}

export async function updateSessionCustomerService(
  sessionId: string,
  restaurantId: string,
  data: { customerPhone?: string; customerName?: string; guestCount?: number; notes?: string },
  actor: OrderActor
) {
  const session = await prisma.diningSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND", 404);

  let customerId = session.customerId;
  if (data.customerPhone) {
    const customer = await findOrCreateCustomer(
      restaurantId,
      data.customerPhone,
      data.customerName
    );
    if (customer) customerId = customer.id;
  }

  await prisma.diningSession.update({
    where: { id: sessionId },
    data: {
      customerId,
      guestName: data.customerName?.trim() || session.guestName,
      guestPhone: data.customerPhone
        ? data.customerPhone.replace(/\D/g, "").slice(-10)
        : session.guestPhone,
      guestCount: data.guestCount ?? session.guestCount,
      notes: data.notes !== undefined ? data.notes.trim() || null : session.notes,
    },
  });

  if (data.guestCount !== undefined) {
    await appendSessionEvent({
      diningSessionId: sessionId,
      type: "GUEST_COUNT_UPDATED",
      message: `Guest count updated to ${data.guestCount}`,
      actor,
    });
  }

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "CUSTOMER_UPDATED",
    message: "Customer details updated",
    actor,
  });
}

export async function transferTableService(
  sessionId: string,
  restaurantId: string,
  newTableId: string,
  actor: OrderActor
) {
  if (!canOverrideTable(actor)) {
    throw new AppError("Insufficient permissions", "FORBIDDEN", 403);
  }

  const session = await prisma.diningSession.findFirst({
    where: {
      id: sessionId,
      restaurantId,
      status: { in: [DiningSessionStatus.ACTIVE, DiningSessionStatus.BILL_REQUESTED] },
    },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND", 404);

  const newTable = await prisma.table.findFirst({
    where: { id: newTableId, restaurantId, isActive: true },
  });
  if (!newTable) throw new AppError("Table not found", "NOT_FOUND", 404);

  const existingOnTarget = await getActiveDiningSessionForTable(newTableId);
  if (existingOnTarget && existingOnTarget.id !== sessionId) {
    throw new AppError("Target table has an active session", "TABLE_HAS_ACTIVE_SESSION", 409);
  }

  const { assertTableAvailableForSession } = await import(
    "@/features/tables/table-availability.service"
  );
  await assertTableAvailableForSession(restaurantId, newTableId);

  await prisma.$transaction(async (tx) => {
    await tx.diningSession.update({
      where: { id: sessionId },
      data: { tableId: newTableId },
    });
    await tx.order.updateMany({
      where: { diningSessionId: sessionId },
      data: { tableId: newTableId },
    });
  });

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "TABLE_TRANSFERRED",
    message: `Transferred to ${newTable.name || `Table ${newTable.number}`}`,
    metadata: { fromTableId: session.tableId, toTableId: newTableId },
    actor,
  });
}

export async function getActiveDiningSessions(restaurantId: string) {
  const sessions = await prisma.diningSession.findMany({
    where: {
      restaurantId,
      status: { in: [DiningSessionStatus.ACTIVE, DiningSessionStatus.BILL_REQUESTED] },
    },
    select: {
      id: true,
      status: true,
      guestCount: true,
      guestName: true,
      startedAt: true,
      source: true,
      table: { select: { id: true, name: true, number: true } },
      staff: { select: { id: true, displayName: true } },
      customer: { select: { id: true, name: true, phone: true, visitCount: true, isVip: true } },
      reservation: { select: { id: true, guestName: true, reservedAt: true, status: true } },
      orders: {
        where: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.COMPLETED] } },
        select: {
          id: true,
          total: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
      },
      events: {
        where: {
          type: "WAITER_CALLED",
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, type: true, createdAt: true },
      },
    },
    orderBy: { startedAt: "desc" },
  });

  // Heal duplicate open orders so floor cards show one total, not a sum of races.
  const multi = sessions.filter((s) => s.orders.length > 1);
  if (multi.length === 0) {
    return sessions.map((s) => ({
      ...s,
      orders: s.orders.slice(0, 1),
    }));
  }

  await Promise.all(multi.map((s) => consolidateOpenOrdersForSession(s.id, restaurantId)));

  return prisma.diningSession.findMany({
    where: {
      restaurantId,
      status: { in: [DiningSessionStatus.ACTIVE, DiningSessionStatus.BILL_REQUESTED] },
    },
    select: {
      id: true,
      status: true,
      guestCount: true,
      guestName: true,
      startedAt: true,
      source: true,
      table: { select: { id: true, name: true, number: true } },
      staff: { select: { id: true, displayName: true } },
      customer: { select: { id: true, name: true, phone: true, visitCount: true, isVip: true } },
      reservation: { select: { id: true, guestName: true, reservedAt: true, status: true } },
      orders: {
        where: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.COMPLETED] } },
        select: {
          id: true,
          total: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      events: {
        where: {
          type: "WAITER_CALLED",
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, type: true, createdAt: true },
      },
    },
    orderBy: { startedAt: "desc" },
  });
}

export async function getRecentClosedSessions(restaurantId: string, limit = 50) {
  return prisma.diningSession.findMany({
    where: {
      restaurantId,
      status: { in: [DiningSessionStatus.CLOSED, DiningSessionStatus.CANCELLED] },
    },
    include: {
      table: true,
      staff: { select: { displayName: true } },
      customer: { select: { name: true, phone: true } },
      orders: {
        where: { status: { not: OrderStatus.CANCELLED } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { total: true, status: true, orderNumber: true },
      },
      payments: { orderBy: { createdAt: "desc" }, take: 1, select: { amount: true, method: true } },
    },
    orderBy: { closedAt: "desc" },
    take: limit,
  });
}

export async function getDiningSessionDetail(sessionId: string, restaurantId: string) {
  await consolidateOpenOrdersForSession(sessionId, restaurantId);

  const session = await prisma.diningSession.findFirst({
    where: { id: sessionId, restaurantId },
    include: {
      table: true,
      staff: { select: { id: true, displayName: true } },
      customer: {
        include: { membership: { select: { name: true, discountPercent: true } } },
      },
      reservation: true,
      orders: {
        where: { status: { not: OrderStatus.CANCELLED } },
        orderBy: { createdAt: "asc" },
        include: {
          items: { orderBy: { createdAt: "asc" } },
          revisions: {
            orderBy: { revisionNumber: "asc" },
            include: { submittedBy: { select: { displayName: true } } },
          },
        },
      },
      events: {
        orderBy: { createdAt: "asc" },
        include: {
          actorUser: { select: { name: true } },
          actorStaff: { select: { displayName: true } },
        },
      },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!session) throw new AppError("Session not found", "NOT_FOUND", 404);
  return session;
}

export function deriveSessionOrderStatus(session: {
  status: DiningSessionStatus;
  orders: Array<{ status: OrderStatus; items: Array<{ kitchenStatus: OrderItemKitchenStatus }> }>;
}): string {
  if (session.status === DiningSessionStatus.BILL_REQUESTED) return "Bill Requested";
  const order = session.orders[0];
  if (!order) return "Active";
  const items = order.items;
  if (items.some((i) => i.kitchenStatus === OrderItemKitchenStatus.PREPARING)) return "Preparing";
  if (items.some((i) => i.kitchenStatus === OrderItemKitchenStatus.SENT)) return "Sent to Kitchen";
  if (items.every((i) => i.kitchenStatus === OrderItemKitchenStatus.SERVED)) return "Served";
  if (order.status === OrderStatus.READY) return "Ready";
  return order.status.charAt(0) + order.status.slice(1).toLowerCase().replace("_", " ");
}

export function sessionElapsedMinutes(startedAt: Date): number {
  return Math.floor((Date.now() - startedAt.getTime()) / 60000);
}

export async function getTablesForSessionWizard(restaurantId: string) {
  const [tables, availability] = await Promise.all([
    prisma.table.findMany({
      where: { restaurantId, isActive: true },
      orderBy: { number: "asc" },
    }),
    getRestaurantTablesAvailability(restaurantId),
  ]);

  return tables.map((table) => {
    const snapshot = availability.get(table.id);

    return {
      ...table,
      activeSessionId: snapshot?.activeSession?.id ?? null,
      displayStatus: snapshot?.status ?? "AVAILABLE",
      canStartSession: snapshot?.canStartSession ?? true,
      blockReason: snapshot?.blockReason ?? null,
      blockingReservation: snapshot?.blockingReservation ?? null,
    };
  });
}

export async function recordSessionPayment(
  sessionId: string,
  restaurantId: string,
  amount: number,
  method: "CASH" | "CARD" | "UPI" | "OTHER",
  actor: OrderActor
) {
  const session = await prisma.diningSession.findFirst({
    where: { id: sessionId, restaurantId },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND", 404);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new AppError("Payment amount must be greater than zero", "VALIDATION", 400);
  }

  const order = await prisma.order.findFirst({
    where: { diningSessionId: sessionId, restaurantId },
    select: {
      id: true,
      total: true,
      status: true,
      paymentStatus: true,
      payments: { where: { status: "COMPLETED" }, select: { amount: true } },
      diningSession: {
        select: {
          payments: { where: { status: "COMPLETED" }, select: { amount: true } },
        },
      },
    },
  });

  let paymentAmount = Math.round(amount);
  if (order) {
    const paid = sumCompletedPayments(order);
    const remaining = Math.max(0, order.total - paid);
    if (remaining <= 0) {
      throw new AppError("Order is already fully paid", "VALIDATION", 400);
    }
    if (paymentAmount > remaining) {
      paymentAmount = remaining;
    }
  }

  const payment = await prisma.sessionPayment.create({
    data: {
      restaurantId,
      diningSessionId: sessionId,
      amount: paymentAmount,
      method,
      status: "COMPLETED",
    },
  });

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "PAYMENT_COMPLETED",
    message: `Payment of ₹${(paymentAmount / 100).toFixed(2)} recorded`,
    metadata: { paymentId: payment.id, method },
    actor,
  });

  if (order) await syncOrderPaymentStatus(order.id);

  return payment;
}

export async function applyOrderDiscountService(
  sessionId: string,
  restaurantId: string,
  discountAmount: number,
  actor: OrderActor
) {
  const order = await prisma.order.findFirst({
    where: {
      diningSessionId: sessionId,
      restaurantId,
      status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
    },
  });
  if (!order) throw new AppError("No active order", "NOT_FOUND", 404);

  if (!Number.isFinite(discountAmount) || discountAmount < 0) {
    throw new AppError("Invalid discount amount", "VALIDATION", 400);
  }

  const cappedDiscount = Math.min(Math.round(discountAmount), order.subtotal);

  const taxSettings = await getRestaurantTaxSettings(restaurantId);
  const total = computeOrderTotal(
    order.subtotal,
    order.taxAmount,
    cappedDiscount + (order.promotionDiscountAmount ?? 0),
    taxSettings.taxInclusive
  );

  await prisma.order.update({
    where: { id: order.id },
    data: { discountAmount: cappedDiscount, total },
  });

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "DISCOUNT_APPLIED",
    message: `Discount of ₹${(cappedDiscount / 100).toFixed(2)} applied`,
    metadata: { discountAmount: cappedDiscount },
    actor,
  });
}

export async function checkoutSessionService(
  sessionId: string,
  restaurantId: string,
  actor: OrderActor,
  input: {
    discountType: "PERCENT" | "FLAT" | "NONE";
    discountValue: number;
    loyaltyPointsRedeemed?: number;
    paymentMethod: "CASH" | "CARD" | "UPI" | "OTHER";
  }
) {
  await assertSessionStaffAccess(sessionId, restaurantId, actor);
  const loyaltySettings = await getRestaurantLoyaltySettings(restaurantId);

  const session = await prisma.diningSession.findFirst({
    where: {
      id: sessionId,
      restaurantId,
      status: { in: [DiningSessionStatus.ACTIVE, DiningSessionStatus.BILL_REQUESTED] },
    },
    include: { customer: true },
  });
  if (!session) throw new AppError("Session not found", "NOT_FOUND", 404);

  const order = await prisma.order.findFirst({
    where: {
      diningSessionId: sessionId,
      restaurantId,
      status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
    },
  });
  if (!order) throw new AppError("No active order", "NOT_FOUND", 404);

  // Drop unsent drafts so they are never billed; billable total is kitchen-sent only.
  await prisma.orderItem.updateMany({
    where: {
      orderId: order.id,
      kitchenStatus: OrderItemKitchenStatus.PENDING,
    },
    data: { kitchenStatus: OrderItemKitchenStatus.CANCELLED },
  });

  const billed = await refreshBillableOrderTotal(order.id);
  if (!billed || billed.subtotal <= 0) {
    throw new AppError(
      "Nothing to checkout — send items to kitchen first",
      "VALIDATION",
      400
    );
  }

  let manualDiscountPaise = 0;
  if (input.discountType === "FLAT") {
    manualDiscountPaise = Math.max(0, input.discountValue);
  } else if (input.discountType === "PERCENT") {
    manualDiscountPaise = Math.round((billed.subtotal * input.discountValue) / 100);
  }

  const grossBill = billed.total + billed.discountAmount;
  // billed.total already subtracts promotionDiscountAmount; do not double-count.
  const preLoyaltyTotal = Math.max(0, grossBill - manualDiscountPaise);

  let pointsRedeemed = 0;
  let loyaltyDiscountPaise = 0;
  if (
    loyaltySettings.enabled &&
    input.loyaltyPointsRedeemed &&
    input.loyaltyPointsRedeemed > 0 &&
    session.customer
  ) {
    pointsRedeemed = Math.min(input.loyaltyPointsRedeemed, session.customer.loyaltyPoints);
    loyaltyDiscountPaise = loyaltyPointsToPaise(pointsRedeemed, loyaltySettings.pointValueInRupees);
    loyaltyDiscountPaise = Math.min(loyaltyDiscountPaise, preLoyaltyTotal);
  }

  const finalTotal = Math.max(0, preLoyaltyTotal - loyaltyDiscountPaise);
  const totalDiscount = manualDiscountPaise + loyaltyDiscountPaise;
  const earnedPoints = loyaltySettings.enabled
    ? computeEarnedPoints(preLoyaltyTotal, loyaltySettings.earnPercentOfBill)
    : 0;

  const payment = await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { discountAmount: totalDiscount, total: finalTotal },
    });

    if (session.customerId) {
      const newPoints =
        (session.customer?.loyaltyPoints ?? 0) - pointsRedeemed + earnedPoints;
      await tx.customer.update({
        where: { id: session.customerId },
        data: {
          loyaltyPoints: Math.max(0, newPoints),
          visitCount: { increment: 1 },
          totalSpend: { increment: finalTotal },
        },
      });
    }

    const createdPayment = await tx.sessionPayment.create({
      data: {
        restaurantId,
        diningSessionId: sessionId,
        amount: finalTotal,
        method: input.paymentMethod,
        status: "COMPLETED",
      },
    });

    await tx.diningSession.update({
      where: { id: sessionId },
      data: { status: DiningSessionStatus.CLOSED, closedAt: new Date() },
    });

    await tx.order.updateMany({
      where: {
        diningSessionId: sessionId,
        status: { notIn: [OrderStatus.COMPLETED, OrderStatus.CANCELLED] },
      },
      data: { status: OrderStatus.COMPLETED, paymentStatus: OrderPaymentStatus.PAID },
    });

    return createdPayment;
  });

  await syncOrderPaymentStatus(order.id);

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "DISCOUNT_APPLIED",
    message: `Checkout discount ₹${(totalDiscount / 100).toFixed(2)}`,
    metadata: {
      manualDiscountPaise,
      loyaltyDiscountPaise,
      pointsRedeemed,
      earnedPoints,
    },
    actor,
  });

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "PAYMENT_COMPLETED",
    message: `Payment of ₹${(finalTotal / 100).toFixed(2)} collected`,
    metadata: { paymentId: payment.id, method: input.paymentMethod },
    actor,
  });

  await appendSessionEvent({
    diningSessionId: sessionId,
    type: "SESSION_CLOSED",
    message: "Session closed after checkout",
    actor,
  });

  if (session.reservationId) {
    const { completeReservationFromSession } = await import(
      "@/features/reservations/reservation.service"
    );
    await completeReservationFromSession(session.reservationId, restaurantId);
  }

  const { enqueueAutoPrintBill } = await import("@/features/printing/printer.service");
  enqueueAutoPrintBill(restaurantId, order.id, sessionId);

  return { payment, finalTotal, pointsRedeemed, earnedPoints };
}
