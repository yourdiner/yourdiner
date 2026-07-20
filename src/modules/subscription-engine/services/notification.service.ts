import { prisma } from "@/lib/db";
import { NotificationType } from "@prisma/client";

export async function createInAppNotification(input: {
  restaurantId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      restaurantId: input.restaurantId,
      type: NotificationType.IN_APP,
      title: input.title,
      body: input.body,
      data: (input.data ?? {}) as object,
    },
  });
}

export async function notifyRestaurantOwner(input: {
  restaurantId: string;
  title: string;
  body: string;
  emailSubject?: string;
  emailHtml?: string;
  data?: Record<string, unknown>;
}) {
  const owner = await prisma.staff.findFirst({
    where: { restaurantId: input.restaurantId, role: "OWNER" },
    include: { user: true },
  });

  await createInAppNotification({
    restaurantId: input.restaurantId,
    title: input.title,
    body: input.body,
    data: input.data,
  });

  if (owner?.user?.email && input.emailSubject && input.emailHtml) {
    const { sendEmail } = await import("@/lib/email");
    await sendEmail({
      to: owner.user.email,
      subject: input.emailSubject,
      html: input.emailHtml,
    });
  }
}

export async function hasRecentEvent(
  subscriptionId: string,
  eventType: string,
  withinHours: number
): Promise<boolean> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000);
  const event = await prisma.subscriptionEvent.findFirst({
    where: {
      subscriptionId,
      type: eventType as never,
      createdAt: { gte: since },
    },
  });
  return !!event;
}
