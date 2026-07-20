"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { requireAdminOrderActor } from "@/features/dining-session/auth";
import {
  createReservation,
  updateReservation,
  confirmReservation,
  cancelReservation,
  markNoShow,
  changeReservationTable,
} from "./reservation.service";
import { checkInReservation } from "./check-in.service";
import {
  listReservations,
  getReservationDetail,
  getReservationsDashboard,
  getCalendarData,
} from "./reservation-queries";
import {
  createReservationSchema,
  updateReservationSchema,
  changeTableSchema,
} from "./schemas";
import type { ReservationListFilters } from "./reservation-queries";
import { suggestBestTable } from "./assignment.service";
import {
  getRestaurantReservationSettings,
  computeReservationWindow,
  snapToInterval,
} from "@/lib/reservation-settings";

function revalidateReservations() {
  revalidatePath("/admin/reservations");
  revalidatePath("/dashboard/reservations");
}

export async function createReservationAction(input: unknown) {
  const tenant = await requireTenantContext();
  await requirePlanFeature(tenant.restaurantId, "reservations");
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, [
    "OWNER",
    "MANAGER",
    "CASHIER",
  ]);
  const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
  const data = createReservationSchema.parse(input);
  const reservation = await createReservation(
    tenant.restaurantId,
    data,
    actor,
    staff.id
  );
  revalidateReservations();
  return reservation;
}

export async function updateReservationAction(reservationId: string, input: unknown) {
  const tenant = await requireTenantContext();
  await requirePlanFeature(tenant.restaurantId, "reservations");
  const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
  const data = updateReservationSchema.parse(input);
  const reservation = await updateReservation(
    reservationId,
    tenant.restaurantId,
    data,
    actor
  );
  revalidateReservations();
  return reservation;
}

export async function confirmReservationAction(reservationId: string) {
  const tenant = await requireTenantContext();
  await requirePlanFeature(tenant.restaurantId, "reservations");
  const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
  const reservation = await confirmReservation(reservationId, tenant.restaurantId, actor);
  revalidateReservations();
  return reservation;
}

export async function cancelReservationAction(reservationId: string) {
  const tenant = await requireTenantContext();
  await requirePlanFeature(tenant.restaurantId, "reservations");
  const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
  const reservation = await cancelReservation(reservationId, tenant.restaurantId, actor);
  revalidateReservations();
  return reservation;
}

export async function checkInReservationAction(
  reservationId: string,
  staffId?: string | null
) {
  const tenant = await requireTenantContext();
  await requirePlanFeature(tenant.restaurantId, "reservations");
  const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
  const result = await checkInReservation(reservationId, tenant.restaurantId, actor, {
    staffId,
  });
  revalidateReservations();
  revalidatePath("/admin/orders");
  return result;
}

export async function markNoShowAction(reservationId: string) {
  const tenant = await requireTenantContext();
  await requirePlanFeature(tenant.restaurantId, "reservations");
  const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
  const reservation = await markNoShow(reservationId, tenant.restaurantId, actor);
  revalidateReservations();
  return reservation;
}

export async function changeTableAction(reservationId: string, input: unknown) {
  const tenant = await requireTenantContext();
  await requirePlanFeature(tenant.restaurantId, "reservations");
  const actor = await requireAdminOrderActor({ adminRoles: ["OWNER", "MANAGER", "CASHIER"] });
  const { tableId } = changeTableSchema.parse(input);
  const reservation = await changeReservationTable(
    reservationId,
    tenant.restaurantId,
    tableId,
    actor
  );
  revalidateReservations();
  return reservation;
}

export async function getReservationsListAction(filters: ReservationListFilters = {}) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId);
  return listReservations(tenant.restaurantId, filters);
}

export async function getReservationDetailAction(reservationId: string) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId);
  return getReservationDetail(reservationId, tenant.restaurantId);
}

export async function getReservationsDashboardAction() {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId);
  return getReservationsDashboard(tenant.restaurantId);
}

export async function getCalendarDataAction(dayIso: string) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId);
  return getCalendarData(tenant.restaurantId, new Date(dayIso));
}

export async function suggestTableAction(input: {
  reservedAt: string;
  guestCount: number;
}) {
  const tenant = await requireTenantContext();
  await requirePlanFeature(tenant.restaurantId, "reservations");
  const settings = await getRestaurantReservationSettings(tenant.restaurantId);
  const reservedAt = snapToInterval(
    new Date(input.reservedAt),
    settings.reservationIntervalMinutes
  );
  const { expectedEndAt } = computeReservationWindow(reservedAt, settings);
  const table = await suggestBestTable(
    tenant.restaurantId,
    reservedAt,
    expectedEndAt,
    input.guestCount
  );
  return table;
}
