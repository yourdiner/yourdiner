"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KitchenTicketItem } from "@/features/product-config";
import { updateKitchenOrderStatusClient } from "@/lib/kitchen-client";
import type { SerializedKitchenTicket } from "@/features/fulfillment/fulfillment-queries";
import type { KitchenOrderStatus } from "@prisma/client";

const COLUMNS: { status: KitchenOrderStatus; label: string }[] = [
  { status: "QUEUED", label: "Queued" },
  { status: "COOKING", label: "Cooking" },
  { status: "READY", label: "Ready" },
];

function ticketLabel(ticket: SerializedKitchenTicket): string {
  const { order } = ticket;
  const name = order.customer?.name ?? order.customerName ?? "Guest";

  if (order.orderType === "DINE_IN") {
    const table = order.table?.name || (order.table ? `Table ${order.table.number}` : "Table");
    return `🍽 Dine-In · ${table}`;
  }
  if (order.orderType === "TAKEAWAY") {
    return `🥡 Takeaway · ${name} · Pickup`;
  }
  const addr = order.deliveryDetails?.address ?? "";
  const snippet = addr.length > 24 ? `${addr.slice(0, 24)}…` : addr;
  return `🛵 Delivery · ${name} · ${snippet || "Address"}`;
}

function nextStatus(current: KitchenOrderStatus): "COOKING" | "READY" | null {
  if (current === "QUEUED") return "COOKING";
  if (current === "COOKING") return "READY";
  return null;
}

export function KitchenDashboard({ tickets }: { tickets: SerializedKitchenTicket[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const advance = (kitchenOrderId: string, status: "COOKING" | "READY") => {
    startTransition(async () => {
      const result = await updateKitchenOrderStatusClient(kitchenOrderId, status);
      if (!result.ok) {
        toast.error(result.error ?? "Update failed");
        return;
      }
      toast.success(`Marked ${status.toLowerCase()}`);
      router.refresh();
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const columnTickets = tickets.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="border border-tertiary-fixed bg-white">
            <div className="border-b border-tertiary-fixed bg-surface-container-low px-4 py-3 font-semibold">
              {col.label} ({columnTickets.length})
            </div>
            <div className="space-y-3 p-4">
              {columnTickets.length === 0 && (
                <p className="text-sm text-on-surface-variant">No tickets</p>
              )}
              {columnTickets.map((ticket) => {
                const next = nextStatus(ticket.status);
                return (
                  <div
                    key={ticket.id}
                    className="border border-tertiary-fixed p-3 text-sm shadow-sm"
                  >
                    <p className="font-medium">{ticketLabel(ticket)}</p>
                    <p className="mt-1 text-on-surface-variant">#{ticket.order.orderNumber}</p>
                    <ul className="mt-2 space-y-2">
                      {ticket.order.items.map((item) => (
                        <KitchenTicketItem
                          key={item.id}
                          name={item.name}
                          variantNameSnapshot={item.variantNameSnapshot}
                          modifiers={item.modifiers}
                          quantity={item.quantity}
                          notes={item.notes}
                          kitchenNotes={item.kitchenNotes}
                        />
                      ))}
                    </ul>
                    {next && (
                      <Button
                        size="sm"
                        className="mt-3 w-full"
                        disabled={pending}
                        onClick={() => advance(ticket.id, next)}
                      >
                        Mark {next === "COOKING" ? "Cooking" : "Ready"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
