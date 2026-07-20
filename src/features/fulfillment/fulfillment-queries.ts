import { prisma } from "@/lib/db";
import {
  KitchenOrderStatus,
  OrderStatus,
  OrderType,
  type OrderPaymentStatus,
} from "@prisma/client";
import { resolveOrderPaymentStatus } from "@/lib/order-payment-status";
import {
  activeKitchenItemStatusFilter,
  openKitchenOrderStatusFilter,
  terminalOrderStatusFilter,
} from "@/lib/prisma-filters";
export type OrderListFilters = {
  orderType?: OrderType;
  status?: OrderStatus;
  paymentStatus?: OrderPaymentStatus;
  customerSearch?: string;
  staffId?: string;
  kitchenStatus?: KitchenOrderStatus;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
};

export async function listAllOrders(restaurantId: string, filters: OrderListFilters = {}) {
  const limit = filters.limit ?? 100;

  const where = {
    restaurantId,
    ...(filters.orderType ? { orderType: filters.orderType } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
    ...(filters.staffId ? { staffId: filters.staffId } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? {
          createdAt: {
            ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
            ...(filters.dateTo ? { lte: filters.dateTo } : {}),
          },
        }
      : {}),
    ...(filters.customerSearch
      ? {
          OR: [
            { customerName: { contains: filters.customerSearch, mode: "insensitive" as const } },
            {
              customer: {
                phone: { contains: filters.customerSearch.replace(/\D/g, "").slice(-10) },
              },
            },
            {
              customer: {
                name: { contains: filters.customerSearch, mode: "insensitive" as const },
              },
            },
          ],
        }
      : {}),
    ...(filters.kitchenStatus
      ? { kitchenOrders: { some: { status: filters.kitchenStatus } } }
      : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      staff: { select: { id: true, displayName: true } },
      table: { select: { id: true, name: true, number: true } },
      diningSession: {
        select: {
          id: true,
          payments: { where: { status: "COMPLETED" }, select: { amount: true } },
        },
      },
      payments: { where: { status: "COMPLETED" }, select: { amount: true } },
      deliveryDetails: {
        select: {
          address: true,
          deliveryCharges: true,
          estimatedDeliveryAt: true,
          deliveryPartner: true,
        },
      },
      kitchenOrders: { select: { status: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return orders.map((order) => ({
    ...order,
    paymentStatus: resolveOrderPaymentStatus(order),
  }));
}

export type SerializedKitchenTicket = {
  id: string;
  status: KitchenOrderStatus;
  order: {
    id: string;
    orderNumber: number;
    orderType: OrderType;
    customerName: string | null;
    table: { name: string | null; number: number } | null;
    deliveryDetails: { address: string } | null;
    customer: { name: string } | null;
    items: {
      id: string;
      name: string;
      quantity: number;
      variantNameSnapshot?: string | null;
      modifiers?: unknown;
      notes?: string | null;
      kitchenNotes?: string | null;
    }[];
  };
};

export async function getKitchenQueue(restaurantId: string) {
  return prisma.kitchenOrder.findMany({
    where: {
      ...openKitchenOrderStatusFilter(),
      order: {
        restaurantId,
        ...terminalOrderStatusFilter(),
      },
    },
    include: {
      order: {
        include: {
          items: {
            where: activeKitchenItemStatusFilter(),
            orderBy: { createdAt: "asc" },
          },
          table: { select: { name: true, number: true } },
          deliveryDetails: true,
          customer: { select: { name: true, phone: true } },
        },
      },
    },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

export function serializeKitchenTickets(
  tickets: Awaited<ReturnType<typeof getKitchenQueue>>
): SerializedKitchenTicket[] {
  return tickets.map((ticket) => ({
    id: ticket.id,
    status: ticket.status,
    order: {
      id: ticket.order.id,
      orderNumber: ticket.order.orderNumber,
      orderType: ticket.order.orderType,
      customerName: ticket.order.customerName,
      table: ticket.order.table,
      deliveryDetails: ticket.order.deliveryDetails
        ? { address: ticket.order.deliveryDetails.address }
        : null,
      customer: ticket.order.customer ? { name: ticket.order.customer.name } : null,
      items: ticket.order.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        variantNameSnapshot: item.variantNameSnapshot,
        modifiers: item.modifiers,
        notes: item.notes,
        kitchenNotes: item.kitchenNotes,
      })),
    },
  }));
}

export async function updateKitchenOrderStatus(
  kitchenOrderId: string,
  restaurantId: string,
  status: KitchenOrderStatus
) {
  const ko = await prisma.kitchenOrder.findFirst({
    where: { id: kitchenOrderId, order: { restaurantId } },
  });
  if (!ko) return null;

  return prisma.kitchenOrder.update({
    where: { id: kitchenOrderId },
    data: {
      status,
      ...(status === "COOKING" ? { startedAt: new Date() } : {}),
      ...(status === "READY" ? { readyAt: new Date() } : {}),
    },
  });
}

export async function getAnalyticsByOrderType(restaurantId: string, since: Date) {
  const orders = await prisma.order.groupBy({
    by: ["orderType"],
    where: {
      restaurantId,
      createdAt: { gte: since },
      status: { in: [OrderStatus.COMPLETED, OrderStatus.SERVED] },
    },
    _count: true,
    _sum: { total: true },
  });

  const topByType = await Promise.all(
    ([OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY] as const).map(async (orderType) => {
      const items = await prisma.orderItem.groupBy({
        by: ["name"],
        where: {
          order: {
            restaurantId,
            orderType,
            createdAt: { gte: since },
            status: { notIn: [OrderStatus.CANCELLED] },
          },
        },
        _sum: { quantity: true, totalPrice: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      });
      return { orderType, items };
    })
  );

  return { orders, topByType };
}
