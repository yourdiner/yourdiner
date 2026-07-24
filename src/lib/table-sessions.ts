import { randomBytes } from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import {
  DiningSessionSource,
  DiningSessionStatus,
  OrderStatus,
  ReservationStatus,
  TableSessionStatus,
} from "@prisma/client";
import { getRestaurantOrderSettings } from "@/lib/order-settings";
import {
  clearCustomerSessionCookie,
  CUSTOMER_TABLE_SESSION_COOKIE,
  setCustomerSessionCookie,
} from "@/lib/customer-session-cookie";
import { startDiningSessionService } from "@/features/dining-session/session.service";
import { createCustomerActor } from "@/features/dining-session/auth";
import { findOrCreateCustomer } from "@/features/dining-session/customer.service";
import { appendSessionEvent } from "@/features/dining-session/timeline.service";
import { terminalOrderStatusFilter } from "@/lib/prisma-filters";
import type { OrderActor } from "@/features/dining-session/auth";

const DEFAULT_INACTIVITY_MINUTES = 120;
const SESSION_TOKEN_TTL_HOURS = 12;

export const BLOCKING_TABLE_SESSION_STATUSES: TableSessionStatus[] = [
  TableSessionStatus.PENDING_APPROVAL,
  TableSessionStatus.ACTIVE,
];

export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export type CustomerTableSessionContext = {
  tableSessionId: string;
  sessionToken: string;
  status: TableSessionStatus;
  restaurantId: string;
  tableId: string;
  tableNumber: number;
  tableName: string;
  qrSlug: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  diningSessionId: string | null;
  reservationId: string | null;
  firstOrderApprovedAt: Date | null;
};

async function getInactivityMinutes(restaurantId: string): Promise<number> {
  const settings = await getRestaurantOrderSettings(restaurantId);
  return settings.customerSessionInactivityMinutes ?? DEFAULT_INACTIVITY_MINUTES;
}

function sessionExpiryFromNow(hours = SESSION_TOKEN_TTL_HOURS): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function getSessionTokenFromRequest(): Promise<string | null> {
  const headersList = await headers();
  const headerToken = headersList.get("x-customer-session-token");
  if (headerToken) return headerToken;

  const { getCustomerSessionTokenFromRequest } = await import("@/lib/customer-session-cookie");
  return getCustomerSessionTokenFromRequest();
}

export async function getBlockingTableSession(tableId: string) {
  return prisma.tableSession.findFirst({
    where: {
      tableId,
      status: { in: BLOCKING_TABLE_SESSION_STATUSES },
      isActive: true,
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      table: { select: { id: true, number: true, name: true, qrSlug: true } },
      diningSession: { select: { id: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPendingTableSessions(restaurantId: string) {
  return prisma.tableSession.findMany({
    where: {
      restaurantId,
      status: TableSessionStatus.PENDING_APPROVAL,
      isActive: true,
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      table: { select: { id: true, number: true, name: true, qrSlug: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function createPendingCustomerSession(input: {
  restaurantId: string;
  tableId: string;
  phone: string;
  name: string;
  deviceId?: string;
}): Promise<CustomerTableSessionContext> {
  const normalizedPhone = input.phone.replace(/\D/g, "").slice(-10);
  if (normalizedPhone.length < 10) {
    throw new AppError("Phone number must be 10 digits", "VALIDATION", 400);
  }
  const customerName = input.name.trim();
  if (!customerName) {
    throw new AppError("Name is required", "VALIDATION", 400);
  }

  const {
    findCustomerCheckInReservation,
    CUSTOMER_QR_RESERVATION_BLOCKED_MESSAGE,
  } = await import("@/features/reservations/customer-qr-check-in");
  const {
    getTableAvailability,
    assertTableAvailableForSession,
  } = await import("@/features/tables/table-availability.service");

  const matchedReservation = await findCustomerCheckInReservation({
    restaurantId: input.restaurantId,
    tableId: input.tableId,
    phone: normalizedPhone,
  });

  if (matchedReservation) {
    await assertTableAvailableForSession(input.restaurantId, input.tableId, {
      reservationId: matchedReservation.id,
    });
  } else {
    const availability = await getTableAvailability(
      input.restaurantId,
      input.tableId
    );
    if (availability?.status === "RESERVED") {
      throw new AppError(
        CUSTOMER_QR_RESERVATION_BLOCKED_MESSAGE,
        "TABLE_RESERVATION_BLOCKED",
        409
      );
    }
    await assertTableAvailableForSession(input.restaurantId, input.tableId);
  }

  const inactivityMinutes = await getInactivityMinutes(input.restaurantId);
  const expiresAt = new Date(Date.now() + inactivityMinutes * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const blocking = await tx.tableSession.findFirst({
      where: {
        tableId: input.tableId,
        status: { in: BLOCKING_TABLE_SESSION_STATUSES },
        isActive: true,
      },
    });
    if (blocking) {
      throw new AppError(
        "This table already has an active dining session. Please contact restaurant staff.",
        "TABLE_HAS_ACTIVE_SESSION",
        409
      );
    }

    const customer = await findOrCreateCustomer(input.restaurantId, normalizedPhone, customerName);
    const sessionToken = generateSessionToken();

    const tableSession = await tx.tableSession.create({
      data: {
        restaurantId: input.restaurantId,
        tableId: input.tableId,
        customerId: customer?.id,
        sessionToken,
        status: TableSessionStatus.PENDING_APPROVAL,
        deviceId: input.deviceId,
        lastActivityAt: new Date(),
        expiresAt,
        isActive: true,
        reservationId: matchedReservation?.id ?? null,
      },
      include: {
        table: { select: { number: true, name: true, qrSlug: true } },
        customer: { select: { id: true, name: true, phone: true } },
      },
    });

    return tableSession;
  });

  await setCustomerSessionCookie(result.sessionToken, sessionExpiryFromNow());

  return {
    tableSessionId: result.id,
    sessionToken: result.sessionToken,
    status: result.status,
    restaurantId: result.restaurantId,
    tableId: result.tableId,
    tableNumber: result.table.number,
    tableName: result.table.name,
    qrSlug: result.table.qrSlug,
    customerId: result.customerId,
    customerName: result.customer?.name ?? customerName,
    customerPhone: result.customer?.phone ?? normalizedPhone,
    diningSessionId: null,
    reservationId: result.reservationId,
    firstOrderApprovedAt: null,
  };
}

async function expireTableSessionIfInactive(
  session: {
    id: string;
    restaurantId: string;
    diningSessionId: string | null;
    lastActivityAt: Date;
    expiresAt: Date | null;
  },
  inactivityMinutes: number
): Promise<boolean> {
  const deadline = session.expiresAt
    ? session.expiresAt
    : new Date(session.lastActivityAt.getTime() + inactivityMinutes * 60 * 1000);

  if (deadline > new Date()) return false;

  await prisma.$transaction(async (tx) => {
    await tx.tableSession.update({
      where: { id: session.id },
      data: {
        status: TableSessionStatus.EXPIRED,
        isActive: false,
        endedAt: new Date(),
      },
    });

    if (session.diningSessionId) {
      await tx.diningSession.update({
        where: { id: session.diningSessionId },
        data: { status: DiningSessionStatus.CLOSED, closedAt: new Date() },
      });
    }
  });

  return true;
}

export async function loadCustomerTableSessionByToken(
  sessionToken: string,
  restaurantId: string
): Promise<CustomerTableSessionContext | null> {
  const session = await prisma.tableSession.findFirst({
    where: { sessionToken, restaurantId, isActive: true },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      table: { select: { id: true, number: true, name: true, qrSlug: true } },
    },
  });

  if (!session) return null;

  const inactivityMinutes = await getInactivityMinutes(restaurantId);
  if (
    session.status === TableSessionStatus.ACTIVE ||
    session.status === TableSessionStatus.PENDING_APPROVAL
  ) {
    const expired = await expireTableSessionIfInactive(session, inactivityMinutes);
    if (expired) return null;
  }

  if (
    session.status === TableSessionStatus.CLOSED ||
    session.status === TableSessionStatus.REJECTED ||
    session.status === TableSessionStatus.EXPIRED
  ) {
    return null;
  }

  return {
    tableSessionId: session.id,
    sessionToken: session.sessionToken,
    status: session.status,
    restaurantId: session.restaurantId,
    tableId: session.tableId,
    tableNumber: session.table.number,
    tableName: session.table.name,
    qrSlug: session.table.qrSlug,
    customerId: session.customerId,
    customerName: session.customer?.name ?? null,
    customerPhone: session.customer?.phone ?? null,
    diningSessionId: session.diningSessionId,
    reservationId: session.reservationId,
    firstOrderApprovedAt: session.firstOrderApprovedAt,
  };
}

const TERMINAL_TABLE_SESSION_STATUSES: TableSessionStatus[] = [
  TableSessionStatus.REJECTED,
  TableSessionStatus.EXPIRED,
  TableSessionStatus.CLOSED,
];

export async function resolveTerminalTableSessionByToken(
  sessionToken: string,
  restaurantId: string,
  tableId: string
): Promise<{ status: TableSessionStatus } | null> {
  const session = await prisma.tableSession.findFirst({
    where: { sessionToken, restaurantId, tableId },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });

  if (!session || !TERMINAL_TABLE_SESSION_STATUSES.includes(session.status)) {
    return null;
  }

  return { status: session.status };
}

export async function touchTableSession(sessionId: string) {
  const inactivityMinutes = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: { restaurantId: true },
  });
  if (!inactivityMinutes) return;

  const minutes = await getInactivityMinutes(inactivityMinutes.restaurantId);
  const expiresAt = new Date(Date.now() + minutes * 60 * 1000);

  await prisma.tableSession.update({
    where: { id: sessionId },
    data: { lastActivityAt: new Date(), expiresAt },
  });
}

export async function requireCustomerTableSession(
  restaurantId: string,
  options?: { requireActive?: boolean; tableId?: string }
): Promise<CustomerTableSessionContext> {
  const sessionToken = await getSessionTokenFromRequest();
  if (!sessionToken) {
    throw new AppError("Session required", "SESSION_ENDED", 401);
  }

  const session = await loadCustomerTableSessionByToken(sessionToken, restaurantId);
  if (!session) {
    await clearCustomerSessionCookie();
    throw new AppError(
      "Your dining session has ended. Please scan the QR again.",
      "SESSION_ENDED",
      403
    );
  }

  if (options?.tableId && session.tableId !== options.tableId) {
    throw new AppError("Session does not match table", "FORBIDDEN", 403);
  }

  if (options?.requireActive && session.status !== TableSessionStatus.ACTIVE) {
    if (session.status === TableSessionStatus.PENDING_APPROVAL) {
      throw new AppError("Waiting for restaurant approval", "PENDING_APPROVAL", 403);
    }
    if (session.status === TableSessionStatus.REJECTED) {
      throw new AppError("Please contact restaurant staff.", "SESSION_REJECTED", 403);
    }
    throw new AppError(
      "Your dining session has ended. Please scan the QR again.",
      "SESSION_ENDED",
      403
    );
  }

  await touchTableSession(session.tableSessionId);
  return session;
}

export async function approveTableSession(
  tableSessionId: string,
  restaurantId: string,
  actor: OrderActor
) {
  const tableSession = await prisma.tableSession.findFirst({
    where: {
      id: tableSessionId,
      restaurantId,
      status: TableSessionStatus.PENDING_APPROVAL,
      isActive: true,
    },
    include: { customer: true, table: true, reservation: true },
  });

  if (!tableSession) {
    throw new AppError("Pending session not found", "NOT_FOUND", 404);
  }

  const customerName =
    tableSession.customer?.name ?? tableSession.customer?.phone ?? "Guest";
  const customerPhone = tableSession.customer?.phone ?? "";
  const reservationId = tableSession.reservationId;
  const guestCount = tableSession.reservation?.guestCount ?? 1;

  const diningSession = await startDiningSessionService({
    restaurantId,
    tableId: tableSession.tableId,
    guestCount,
    customerPhone,
    customerName,
    actor,
    source: DiningSessionSource.CUSTOMER_QR,
    reservationId: reservationId ?? undefined,
  });

  await prisma.$transaction(async (tx) => {
    await tx.tableSession.update({
      where: { id: tableSessionId },
      data: {
        status: TableSessionStatus.ACTIVE,
        approvedAt: new Date(),
        // Table approval is enough; customer orders go straight to kitchen.
        firstOrderApprovedAt: new Date(),
        diningSessionId: diningSession.id,
        lastActivityAt: new Date(),
      },
    });

    await tx.diningSession.update({
      where: { id: diningSession.id },
      data: {
        source: DiningSessionSource.CUSTOMER_QR,
        ...(reservationId ? { reservationId } : {}),
      },
    });

    if (reservationId) {
      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: ReservationStatus.DINING,
          checkedInAt: new Date(),
          diningSessionId: diningSession.id,
          customerId: diningSession.customerId,
        },
      });
    }
  });

  if (reservationId) {
    const { logReservationEvent } = await import(
      "@/features/reservations/reservation-event.service"
    );
    await logReservationEvent({
      reservationId,
      restaurantId,
      type: "CHECKED_IN",
      message: `Checked in via customer QR at ${tableSession.table?.name || `Table ${tableSession.table?.number}`}`,
      actor,
    });
    await logReservationEvent({
      reservationId,
      restaurantId,
      type: "SESSION_LINKED",
      message: "Linked to dining session from customer QR approval",
      metadata: { diningSessionId: diningSession.id },
      actor,
    });
  }

  await appendSessionEvent({
    diningSessionId: diningSession.id,
    type: "SESSION_APPROVED",
    message: "Customer session approved by staff",
    actor,
  });

  return diningSession;
}

export async function rejectTableSession(
  tableSessionId: string,
  restaurantId: string,
  actor: OrderActor
) {
  const tableSession = await prisma.tableSession.findFirst({
    where: {
      id: tableSessionId,
      restaurantId,
      status: TableSessionStatus.PENDING_APPROVAL,
      isActive: true,
    },
  });

  if (!tableSession) {
    throw new AppError("Pending session not found", "NOT_FOUND", 404);
  }

  await prisma.tableSession.update({
    where: { id: tableSessionId },
    data: {
      status: TableSessionStatus.REJECTED,
      rejectedAt: new Date(),
      isActive: false,
      endedAt: new Date(),
    },
  });

  if (tableSession.diningSessionId) {
    await prisma.diningSession.update({
      where: { id: tableSession.diningSessionId },
      data: { status: DiningSessionStatus.CANCELLED, closedAt: new Date() },
    });
    await appendSessionEvent({
      diningSessionId: tableSession.diningSessionId,
      type: "SESSION_REJECTED",
      message: "Customer session rejected by staff",
      actor,
    });
  }
}

export async function resetTableCustomerSession(
  tableId: string,
  restaurantId: string,
  actor: OrderActor
) {
  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId, isActive: true },
    select: { id: true },
  });
  if (!table) throw new AppError("Table not found", "NOT_FOUND", 404);

  const [blocking, activeDining] = await Promise.all([
    getBlockingTableSession(tableId),
    prisma.diningSession.findFirst({
      where: {
        tableId,
        restaurantId,
        status: {
          in: [DiningSessionStatus.ACTIVE, DiningSessionStatus.BILL_REQUESTED],
        },
      },
      select: { id: true, reservationId: true },
    }),
  ]);

  const diningSessionId = blocking?.diningSessionId ?? activeDining?.id ?? null;
  const reservationId = activeDining?.reservationId ?? null;

  if (!blocking && !diningSessionId) {
    throw new AppError("No active session on this table", "NOT_FOUND", 404);
  }

  await prisma.$transaction(async (tx) => {
    if (blocking) {
      await tx.tableSession.updateMany({
        where: {
          tableId,
          restaurantId,
          status: { in: BLOCKING_TABLE_SESSION_STATUSES },
          isActive: true,
        },
        data: {
          status: TableSessionStatus.CLOSED,
          isActive: false,
          endedAt: new Date(),
        },
      });
    }

    if (diningSessionId) {
      await tx.diningSession.update({
        where: { id: diningSessionId },
        data: { status: DiningSessionStatus.CLOSED, closedAt: new Date() },
      });

      await tx.order.updateMany({
        where: {
          diningSessionId,
          NOT: terminalOrderStatusFilter(),
        },
        data: { status: OrderStatus.CANCELLED },
      });
    }
  });

  if (diningSessionId) {
    await appendSessionEvent({
      diningSessionId,
      type: "SESSION_CLOSED",
      message: blocking
        ? "Table reset by staff — customer session ended"
        : "Table reset by staff — dining session ended",
      actor,
    });

    if (reservationId) {
      const { completeReservationFromSession } = await import(
        "@/features/reservations/reservation.service"
      );
      await completeReservationFromSession(reservationId, restaurantId);
    }
  }
}

export async function expireInactiveTableSessions(restaurantId?: string) {
  const sessions = await prisma.tableSession.findMany({
    where: {
      ...(restaurantId ? { restaurantId } : {}),
      status: { in: [TableSessionStatus.PENDING_APPROVAL, TableSessionStatus.ACTIVE] },
      isActive: true,
    },
    select: {
      id: true,
      restaurantId: true,
      diningSessionId: true,
      lastActivityAt: true,
      expiresAt: true,
    },
  });

  let expired = 0;
  const uniqueRestaurantIds = [...new Set(sessions.map((s) => s.restaurantId))];
  const minutesByRestaurant = new Map<string, number>();
  await Promise.all(
    uniqueRestaurantIds.map(async (id) => {
      minutesByRestaurant.set(id, await getInactivityMinutes(id));
    })
  );

  for (const session of sessions) {
    const minutes =
      minutesByRestaurant.get(session.restaurantId) ?? DEFAULT_INACTIVITY_MINUTES;
    const didExpire = await expireTableSessionIfInactive(session, minutes);
    if (didExpire) expired++;
  }

  return { expired };
}

/** @deprecated Legacy QR token validation — use customer session token instead */
export async function validateTableSession(restaurantId: string, token: string) {
  const session = await prisma.tableSession.findFirst({
    where: { sessionToken: token, restaurantId },
    include: { table: true },
  });
  if (!session?.table) {
    throw new AppError("Session expired or invalid", "SESSION_EXPIRED", 403);
  }
  return {
    sessionId: session.id,
    tableId: session.tableId,
    tableName: session.table.name,
    tableNumber: session.table.number,
    restaurantId: session.restaurantId,
    expiresAt: session.expiresAt ?? new Date(),
  };
}

export { CUSTOMER_TABLE_SESSION_COOKIE };
