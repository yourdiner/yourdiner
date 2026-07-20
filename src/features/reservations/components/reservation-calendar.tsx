"use client";

import { useState } from "react";
import { ReservationDetailDrawer } from "./reservation-detail-drawer";
import { formatTime } from "@/lib/utils";

type Table = { id: string; name: string; number: number };
type Reservation = {
  id: string;
  guestName: string;
  reservedAt: Date | string;
  expectedEndAt: Date | string;
  status: string;
  tableId: string | null;
};
type Session = {
  id: string;
  tableId: string;
  startedAt: Date | string;
  guestName: string | null;
};

const HOURS = Array.from({ length: 15 }, (_, i) => i + 10);

function timeToPercent(date: Date, dayStart: Date) {
  const mins = (date.getTime() - dayStart.getTime()) / 60000;
  return Math.max(0, Math.min(100, (mins / (14 * 60)) * 100));
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-slate-400",
  CONFIRMED: "bg-blue-500",
  CHECKED_IN: "bg-emerald-500",
  DINING: "bg-purple-500",
  COMPLETED: "bg-gray-400",
};

export function ReservationCalendar({
  tables,
  reservations,
  sessions,
  day,
}: {
  tables: Table[];
  reservations: Reservation[];
  sessions: Session[];
  day: Date;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dayStart = new Date(day);
  dayStart.setHours(10, 0, 0, 0);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-tertiary-fixed bg-white">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-[120px_1fr] border-b bg-surface-container-low text-xs">
            <div className="p-2 font-semibold">Table</div>
            <div className="relative flex h-8 items-end">
              {HOURS.map((h) => (
                <span key={h} className="flex-1 border-l px-1 text-muted-foreground">
                  {h}:00
                </span>
              ))}
            </div>
          </div>

          {tables.map((table) => {
            const tableReservations = reservations.filter((r) => r.tableId === table.id);
            const tableSessions = sessions.filter((s) => s.tableId === table.id);

            return (
              <div key={table.id} className="grid grid-cols-[120px_1fr] border-b last:border-0">
                <div className="p-2 text-sm font-medium">
                  {table.name || `Table ${table.number}`}
                </div>
                <div className="relative h-14 border-l">
                  {tableReservations.map((r) => {
                    const start = new Date(r.reservedAt);
                    const end = new Date(r.expectedEndAt);
                    const left = timeToPercent(start, dayStart);
                    const width = Math.max(4, timeToPercent(end, dayStart) - left);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        title={`${r.guestName} · ${r.status}`}
                        className={`absolute top-2 h-10 rounded px-1 text-left text-[10px] text-white ${STATUS_COLOR[r.status] ?? "bg-blue-500"}`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        onClick={() => setSelectedId(r.id)}
                      >
                        <span className="block truncate font-medium">{r.guestName}</span>
                        <span className="opacity-90">
                          {formatTime(start)}
                        </span>
                      </button>
                    );
                  })}
                  {tableSessions.map((s) => {
                    const start = new Date(s.startedAt);
                    const left = timeToPercent(start, dayStart);
                    return (
                      <div
                        key={s.id}
                        className="absolute bottom-1 h-4 rounded bg-orange-500 px-1 text-[9px] text-white"
                        style={{ left: `${left}%`, width: "20%" }}
                        title={`Dine-in: ${s.guestName ?? "Guest"}`}
                      >
                        Dine-in
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedId && (
        <ReservationDetailDrawer
          reservationId={selectedId}
          open={Boolean(selectedId)}
          onOpenChange={(open) => !open && setSelectedId(null)}
        />
      )}
    </div>
  );
}
