"use client";

import Link from "next/link";
import type { StaffRole } from "@prisma/client";
import { cn, formatCurrency, formatTime } from "@/lib/utils";
import { MaterialIcon } from "@/components/layout/material-icon";
import { canAccessAssignedSession } from "@/features/dining-session/session-access";
import type { TableAvailabilityStatus } from "@/features/tables/table-availability.logic";

type FloorViewer = {
  staffId: string;
  role: StaffRole;
};

type FloorTable = {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  status: TableAvailabilityStatus;
  canStartSession?: boolean;
  blockReason?: string | null;
  diningSession: {
    id: string;
    status: string;
    guestCount: number;
    staff: { id: string; displayName: string } | null;
    customer: { name: string } | null;
    orders: { total: number; status: string }[];
  } | null;
  pendingCustomerSession?: {
    id: string;
    status: string;
    customerName: string | null;
  } | null;
  activeReservation: {
    id: string;
    guestName: string;
    guestCount: number;
    reservedAt: Date | string;
    holdExpiresAt: Date | string;
  } | null;
};

const STATUS_LABEL: Record<TableAvailabilityStatus, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  CLEANING: "Cleaning",
  DISABLED: "Disabled",
};

const STATUS_COLOR: Record<TableAvailabilityStatus, string> = {
  AVAILABLE: "bg-primary-fixed text-on-primary-fixed",
  OCCUPIED: "bg-secondary-container text-on-secondary-container",
  RESERVED: "bg-surface-container-high text-on-surface-variant",
  CLEANING: "bg-surface-container-high text-on-surface-variant",
  DISABLED: "bg-surface-container-high text-on-surface-variant",
};

function resolveVisualStatus(table: FloorTable): TableAvailabilityStatus {
  if (table.diningSession?.status === "BILL_REQUESTED") {
    return "OCCUPIED";
  }
  return table.status;
}

export function FloorGrid({
  tables,
  viewer,
}: {
  tables: FloorTable[];
  viewer: FloorViewer;
}) {
  const sessionViewer = { kind: "staff" as const, staffId: viewer.staffId, role: viewer.role };
  const availableCount = tables.filter((t) => resolveVisualStatus(t) === "AVAILABLE").length;
  const activeCount = tables.filter((t) => resolveVisualStatus(t) === "OCCUPIED").length;
  const reservedCount = tables.filter((t) => resolveVisualStatus(t) === "RESERVED").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-8 pt-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="border border-tertiary-fixed bg-surface-container-lowest p-4">
          <p className="text-label-sm text-on-surface-variant">Available</p>
          <p className="font-display text-headline-sm font-semibold text-primary">{availableCount}</p>
        </div>
        <div className="border border-tertiary-fixed bg-surface-container-lowest p-4">
          <p className="text-label-sm text-on-surface-variant">Active sessions</p>
          <p className="font-display text-headline-sm font-semibold text-secondary">{activeCount}</p>
        </div>
        <div className="border border-tertiary-fixed bg-surface-container-lowest p-4">
          <p className="text-label-sm text-on-surface-variant">Reserved</p>
          <p className="font-display text-headline-sm font-semibold text-tertiary">{reservedCount}</p>
        </div>
        <div className="border border-tertiary-fixed bg-surface-container-lowest p-4">
          <p className="text-label-sm text-on-surface-variant">Total tables</p>
          <p className="font-display text-headline-sm font-semibold">{tables.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {tables.map((table) => {
          const visual = resolveVisualStatus(table);
          const session = table.diningSession;
          const pendingQr = table.pendingCustomerSession;
          const reservation = table.activeReservation;
          const label = table.name || `T${table.number}`;
          const assignedStaffId = session?.staff?.id ?? null;
          const canOpenSession =
            session &&
            canAccessAssignedSession(sessionViewer, assignedStaffId);
          const canStartWalkIn =
            (visual === "AVAILABLE" || visual === "RESERVED") &&
            table.canStartSession !== false &&
            !pendingQr;
          const href = pendingQr
            ? `/admin/orders`
            : canStartWalkIn
              ? `/staff/session/new?tableId=${table.id}`
              : canOpenSession
                ? `/staff/order/${session.id}`
                : undefined;

          const card = (
            <div
              className={cn(
                "flex min-h-[120px] flex-col border p-4 text-left transition-all",
                visual === "DISABLED" &&
                  "cursor-not-allowed border-tertiary-fixed bg-surface-container opacity-50",
                canStartWalkIn &&
                  "border-tertiary-fixed bg-surface-container-lowest hover:border-primary hover:bg-primary-fixed/10",
                visual === "AVAILABLE" &&
                  !canStartWalkIn &&
                  "cursor-not-allowed border-tertiary-fixed bg-surface-container-lowest opacity-70",
                visual === "RESERVED" &&
                  !canStartWalkIn &&
                  "border-amber-300 bg-amber-50/80",
                visual === "RESERVED" &&
                  canStartWalkIn &&
                  "border-amber-300 bg-amber-50/80 hover:border-primary hover:bg-primary-fixed/10",
                visual === "OCCUPIED" &&
                  "border-secondary bg-secondary-fixed/10 hover:bg-secondary-fixed/20",
                visual === "CLEANING" &&
                  "border-tertiary-fixed bg-surface-container-high",
                pendingQr && "border-amber-400 bg-amber-50/90"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-title-md font-semibold">{label}</p>
                <span
                  className={cn(
                    "shrink-0 px-2 py-0.5 text-label-sm",
                    pendingQr
                      ? "bg-amber-200 text-amber-950"
                      : STATUS_COLOR[visual] ?? "bg-surface-container"
                  )}
                >
                  {pendingQr ? "Awaiting approval" : STATUS_LABEL[visual] ?? visual}
                </span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
                <MaterialIcon name="chair_alt" className="text-base" />
                {table.capacity} seats
              </p>
              {pendingQr && !session && (
                <div className="mt-auto space-y-0.5 pt-3 text-label-sm">
                  {pendingQr.customerName && (
                    <p className="font-medium text-on-surface">{pendingQr.customerName}</p>
                  )}
                  <p className="font-medium text-amber-800">
                    Customer QR — approve on Floor &amp; Orders →
                  </p>
                </div>
              )}
              {reservation && !session && !pendingQr && (
                <div className="mt-auto space-y-0.5 pt-3 text-label-sm">
                  <p className="font-medium text-on-surface">{reservation.guestName}</p>
                  <p className="text-on-surface-variant">
                    {reservation.guestCount} guests · hold until {formatTime(reservation.holdExpiresAt)}
                  </p>
                </div>
              )}
              {session && (
                <div className="mt-auto space-y-0.5 pt-3 text-label-sm">
                  <p className="text-on-surface-variant">
                    {session.guestCount} guests · {session.staff?.displayName ?? "Unassigned"}
                  </p>
                  {session.customer?.name && (
                    <p className="font-medium text-on-surface">{session.customer.name}</p>
                  )}
                  {canOpenSession && session.orders[0] && (
                    <p className="font-semibold text-primary">
                      {formatCurrency(session.orders[0].total)}
                    </p>
                  )}
                  {!canOpenSession && assignedStaffId && (
                    <p className="text-xs text-amber-700">
                      Assigned to {session.staff?.displayName ?? "another waiter"}
                    </p>
                  )}
                </div>
              )}
              {canStartWalkIn && (
                <p className="mt-auto pt-3 text-label-sm font-medium text-primary">
                  Tap to start session →
                </p>
              )}
              {visual === "AVAILABLE" && !canStartWalkIn && table.blockReason && (
                <p className="mt-auto pt-3 text-label-sm text-on-surface-variant">
                  {table.blockReason}
                </p>
              )}
              {visual === "RESERVED" && !session && !pendingQr && !canStartWalkIn && (
                <p className="mt-auto pt-3 text-label-sm font-medium text-amber-800">
                  Reserved — unavailable
                </p>
              )}
              {visual === "RESERVED" && !session && !pendingQr && canStartWalkIn && (
                <p className="mt-auto pt-3 text-label-sm font-medium text-amber-800">
                  Reserved soon — tap to start (may need override)
                </p>
              )}
              {session && canOpenSession && (
                <p className="mt-auto pt-3 text-label-sm font-medium text-secondary">
                  Open order →
                </p>
              )}
              {session && !canOpenSession && (
                <p className="mt-auto pt-3 text-label-sm text-on-surface-variant">
                  Not your table
                </p>
              )}
            </div>
          );

          // OCCUPIED tables with an assigned session must remain clickable so
          // the waiter can open the order; only block when there is no href.
          // Hold-window RESERVED has canStartWalkIn false; dining-window RESERVED
          // may still start and go through conflict override.
          if (!href || visual === "DISABLED" || (visual === "RESERVED" && !canStartWalkIn && !pendingQr)) {
            return <div key={table.id}>{card}</div>;
          }

          return (
            <Link key={table.id} href={href} className="block">
              {card}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
