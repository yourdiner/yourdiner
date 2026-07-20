"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { reservationMutateApi } from "@/lib/reservation-client";
import { ReservationDetailDrawer } from "./reservation-detail-drawer";
import { formatTime } from "@/lib/utils";

type ReservationRow = {
  id: string;
  guestName: string;
  guestPhone: string;
  guestCount: number;
  reservedAt: Date | string;
  status: string;
  displayGroup?: string;
  table: { id: string; name: string; number: number } | null;
};

const GROUP_STYLE: Record<string, string> = {
  UPCOMING: "bg-slate-100 text-slate-800",
  RESERVED: "bg-amber-100 text-amber-800",
  LATE: "bg-orange-100 text-orange-900",
  CHECKED_IN: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-gray-100 text-gray-700",
  CANCELLED: "bg-red-100 text-red-800",
  NO_SHOW: "bg-amber-100 text-amber-800",
};

const GROUP_LABEL: Record<string, string> = {
  UPCOMING: "Upcoming",
  RESERVED: "Reserved",
  LATE: "Late — no show",
  CHECKED_IN: "Checked In",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No Show",
};

type TableOption = {
  id: string;
  name: string;
  number: number;
  capacity: number;
};

export function ReservationsList({
  reservations,
  tables = [],
}: {
  reservations: ReservationRow[];
  tables?: TableOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) => {
    startTransition(async () => {
      try {
        const result = await fn();
        if (!result.ok) {
          throw new Error(result.error ?? "Action failed");
        }
        toast.success(success);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  };

  if (reservations.length === 0) {
    return <p className="text-on-surface-variant">No reservations for today.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto border border-tertiary-fixed bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-tertiary-fixed bg-surface-container-low text-left text-label-sm uppercase text-on-surface-variant">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Guest</th>
              <th className="px-4 py-3">Guests</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr key={r.id} className="border-b border-tertiary-fixed last:border-0">
                <td className="px-4 py-3">
                  {formatTime(r.reservedAt)}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="text-left font-medium text-primary underline"
                    onClick={() => setSelectedId(r.id)}
                  >
                    {r.guestName}
                  </button>
                  <p className="text-xs text-muted-foreground">{r.guestPhone}</p>
                </td>
                <td className="px-4 py-3">{r.guestCount}</td>
                <td className="px-4 py-3">
                  {r.table ? r.table.name || `Table ${r.table.number}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    className={
                      GROUP_STYLE[r.displayGroup ?? r.status] ?? GROUP_STYLE.UPCOMING
                    }
                    variant="outline"
                  >
                    {GROUP_LABEL[r.displayGroup ?? ""] ??
                      r.status.replace(/_/g, " ")}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {r.status === "PENDING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(() => reservationMutateApi(r.id, "confirm"), "Confirmed")
                        }
                      >
                        Confirm
                      </Button>
                    )}
                    {r.status === "CONFIRMED" && (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(() => reservationMutateApi(r.id, "checkIn"), "Checked in")
                        }
                      >
                        Check In
                      </Button>
                    )}
                    {!["CANCELLED", "COMPLETED", "NO_SHOW", "DINING"].includes(r.status) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          run(() => reservationMutateApi(r.id, "cancel"), "Cancelled")
                        }
                      >
                        Cancel
                      </Button>
                    )}
                    {r.status === "CONFIRMED" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => run(() => reservationMutateApi(r.id, "noShow"), "No show")}
                      >
                        No Show
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <ReservationDetailDrawer
          reservationId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
          tables={tables}
        />
      )}
    </>
  );
}
