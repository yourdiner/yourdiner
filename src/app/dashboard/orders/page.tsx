import { Suspense } from "react";
import Link from "next/link";
import { requireTenantPageContext } from "@/lib/tenancy";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { adminGetActiveSessions, adminGetRecentSessions } from "@/features/dining-session/queries";
import { adminListPendingCustomerSessions } from "@/features/customer-order/customer-session-admin.service";
import { adminListPendingFirstOrders } from "@/features/customer-order/customer-session-admin.service";
import { PendingCustomerSessionsPanel } from "@/features/customer-order/components/pending-customer-sessions-panel";
import { PendingFirstOrdersPanel } from "@/features/customer-order/components/pending-first-orders-panel";
import { LiveFloorDashboardPoller } from "@/features/waiters/components/live-floor-dashboard-poller";
import { MaterialIcon } from "@/components/layout/material-icon";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { listAllOrders } from "@/features/fulfillment/fulfillment-queries";
import { AllOrdersTable } from "@/features/fulfillment/components/all-orders-table";
import { AllOrdersFilters } from "@/features/fulfillment/components/all-orders-filters";
import type { OrderType, OrderStatus, OrderPaymentStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  type?: string;
  status?: string;
  payment?: string;
  q?: string;
}>;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "orders");

  if (!hasAccess) {
    const planLabel = getModuleUpgradeLabel("orders");
    return (
      <AdminPageShell title="Floor & Orders">
        <UpgradePrompt
          title={`Upgrade to ${planLabel} Plan`}
          description="Order management and dining sessions are available on the Cafe Staff plan and above."
        />
      </AdminPageShell>
    );
  }

  const params = await searchParams;
  const filters = {
    ...(params.type ? { orderType: params.type as OrderType } : {}),
    ...(params.status ? { status: params.status as OrderStatus } : {}),
    ...(params.payment ? { paymentStatus: params.payment as OrderPaymentStatus } : {}),
    ...(params.q ? { customerSearch: params.q } : {}),
    limit: 80,
  };

  const [activeSessions, recentSessions, allOrders, pendingCustomerSessions, pendingFirstOrders] =
    await Promise.all([
      adminGetActiveSessions(),
      adminGetRecentSessions(40),
      listAllOrders(tenant.restaurantId, filters),
      adminListPendingCustomerSessions(),
      adminListPendingFirstOrders(),
    ]);

  const liveFloorSessions = activeSessions.map((s) => ({
    id: s.id,
    status: s.status,
    source: s.source,
    guestCount: s.guestCount,
    table: { id: s.table.id, number: s.table.number, name: s.table.name },
    staff: s.staff,
    customer: s.customer,
    orders: s.orders.map((o) => ({ total: o.total, status: o.status })),
    events: s.events,
  }));

  return (
    <AdminPageShell title="Floor & Orders" searchPlaceholder="Search sessions...">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-label-md uppercase tracking-widest text-secondary">Floor Operations</p>
          <h3 className="font-display text-display-lg-mobile font-bold leading-tight md:text-display-lg">
            Live floor & order history
          </h3>
          <p className="mt-2 max-w-xl text-body-md text-on-surface-variant opacity-80">
            Active tables, kitchen tickets, and past sessions in one place.
          </p>
        </div>
        <Link
          href="/admin/orders/new"
          className="flex items-center justify-center gap-2 bg-primary px-8 py-4 text-label-md text-on-primary quiet-shadow transition-all hover:-translate-y-0.5"
        >
          <MaterialIcon name="add" />
          New Order
        </Link>
      </div>

      <PendingCustomerSessionsPanel
        initialSessions={pendingCustomerSessions.map((session) => ({
          id: session.id,
          createdAt: session.createdAt.toISOString(),
          customer: session.customer,
          table: session.table,
        }))}
      />

      <PendingFirstOrdersPanel
        initialOrders={pendingFirstOrders
          .filter((order) => order.diningSession)
          .map((order) => ({
            id: order.id,
            total: order.total,
            items: order.items.map((item) => ({
              id: item.id,
              quantity: item.quantity,
              name: item.name,
            })),
            diningSession: {
              customer: order.diningSession!.customer,
              table: order.diningSession!.table,
            },
          }))}
      />

      <section className="mb-10">
        <h4 className="mb-4 font-display text-headline-sm font-semibold">Active sessions</h4>
        <LiveFloorDashboardPoller initialSessions={liveFloorSessions} embedded />
      </section>

      <section className="mb-10">
        <h4 className="mb-4 font-display text-headline-sm font-semibold">All orders</h4>
        <Suspense fallback={null}>
          <AllOrdersFilters />
        </Suspense>
        <AllOrdersTable orders={allOrders} />
      </section>

      <section>
        <h4 className="mb-4 font-display text-headline-sm font-semibold">Previous sessions</h4>
        {recentSessions.length === 0 ? (
          <p className="text-on-surface-variant">No closed sessions yet.</p>
        ) : (
          <div className="overflow-x-auto border border-tertiary-fixed bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-tertiary-fixed bg-surface-container-low text-left text-label-sm uppercase text-on-surface-variant">
                <tr>
                  <th className="px-4 py-3">Table</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Waiter</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Closed</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {recentSessions.map((session) => {
                  const order = session.orders[0];
                  return (
                    <tr key={session.id} className="border-b border-tertiary-fixed last:border-0">
                      <td className="px-4 py-3 font-medium">
                        {session.table.name || `Table ${session.table.number}`}
                      </td>
                      <td className="px-4 py-3">
                        {session.customer?.name ?? session.guestName ?? "Walk-in"}
                      </td>
                      <td className="px-4 py-3">{session.staff?.displayName ?? "—"}</td>
                      <td className="px-4 py-3">
                        {order ? formatCurrency(order.total) : "—"}
                      </td>
                      <td className="px-4 py-3 text-on-surface-variant">
                        {session.closedAt ? formatDateTime(session.closedAt) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/orders/${session.id}`} className="text-primary underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPageShell>
  );
}
