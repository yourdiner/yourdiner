import { prisma } from "@/lib/db";
import { ReservationStatus } from "@prisma/client";
import { getRestaurantReservationSettings } from "@/lib/reservation-settings";
import { markNoShow } from "./reservation.service";
import { createInAppNotification } from "@/modules/subscription-engine/services/notification.service";

export async function runReservationScheduler() {
  const now = new Date();
  let noShows = 0;
  let upcomingReminders = 0;

  const dueReservations = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.CONFIRMED,
      holdExpiresAt: { lte: now },
    },
    include: { restaurant: { select: { id: true } } },
  });

  for (const reservation of dueReservations) {
    const settings = await getRestaurantReservationSettings(reservation.restaurantId);
    if (!settings.autoMarkNoShow) continue;

    try {
      await markNoShow(reservation.id, reservation.restaurantId, undefined, "cron");
      noShows++;

      if (settings.autoReleaseOnNoShow) {
        await createInAppNotification({
          restaurantId: reservation.restaurantId,
          title: "Reservation no show",
          body: `${reservation.guestName} marked no show — table released`,
        });
      }
    } catch {
      // skip failed rows
    }
  }

  const reminderWindow = new Date(now.getTime() + 30 * 60 * 1000);
  const upcoming = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.CONFIRMED,
      reservedAt: { gt: now, lte: reminderWindow },
    },
    distinct: ["restaurantId"],
  });

  for (const r of upcoming) {
    const recent = await prisma.reservationEvent.findFirst({
      where: {
        reservationId: r.id,
        type: "UPDATED",
        message: { contains: "upcoming reminder" },
        createdAt: { gte: new Date(now.getTime() - 25 * 60 * 1000) },
      },
    });
    if (recent) continue;

    await createInAppNotification({
      restaurantId: r.restaurantId,
      title: "Upcoming reservation",
      body: `${r.guestName} arrives in ~30 minutes`,
    });
    upcomingReminders++;
  }

  return { noShows, upcomingReminders, processed: dueReservations.length };
}
