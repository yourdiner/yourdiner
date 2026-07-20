import { redirect, notFound } from "next/navigation";
import { requireTenantPageContext } from "@/lib/tenancy";
import { restaurantHasFeature } from "@/lib/plan-access";
import { getFulfillmentOrderContext } from "@/features/fulfillment/fulfillment-order.service";
import { FulfillmentOrderInterface } from "@/features/fulfillment/components/fulfillment-order-interface";
import { mapOrderCategories } from "@/lib/map-order-categories";
import { serializeActiveOrder } from "@/lib/serialize-order";
import { syncOrderPaymentStatus } from "@/lib/order-payment-status";

export const dynamic = "force-dynamic";

export default async function TakeawayOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const tenant = await requireTenantPageContext();
  const allowed = await restaurantHasFeature(tenant.restaurantId, "fulfillment_orders");
  if (!allowed) redirect("/admin/orders");

  let ctx;
  try {
    ctx = await getFulfillmentOrderContext(orderId, tenant.restaurantId);
  } catch {
    notFound();
  }

  if (ctx.order.orderType !== "TAKEAWAY") notFound();
  if (ctx.order.status === "COMPLETED" || ctx.order.status === "CANCELLED") {
    redirect("/admin/orders");
  }

  const paymentStatus = await syncOrderPaymentStatus(ctx.order.id);
  const order = { ...ctx.order, paymentStatus };

  return (
    <FulfillmentOrderInterface
      orderId={order.id}
      orderType="TAKEAWAY"
      tableLabel={`Takeaway #${order.orderNumber}`}
      customerName={order.customerName}
      orderStatus={order.status}
      paymentStatus={order.paymentStatus}
      orderTotal={order.total}
      categories={mapOrderCategories(ctx.categories)}
      activeOrder={serializeActiveOrder(order)}
    />
  );
}
