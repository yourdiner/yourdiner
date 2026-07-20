import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import type { OrderType, OrderStatus, OrderPaymentStatus } from "@prisma/client";

type OrderRow = {
  id: string;
  orderNumber: number;
  orderType: OrderType;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  total: number;
  customerName: string | null;
  createdAt: Date;
  customer: { name: string; phone: string } | null;
  staff: { displayName: string } | null;
  table: { name: string | null; number: number } | null;
  diningSession: { id: string } | null;
  deliveryDetails: { address: string } | null;
};

const TYPE_BADGE: Record<OrderType, { label: string; className: string }> = {
  DINE_IN: { label: "Dine-In", className: "bg-blue-100 text-blue-800" },
  TAKEAWAY: { label: "Takeaway", className: "bg-amber-100 text-amber-800" },
  DELIVERY: { label: "Delivery", className: "bg-green-100 text-green-800" },
};

function orderHref(order: OrderRow): string {
  if (order.orderType === "TAKEAWAY") return `/admin/orders/takeaway/${order.id}`;
  if (order.orderType === "DELIVERY") return `/admin/orders/delivery/${order.id}`;
  if (order.diningSession) return `/admin/orders/${order.diningSession.id}`;
  return `/admin/orders`;
}

function contextLabel(order: OrderRow): string {
  if (order.orderType === "DINE_IN") {
    return order.table?.name || (order.table ? `Table ${order.table.number}` : "—");
  }
  if (order.orderType === "TAKEAWAY") return "Pickup";
  if (order.deliveryDetails) {
    const addr = order.deliveryDetails.address;
    return addr.length > 40 ? `${addr.slice(0, 40)}…` : addr;
  }
  return "—";
}

function customerLabel(order: OrderRow): string {
  return order.customer?.name ?? order.customerName ?? "Walk-in";
}

export function AllOrdersTable({ orders }: { orders: OrderRow[] }) {
  if (orders.length === 0) {
    return <p className="text-on-surface-variant">No orders match your filters.</p>;
  }

  return (
    <div className="overflow-x-auto border border-tertiary-fixed bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-tertiary-fixed bg-surface-container-low text-left text-label-sm uppercase text-on-surface-variant">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">#</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Context</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">Total</th>
            <th className="px-4 py-3">Waiter</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const badge = TYPE_BADGE[order.orderType];
            return (
              <tr key={order.id} className="border-b border-tertiary-fixed last:border-0">
                <td className="px-4 py-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">#{order.orderNumber}</td>
                <td className="px-4 py-3">{customerLabel(order)}</td>
                <td className="px-4 py-3 text-on-surface-variant">{contextLabel(order)}</td>
                <td className="px-4 py-3">{order.status.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">{order.paymentStatus}</td>
                <td className="px-4 py-3">{formatCurrency(order.total)}</td>
                <td className="px-4 py-3">
                  {order.orderType === "DINE_IN" ? (order.staff?.displayName ?? "—") : "—"}
                </td>
                <td className="px-4 py-3 text-on-surface-variant">
                  {formatDateTime(order.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={orderHref(order)} className="text-primary underline">
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
