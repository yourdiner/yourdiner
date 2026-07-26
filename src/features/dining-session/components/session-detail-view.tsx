"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createAdminSessionClient } from "@/lib/session-client";
import { createAdminOrderClient } from "@/lib/order-client";
import type { SessionMutationResult } from "@/lib/session-mutations";
import type { LoyaltySettings } from "@/lib/loyalty-settings";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/utils";
import { formatKitchenStatusLabel } from "@/lib/kitchen-status-label";
import { MaterialIcon } from "@/components/layout/material-icon";
import { Minus } from "lucide-react";
import { OrderLineItem } from "@/features/product-config";
import { CheckoutDialog } from "./checkout-dialog";
import { PrintReceiptButton } from "@/features/printing/components/print-receipt-button";
import { isOrderActive } from "@/lib/dining-lifecycle";

type SessionDetail = {
  id: string;
  status: string;
  guestCount: number;
  guestName: string | null;
  guestPhone: string;
  notes: string | null;
  startedAt: Date | string;
  closedAt: Date | string | null;
  table: { id: string; name: string; number: number };
  staff: { id: string; displayName: string } | null;
  customer: {
    id: string;
    name: string;
    phone: string;
    visitCount: number;
    isVip: boolean;
    loyaltyPoints: number;
    membership: { name: string } | null;
  } | null;
  reservation: {
    id: string;
    guestName: string;
    reservedAt: Date | string;
    status: string;
  } | null;
  orders: Array<{
    id: string;
    total: number;
    subtotal: number;
    taxAmount: number;
    discountAmount: number;
    promotionDiscountAmount?: number;
    status: string;
    items: Array<{
      id: string;
      name: string;
      billDisplayName?: string | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      kitchenStatus: string;
      kitchenNotes: string | null;
      notes: string | null;
      variantId?: string | null;
      variantNameSnapshot?: string | null;
      modifiers: unknown;
      revisionNumber: number;
      createdAt: Date | string;
    }>;
    revisions: Array<{ revisionNumber: number; submittedAt: Date | string }>;
  }>;
  events: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: Date | string;
    actorUser: { name: string } | null;
    actorStaff: { displayName: string } | null;
  }>;
  payments: Array<{ id: string; amount: number; method: string; status: string; createdAt: Date | string }>;
};

type Waiter = { id: string; displayName: string };

const SENT_STATUSES = new Set(["SENT", "PREPARING", "READY", "SERVED"]);

function groupOrderedItems(
  items: SessionDetail["orders"][0]["items"],
  revisions: SessionDetail["orders"][0]["revisions"]
): Array<{ key: string; label: string; items: typeof items }> {
  const revisionTime = new Map(
    revisions.map((r) => [r.revisionNumber, formatTime(r.submittedAt)])
  );

  // Admin / bill: only items that have been sent to kitchen.
  const sent = items.filter((i) => SENT_STATUSES.has(i.kitchenStatus));

  const byTicket = new Map<number, typeof items>();
  for (const item of sent) {
    const rev = item.revisionNumber || 0;
    const list = byTicket.get(rev) ?? [];
    list.push(item);
    byTicket.set(rev, list);
  }

  const groups: Array<{ key: string; label: string; items: typeof items }> = [];

  const ticketNums = [...byTicket.keys()].sort((a, b) => a - b);
  for (const rev of ticketNums) {
    const ticketItems = byTicket.get(rev)!;
    const timeLabel = revisionTime.get(rev) ?? formatTime(ticketItems[0]?.createdAt);
    groups.push({
      key: `ticket-${rev}`,
      label: rev > 0 ? `${timeLabel} · Ticket #${rev}` : timeLabel,
      items: ticketItems,
    });
  }

  return groups;
}

export function SessionDetailView({
  session,
  waiters,
  loyaltySettings,
}: {
  session: SessionDetail;
  waiters: Waiter[];
  loyaltySettings: LoyaltySettings;
}) {
  const router = useRouter();
  const sessionApi = useMemo(() => createAdminSessionClient(session.id), [session.id]);
  const orderApi = useMemo(() => createAdminOrderClient(session.id), [session.id]);
  const [pending, startTransition] = useTransition();
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const openOrders = session.orders.filter((o) => isOrderActive(o.status));
  const order = openOrders[0] ?? session.orders[0];
  // Prefer the open order; after consolidation there is at most one.
  // Admin + bill only show kitchen-ticketed lines (not waiter/customer drafts).
  const billedItems =
    order?.items.filter((i) => SENT_STATUSES.has(i.kitchenStatus)) ?? [];
  const itemGroups = order ? groupOrderedItems(billedItems, order.revisions) : [];
  const kitchenEvents = session.events.filter((e) => e.type === "SENT_TO_KITCHEN");
  const isClosed = session.status === "CLOSED" || session.status === "CANCELLED";
  const canCheckout = Boolean(order && billedItems.length > 0);

  function refresh() {
    router.refresh();
  }

  function run(action: () => Promise<SessionMutationResult>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      refresh();
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="grid grid-cols-12 gap-gutter">
        <div className="col-span-12 border border-tertiary-fixed bg-white p-6 lg:col-span-8 quiet-shadow">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-label-sm uppercase tracking-widest text-secondary">Session</p>
              <h3 className="font-display text-headline-sm font-semibold">
                {session.table.name || `Table ${session.table.number}`}
              </h3>
            </div>
            <span className="bg-primary-fixed px-3 py-1 text-label-sm text-on-primary-fixed">
              {session.status.replace("_", " ")}
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <dt className="text-on-surface-variant">Customer</dt>
              <dd className="font-medium">
                {session.customer?.name ?? session.guestName ?? "Walk-in"}
              </dd>
              <dd className="text-on-surface-variant">{session.guestPhone}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Waiter</dt>
              <dd className="font-medium">{session.staff?.displayName ?? "Unassigned"}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Guests</dt>
              <dd className="font-medium">{session.guestCount}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Started</dt>
              <dd>{formatDateTime(session.startedAt)}</dd>
            </div>
            {session.customer && (
              <div>
                <dt className="text-on-surface-variant">Loyalty</dt>
                <dd>
                  {session.customer.visitCount} visits · {session.customer.loyaltyPoints} pts
                  {session.customer.isVip && " · VIP"}
                </dd>
              </div>
            )}
            {session.reservation && (
              <div>
                <dt className="text-on-surface-variant">Reservation</dt>
                <dd>
                  {session.reservation.guestName} ·{" "}
                  {formatDateTime(session.reservation.reservedAt)}
                </dd>
              </div>
            )}
          </dl>
          {session.notes && (
            <p className="mt-4 text-sm text-on-surface-variant italic">{session.notes}</p>
          )}
        </div>

        {isClosed && order && (
          <div className="col-span-12 space-y-3 lg:col-span-4">
            <PrintReceiptButton
              orderId={order.id}
              kind="bill"
              diningSessionId={session.id}
              triggerLabel="Reprint bill"
              className="w-full"
              size="default"
            />
          </div>
        )}

        {!isClosed && (
          <div className="col-span-12 space-y-3 lg:col-span-4">
            <Link
              href={`/admin/orders/${session.id}/order`}
              className="flex w-full items-center justify-center gap-2 bg-primary py-3 text-on-primary"
            >
              <MaterialIcon name="add" />
              Add Items
            </Link>
            <Select
              value={session.staff?.id ?? "none"}
              onValueChange={(v) =>
                run(() => sessionApi.reassignWaiter(v === "none" ? null : v))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Reassign waiter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {waiters.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {order && (
              <>
                <PrintReceiptButton
                  orderId={order.id}
                  kind="bill"
                  diningSessionId={session.id}
                  triggerLabel="Print / Preview bill"
                  className="w-full"
                  size="default"
                />
                <PrintReceiptButton
                  orderId={order.id}
                  kind="kot"
                  triggerLabel="Print kitchen ticket"
                  className="w-full"
                  size="default"
                />
                <Button
                  className="w-full"
                  disabled={pending || !canCheckout}
                  onClick={() => setCheckoutOpen(true)}
                  title={!canCheckout ? "Send items to kitchen before checkout" : undefined}
                >
                  Checkout
                </Button>
                <CheckoutDialog
                  sessionId={session.id}
                  orderId={order.id}
                  open={checkoutOpen}
                  onOpenChange={setCheckoutOpen}
                  order={{
                    items: billedItems.map((item) => ({
                      id: item.id,
                      name: item.name,
                      billDisplayName: item.billDisplayName ?? null,
                      quantity: item.quantity,
                      unitPrice: item.unitPrice,
                      totalPrice: item.totalPrice,
                      variantNameSnapshot: item.variantNameSnapshot ?? null,
                      modifiers: item.modifiers,
                    })),
                    subtotal: order.subtotal,
                    taxAmount: order.taxAmount,
                    discountAmount: order.discountAmount,
                    promotionDiscountAmount: order.promotionDiscountAmount ?? 0,
                    total: order.total,
                  }}
                  loyaltySettings={loyaltySettings}
                  customerPoints={session.customer?.loyaltyPoints ?? 0}
                  onSuccess={refresh}
                />
              </>
            )}
          </div>
        )}
      </section>

      <section className="border border-tertiary-fixed bg-white p-6 quiet-shadow">
        <h4 className="mb-6 font-display text-headline-sm font-semibold">Ordered Items</h4>
        {!billedItems.length ? (
          <p className="text-on-surface-variant">
            No items sent to kitchen yet. Draft items appear here after the waiter or customer
            sends them to the kitchen.
          </p>
        ) : (
          <div className="space-y-6">
            {itemGroups.map((group) => (
              <div key={group.key}>
                <p className="mb-3 text-label-md text-secondary">{group.label}</p>
                <div className="space-y-3 border-l-2 border-tertiary-fixed pl-4">
                  {group.items.map((item) => {
                    const isEditable = !isClosed;
                    return (
                    <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="flex-1">
                        <OrderLineItem
                          name={item.name}
                          billDisplayName={item.billDisplayName}
                          variantNameSnapshot={item.variantNameSnapshot}
                          modifiers={item.modifiers}
                          quantity={item.quantity}
                          unitPrice={item.unitPrice}
                          totalPrice={item.totalPrice}
                          notes={item.notes}
                          kitchenNotes={item.kitchenNotes}
                        />
                        <p className="mt-1 text-xs capitalize text-on-surface-variant">
                          {formatKitchenStatusLabel(item.kitchenStatus)}
                          {item.revisionNumber > 0 ? ` · ticket #${item.revisionNumber}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isEditable && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              disabled={pending}
                              onClick={() =>
                                run(async () => {
                                  if (item.quantity <= 1) return orderApi.removeItem(item.id);
                                  return orderApi.updateQty(item.id, item.quantity - 1);
                                })
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7 text-destructive"
                              disabled={pending}
                              onClick={() => run(() => orderApi.removeItem(item.id))}
                            >
                              ×
                            </Button>
                          </div>
                        )}
                        <span className="shrink-0 font-medium">{formatCurrency(item.totalPrice)}</span>
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            ))}
            {order && (
              <div className="border-t border-tertiary-fixed pt-4 text-right font-semibold">
                Total: {formatCurrency(order.total)}
                {order.discountAmount > 0 && (
                  <span className="ml-2 text-sm font-normal text-secondary">
                    (incl. {formatCurrency(order.discountAmount)} discount)
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="border border-tertiary-fixed bg-white p-6 quiet-shadow">
        <h4 className="mb-6 font-display text-headline-sm font-semibold">Activity Timeline</h4>
        <div className="space-y-4">
          {kitchenEvents.map((event, i) => (
            <div key={event.id} className="flex gap-4">
              <div className="w-16 shrink-0 text-label-sm text-on-surface-variant">
                {formatTime(event.createdAt)}
              </div>
              <div className={i < kitchenEvents.length - 1 ? "border-b border-tertiary-fixed pb-4 flex-1" : "flex-1"}>
                <p className="text-sm">{event.message}</p>
              </div>
            </div>
          ))}
          {kitchenEvents.length === 0 && (
            <p className="text-on-surface-variant">No tickets sent to kitchen yet.</p>
          )}
        </div>
      </section>

      {session.payments.length > 0 && (
        <section className="border border-tertiary-fixed bg-white p-6 quiet-shadow">
          <h4 className="mb-4 font-display text-headline-sm font-semibold">Payments</h4>
          {session.payments.map((p) => (
            <div key={p.id} className="flex justify-between text-sm">
              <span>
                {p.method} · {p.status}
              </span>
              <span>{formatCurrency(p.amount)}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
