import type { Prisma } from "@prisma/client";

/** Scalar OR filters avoid Prisma `in` enum validation issues under Next.js bundling. */
export function tableSessionStatusOr(
  statuses: readonly Prisma.EnumTableSessionStatusFilter["equals"][]
): Pick<Prisma.TableSessionWhereInput, "OR"> {
  return {
    OR: statuses.map((status) => ({ status })),
  };
}

export function reservationStatusOr(
  statuses: readonly Prisma.EnumReservationStatusFilter["equals"][]
): Pick<Prisma.ReservationWhereInput, "OR"> {
  return {
    OR: statuses.map((status) => ({ status })),
  };
}

export function reservationStatusNotIn(
  statuses: readonly Prisma.EnumReservationStatusFilter["equals"][]
): Pick<Prisma.ReservationWhereInput, "AND"> {
  return {
    AND: statuses.map((status) => ({ NOT: { status } })),
  };
}

export function diningSessionStatusOr(
  statuses: readonly Prisma.EnumDiningSessionStatusFilter["equals"][]
): Pick<Prisma.DiningSessionWhereInput, "OR"> {
  return {
    OR: statuses.map((status) => ({ status })),
  };
}

export function orderStatusOr(
  statuses: readonly Prisma.EnumOrderStatusFilter["equals"][]
): Pick<Prisma.OrderWhereInput, "OR"> {
  return {
    OR: statuses.map((status) => ({ status })),
  };
}

export function orderStatusNotIn(
  statuses: readonly Prisma.EnumOrderStatusFilter["equals"][]
): Pick<Prisma.OrderWhereInput, "AND"> {
  return {
    AND: statuses.map((status) => ({ NOT: { status } })),
  };
}

export function kitchenOrderStatusOr(
  statuses: readonly Prisma.EnumKitchenOrderStatusFilter["equals"][]
): Pick<Prisma.KitchenOrderWhereInput, "OR"> {
  return {
    OR: statuses.map((status) => ({ status })),
  };
}

export function orderItemKitchenStatusOr(
  statuses: readonly Prisma.EnumOrderItemKitchenStatusFilter["equals"][]
): Pick<Prisma.OrderItemWhereInput, "OR"> {
  return {
    OR: statuses.map((status) => ({ kitchenStatus: status })),
  };
}

export function staffRoleOr(
  statuses: readonly Prisma.EnumStaffRoleFilter["equals"][]
): Pick<Prisma.StaffWhereInput, "OR"> {
  return {
    OR: statuses.map((status) => ({ role: status })),
  };
}

export function tableStatusOr(
  statuses: readonly Prisma.EnumTableStatusFilter["equals"][]
): Pick<Prisma.TableWhereInput, "OR"> {
  return {
    OR: statuses.map((status) => ({ status })),
  };
}

export const BLOCKING_RESERVATION_STATUS_LIST = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "DINING",
] as const satisfies readonly Prisma.EnumReservationStatusFilter["equals"][];

export const UPCOMING_RESERVATION_STATUS_LIST = ["PENDING", "CONFIRMED"] as const;

export const EXCLUDED_CALENDAR_RESERVATION_STATUS_LIST = [
  "CANCELLED",
  "NO_SHOW",
] as const;

export const ACTIVE_DINING_SESSION_STATUS_LIST = ["ACTIVE", "BILL_REQUESTED"] as const;

export const BLOCKING_TABLE_SESSION_STATUS_LIST = ["PENDING_APPROVAL", "ACTIVE"] as const;

export const TERMINAL_ORDER_STATUS_LIST = ["COMPLETED", "CANCELLED"] as const;

export const CANCELLED_ORDER_STATUS_LIST = ["CANCELLED"] as const;

/**
 * Narrow kitchen-pipeline statuses. Do NOT use for Dashboard "Active Orders"
 * or floor open-order totals — use `terminalOrderStatusFilter` / `isOrderActive`.
 */
export const IN_PROGRESS_ORDER_STATUS_LIST = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
] as const;

export const OPEN_ORDER_STATUS_LIST = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
] as const;

export const OPEN_KITCHEN_ORDER_STATUS_LIST = ["QUEUED", "COOKING", "READY"] as const;

export const ACTIVE_KITCHEN_ITEM_STATUS_LIST = ["SENT", "PREPARING", "READY"] as const;

export const ACTIVE_TABLE_STATUS_LIST = ["AVAILABLE", "CLEANING"] as const;

export const ADMIN_STAFF_ROLE_LIST = ["OWNER", "MANAGER"] as const;

export const WAITER_STAFF_ROLE_LIST = ["STAFF", "CASHIER"] as const;

export const KITCHEN_STAFF_ROLE_LIST = ["STAFF", "CASHIER", "KITCHEN"] as const;

export const blockingReservationStatusFilter = () =>
  reservationStatusOr(BLOCKING_RESERVATION_STATUS_LIST);

export const upcomingReservationStatusFilter = () =>
  reservationStatusOr(UPCOMING_RESERVATION_STATUS_LIST);

export const excludedCalendarReservationStatusFilter = () =>
  reservationStatusNotIn(EXCLUDED_CALENDAR_RESERVATION_STATUS_LIST);

export const activeDiningSessionStatusFilter = () =>
  diningSessionStatusOr(ACTIVE_DINING_SESSION_STATUS_LIST);

export const blockingTableSessionStatusFilter = () =>
  tableSessionStatusOr(BLOCKING_TABLE_SESSION_STATUS_LIST);

export const terminalOrderStatusFilter = () => orderStatusNotIn(TERMINAL_ORDER_STATUS_LIST);

/** Alias: active (open) orders = not COMPLETED/CANCELLED. Prefer this name at call sites. */
export const activeOrderStatusFilter = terminalOrderStatusFilter;

export const cancelledOrderStatusFilter = () => orderStatusNotIn(CANCELLED_ORDER_STATUS_LIST);

/** Kitchen-pipeline only — excludes SERVED and fulfillment statuses. */
export const inProgressOrderStatusFilter = () =>
  orderStatusOr(IN_PROGRESS_ORDER_STATUS_LIST);

export const openOrderStatusFilter = () => orderStatusOr(OPEN_ORDER_STATUS_LIST);

export const openKitchenOrderStatusFilter = () =>
  kitchenOrderStatusOr(OPEN_KITCHEN_ORDER_STATUS_LIST);

export const activeKitchenItemStatusFilter = () =>
  orderItemKitchenStatusOr(ACTIVE_KITCHEN_ITEM_STATUS_LIST);

export const activeTableStatusFilter = () => tableStatusOr(ACTIVE_TABLE_STATUS_LIST);

export const adminStaffRoleFilter = () => staffRoleOr(ADMIN_STAFF_ROLE_LIST);

export const waiterStaffRoleFilter = () => staffRoleOr(WAITER_STAFF_ROLE_LIST);

export const kitchenStaffRoleFilter = () => staffRoleOr(KITCHEN_STAFF_ROLE_LIST);
