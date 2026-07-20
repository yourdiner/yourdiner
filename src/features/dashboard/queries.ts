import { prisma } from "@/lib/db";
import { cancelledOrderStatusFilter } from "@/lib/prisma-filters";
import {
  getLiveOrderStats,
  getLiveRevenueForDay,
  getSalesSummaryRevenueByDay,
  getSalesSummaryTotals,
  restaurantHasSalesSummaries,
  startOfUtcDay,
} from "@/features/analytics/daily-sales-summary.service";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DailyRevenueRow = {
  day: Date;
  total: bigint | number | null;
};

async function getWeeklyRevenueStatsLive(restaurantId: string, sevenDaysAgo: Date) {
  const where = {
    restaurantId,
    createdAt: { gte: sevenDaysAgo },
    ...cancelledOrderStatusFilter(),
  };

  const [totalAgg, dailyRows] = await Promise.all([
    prisma.order.aggregate({
      where,
      _sum: { total: true },
    }),
    prisma.$queryRaw<DailyRevenueRow[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS day, SUM(total)::bigint AS total
      FROM "Order"
      WHERE "restaurantId" = ${restaurantId}
        AND "createdAt" >= ${sevenDaysAgo}
        AND status::text != 'CANCELLED'
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day ASC
    `,
  ]);

  const revenueByDay = new Map(
    dailyRows.map((row) => [new Date(row.day).toDateString(), Number(row.total ?? 0)])
  );

  const dailyRevenue = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(date.getDate() + i);
    return {
      label: DAY_LABELS[date.getDay()],
      value: revenueByDay.get(date.toDateString()) ?? 0,
    };
  });

  return {
    totalRevenue: totalAgg._sum.total ?? 0,
    dailyRevenue,
  };
}

export async function getWeeklyRevenueStats(restaurantId: string, sevenDaysAgo: Date) {
  const hasSummaries = await restaurantHasSalesSummaries(restaurantId, sevenDaysAgo);
  if (!hasSummaries) {
    return getWeeklyRevenueStatsLive(restaurantId, sevenDaysAgo);
  }

  const todayStart = startOfUtcDay(new Date());
  const [summaryByDay, summaryTotals, todayRevenue] = await Promise.all([
    getSalesSummaryRevenueByDay(restaurantId, sevenDaysAgo, todayStart),
    getSalesSummaryTotals(restaurantId, sevenDaysAgo, todayStart),
    getLiveRevenueForDay(restaurantId, new Date()),
  ]);

  const dailyRevenue = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(date.getDate() + i);
    const isToday = date.toDateString() === new Date().toDateString();
    const value = isToday
      ? todayRevenue
      : (summaryByDay.get(date.toDateString()) ?? 0);
    return {
      label: DAY_LABELS[date.getDay()],
      value,
    };
  });

  return {
    totalRevenue: summaryTotals.revenueTotal + todayRevenue,
    dailyRevenue,
  };
}

export async function getThirtyDayOrderStats(restaurantId: string, thirtyDaysAgo: Date) {
  const hasSummaries = await restaurantHasSalesSummaries(restaurantId, thirtyDaysAgo);
  if (!hasSummaries) {
    const live = await getLiveOrderStats(restaurantId, thirtyDaysAgo);
    return {
      orderCount: live.orderCount,
      revenueTotal: live.revenueTotal,
    };
  }

  const todayStart = startOfUtcDay(new Date());
  const [summaryTotals, todayLive] = await Promise.all([
    getSalesSummaryTotals(restaurantId, thirtyDaysAgo, todayStart),
    getLiveOrderStats(restaurantId, todayStart),
  ]);

  return {
    orderCount: summaryTotals.orderCount + todayLive.orderCount,
    revenueTotal: summaryTotals.revenueTotal + todayLive.revenueTotal,
  };
}
