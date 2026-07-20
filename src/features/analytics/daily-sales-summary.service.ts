import { OrderType } from "@prisma/client";
import { prisma } from "@/lib/db";

const ORDER_TYPES = [OrderType.DINE_IN, OrderType.TAKEAWAY, OrderType.DELIVERY] as const;

type AggregatedDayRow = {
  orderType: OrderType;
  orderCount: bigint | number;
  revenueTotal: bigint | number | null;
  itemQuantity: bigint | number | null;
};

function startOfLocalDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function endOfLocalDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(23, 59, 59, 999);
  return day;
}

async function aggregateDayRows(restaurantId: string, day: Date): Promise<AggregatedDayRow[]> {
  const dayStart = startOfLocalDay(day);
  const dayEnd = endOfLocalDay(day);

  return prisma.$queryRaw<AggregatedDayRow[]>`
    SELECT
      o."orderType" AS "orderType",
      COUNT(*)::bigint AS "orderCount",
      SUM(o.total)::bigint AS "revenueTotal",
      COALESCE(SUM(oi.quantity), 0)::bigint AS "itemQuantity"
    FROM "Order" o
    LEFT JOIN "OrderItem" oi ON oi."orderId" = o.id
    WHERE o."restaurantId" = ${restaurantId}
      AND o."createdAt" >= ${dayStart}
      AND o."createdAt" <= ${dayEnd}
      AND o.status::text != 'CANCELLED'
    GROUP BY o."orderType"
  `;
}

export async function syncDailySalesSummaryForRestaurantDay(
  restaurantId: string,
  day: Date
): Promise<number> {
  const dayKey = startOfLocalDay(day);
  const rows = await aggregateDayRows(restaurantId, day);
  const rowByType = new Map(rows.map((row) => [row.orderType, row]));
  let upserted = 0;

  for (const orderType of ORDER_TYPES) {
    const row = rowByType.get(orderType);
    const orderCount = Number(row?.orderCount ?? 0);
    const revenueTotal = Number(row?.revenueTotal ?? 0);
    const itemQuantity = Number(row?.itemQuantity ?? 0);

    await prisma.dailySalesSummary.upsert({
      where: {
        restaurantId_day_orderType: {
          restaurantId,
          day: dayKey,
          orderType,
        },
      },
      create: {
        restaurantId,
        day: dayKey,
        orderType,
        orderCount,
        revenueTotal,
        itemQuantity,
      },
      update: {
        orderCount,
        revenueTotal,
        itemQuantity,
        syncedAt: new Date(),
      },
    });
    upserted += 1;
  }

  return upserted;
}

export async function syncDailySalesSummaries(options?: {
  restaurantId?: string;
  day?: Date;
  lookbackDays?: number;
}): Promise<{ restaurants: number; days: number; rows: number }> {
  const lookbackDays = options?.lookbackDays ?? 1;
  const targetDay = options?.day ?? new Date();

  const restaurants = options?.restaurantId
    ? [{ id: options.restaurantId }]
    : await prisma.restaurant.findMany({
        where: { status: "ACTIVE", deletedAt: null },
        select: { id: true },
      });

  let rows = 0;
  for (const restaurant of restaurants) {
    for (let offset = 0; offset < lookbackDays; offset += 1) {
      const day = new Date(targetDay);
      day.setDate(day.getDate() - offset);
      rows += await syncDailySalesSummaryForRestaurantDay(restaurant.id, day);
    }
  }

  return {
    restaurants: restaurants.length,
    days: lookbackDays,
    rows,
  };
}

export async function restaurantHasSalesSummaries(
  restaurantId: string,
  since: Date
): Promise<boolean> {
  const row = await prisma.dailySalesSummary.findFirst({
    where: {
      restaurantId,
      day: { gte: startOfLocalDay(since) },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function getSalesSummaryRevenueByDay(
  restaurantId: string,
  from: Date,
  toExclusive: Date
): Promise<Map<string, number>> {
  const grouped = await prisma.dailySalesSummary.groupBy({
    by: ["day"],
    where: {
      restaurantId,
      day: { gte: startOfLocalDay(from), lt: toExclusive },
    },
    _sum: { revenueTotal: true },
    orderBy: { day: "asc" },
  });

  return new Map(
    grouped.map((row) => [new Date(row.day).toDateString(), row._sum.revenueTotal ?? 0])
  );
}

export async function getSalesSummaryTotals(
  restaurantId: string,
  from: Date,
  toExclusive: Date
): Promise<{ orderCount: number; revenueTotal: number }> {
  const agg = await prisma.dailySalesSummary.aggregate({
    where: {
      restaurantId,
      day: { gte: startOfLocalDay(from), lt: toExclusive },
    },
    _sum: { revenueTotal: true, orderCount: true },
  });

  return {
    orderCount: agg._sum.orderCount ?? 0,
    revenueTotal: agg._sum.revenueTotal ?? 0,
  };
}

export async function getLiveRevenueForDay(restaurantId: string, day: Date): Promise<number> {
  const dayStart = startOfLocalDay(day);
  const dayEnd = endOfLocalDay(day);

  const agg = await prisma.order.aggregate({
    where: {
      restaurantId,
      createdAt: { gte: dayStart, lte: dayEnd },
      status: { not: "CANCELLED" },
    },
    _sum: { total: true },
  });

  return agg._sum.total ?? 0;
}

export async function getLiveOrderStats(
  restaurantId: string,
  from: Date,
  to?: Date
): Promise<{ orderCount: number; revenueTotal: number }> {
  const agg = await prisma.order.aggregate({
    where: {
      restaurantId,
      createdAt: {
        gte: from,
        ...(to ? { lt: to } : {}),
      },
      status: { not: "CANCELLED" },
    },
    _count: true,
    _sum: { total: true },
  });

  return {
    orderCount: agg._count,
    revenueTotal: agg._sum.total ?? 0,
  };
}

export type DailyRevenuePoint = {
  label: string;
  value: number;
};

export { startOfLocalDay as startOfUtcDay };
