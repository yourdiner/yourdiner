"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePollInterval } from "@/hooks/use-poll-interval";
import {
  approveFirstOrder,
  fetchPendingFirstOrders,
  rejectFirstOrder,
  type PendingFirstOrder,
} from "@/lib/customer-session-admin-client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const POLL_MS = 8000;

export function PendingFirstOrdersPanel({
  initialOrders = [],
}: {
  initialOrders?: PendingFirstOrder[];
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [pending, startTransition] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);

  usePollInterval(() => {
    void fetchPendingFirstOrders().then((result) => {
      if (result.ok) setOrders(result.data);
    });
  }, POLL_MS);

  async function handleAction(orderId: string, action: "approve" | "reject") {
    setActingId(orderId);
    try {
      const result =
        action === "approve"
          ? await approveFirstOrder(orderId)
          : await rejectFirstOrder(orderId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(action === "approve" ? "Order sent to kitchen" : "Order rejected");
      startTransition(() => {
        router.refresh();
      });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
    } finally {
      setActingId(null);
    }
  }

  if (orders.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="font-display text-headline-sm font-semibold">Pending first orders</h4>
        <Badge variant="secondary">{orders.length} awaiting approval</Badge>
      </div>
      <div className="space-y-3">
        {orders.map((order) => {
          const table = order.diningSession.table;
          const itemSummary = order.items
            .map((item) => `${item.quantity}× ${item.name}`)
            .join(", ");
          return (
            <div
              key={order.id}
              className="flex flex-col gap-3 border border-blue-200 bg-blue-50/50 p-4 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <p className="font-medium">
                  {table.name || `Table ${table.number}`} · {formatCurrency(order.total)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {order.diningSession.customer?.name ?? "Guest"} ·{" "}
                  {order.diningSession.customer?.phone ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">{itemSummary || "No items"}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleAction(order.id, "approve")}
                  disabled={pending || actingId === order.id}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAction(order.id, "reject")}
                  disabled={pending || actingId === order.id}
                >
                  Reject
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
