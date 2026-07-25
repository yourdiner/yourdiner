"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { KitchenTicketItem } from "@/features/product-config";
import { updateKitchenItemStatusClient } from "@/lib/kitchen-client";
import type { SerializedKitchenItem } from "@/features/fulfillment/kitchen-item.service";
import type { OrderItemKitchenStatus } from "@prisma/client";
import { PrintReceiptButton } from "@/features/printing/components/print-receipt-button";

const COLUMNS: {
  status: OrderItemKitchenStatus;
  label: string;
  next: "PREPARING" | "READY" | "SERVED" | null;
  nextLabel: string | null;
}[] = [
  { status: "SENT", label: "Pending", next: "PREPARING", nextLabel: "Start preparing" },
  { status: "PREPARING", label: "Preparing", next: "READY", nextLabel: "Mark ready" },
  { status: "READY", label: "Ready", next: "SERVED", nextLabel: "Mark served" },
];

function sortBySentAt(a: SerializedKitchenItem, b: SerializedKitchenItem) {
  return new Date(a.kitchenSentAt).getTime() - new Date(b.kitchenSentAt).getTime();
}

export function KitchenDashboard({
  items,
  onItemUpdated,
}: {
  items: SerializedKitchenItem[];
  onItemUpdated: (item: SerializedKitchenItem | { id: string; removed: true }) => void;
}) {
  const [pending, startTransition] = useTransition();

  const advance = (itemId: string, status: "PREPARING" | "READY" | "SERVED") => {
    startTransition(async () => {
      const result = await updateKitchenItemStatusClient(itemId, status);
      if (!result.ok) {
        toast.error(result.error ?? "Update failed");
        return;
      }
      if (status === "SERVED") {
        onItemUpdated({ id: itemId, removed: true });
        toast.success("Marked served");
      } else {
        // Optimistic local update via poller merge; force status bump until next poll
        const current = items.find((i) => i.id === itemId);
        if (current) {
          onItemUpdated({
            ...current,
            kitchenStatus: status,
            kitchenStatusUpdatedAt: new Date().toISOString(),
          });
        }
        toast.success(
          status === "PREPARING" ? "Started preparing" : "Marked ready"
        );
      }
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {COLUMNS.map((col) => {
        const columnItems = items
          .filter((item) => item.kitchenStatus === col.status)
          .slice()
          .sort(sortBySentAt);

        return (
          <div key={col.status} className="border border-tertiary-fixed bg-white">
            <div className="border-b border-tertiary-fixed bg-surface-container-low px-4 py-3 font-semibold">
              {col.label} ({columnItems.length})
            </div>
            <div className="space-y-3 p-4">
              {columnItems.length === 0 && (
                <p className="text-sm text-on-surface-variant">No items</p>
              )}
              {columnItems.map((item) => (
                <div
                  key={item.id}
                  className="border border-tertiary-fixed p-3 text-sm shadow-sm"
                >
                  <p className="font-medium">{item.contextLabel}</p>
                  <p className="mt-1 text-on-surface-variant">#{item.orderNumber}</p>
                  <ul className="mt-2 space-y-2">
                    <KitchenTicketItem
                      name={item.name}
                      variantNameSnapshot={item.variantNameSnapshot}
                      modifiers={item.modifiers}
                      quantity={item.quantity}
                      notes={item.notes}
                      kitchenNotes={item.kitchenNotes}
                    />
                  </ul>
                  <PrintReceiptButton
                    orderId={item.orderId}
                    kind="kot"
                    triggerLabel="Reprint KOT"
                    className="mt-2 w-full"
                    size="sm"
                  />
                  {col.next && col.nextLabel && (
                    <Button
                      size="sm"
                      className="mt-3 w-full"
                      disabled={pending}
                      onClick={() => advance(item.id, col.next!)}
                    >
                      {col.nextLabel}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
