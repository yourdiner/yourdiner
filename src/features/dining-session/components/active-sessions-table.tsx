"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

type Session = {
  id: string;
  status: string;
  guestCount: number;
  startedAt: Date | string;
  table: { name: string; number: number };
  staff: { displayName: string } | null;
  customer: { name: string } | null;
  guestName: string | null;
  orders: Array<{ total: number; status: string; items: Array<{ kitchenStatus: string }> }>;
};

function deriveStatus(session: Session): string {
  if (session.status === "BILL_REQUESTED") return "Bill Requested";
  const order = session.orders[0];
  if (!order) return "Active";
  if (order.items.some((i) => i.kitchenStatus === "PREPARING")) return "Preparing";
  if (order.items.some((i) => i.kitchenStatus === "SENT")) return "Sent to Kitchen";
  if (order.items.length > 0 && order.items.every((i) => i.kitchenStatus === "SERVED")) return "Served";
  return order.status.charAt(0) + order.status.slice(1).toLowerCase();
}

function elapsedMinutes(startedAt: Date | string): number {
  return Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000);
}

export function ActiveSessionsTable({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <div className="border border-tertiary-fixed bg-white p-12 text-center text-on-surface-variant">
        No active dining sessions. Start a new order to begin.
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-tertiary-fixed bg-white quiet-shadow">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-tertiary-fixed bg-surface-container-low">
            {["Table", "Customer", "Waiter", "Guests", "Total", "Status", "Started", "Actions"].map(
              (h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-label-md uppercase tracking-wider text-tertiary"
                >
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-tertiary-fixed">
          {sessions.map((s) => {
            const total = s.orders[0]?.total ?? 0;
            const customer = s.customer?.name ?? s.guestName ?? "—";
            return (
              <tr key={s.id} className="item-row bg-white">
                <td className="px-4 py-4 font-medium">
                  {s.table.name || `T${s.table.number}`}
                </td>
                <td className="px-4 py-4">{customer}</td>
                <td className="px-4 py-4 text-on-surface-variant">
                  {s.staff?.displayName ?? "Unassigned"}
                </td>
                <td className="px-4 py-4">{s.guestCount}</td>
                <td className="px-4 py-4">{formatCurrency(total)}</td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-primary-fixed px-3 py-1 text-label-sm text-on-primary-fixed">
                    {deriveStatus(s)}
                  </span>
                </td>
                <td className="px-4 py-4 text-on-surface-variant">
                  {elapsedMinutes(s.startedAt)} min
                </td>
                <td className="px-4 py-4">
                  <Link
                    href={`/admin/orders/${s.id}`}
                    className="text-label-md text-primary hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
