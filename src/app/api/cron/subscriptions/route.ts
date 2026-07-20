import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SubscriptionStatus } from "@prisma/client";
import {
  sendRenewalReminder,
  sendSubscriptionExpired,
  sendGracePeriodReminder,
  sendSuspensionNotice,
} from "@/lib/email";
import {
  expireSubscription,
  inactivateRestaurantForBilling,
  logSubscriptionEvent,
} from "@/lib/subscription";
import { getGlobalGraceDays } from "@/modules/subscription-engine/services/platform-settings.service";
import { PaymentStatus } from "@prisma/client";
import { notifyRestaurantOwner, hasRecentEvent } from "@/modules/subscription-engine/services/notification.service";

export const runtime = "nodejs";

const REMINDER_DAYS = [7, 3, 1];

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let expiredTrials = 0;
  let expiredActive = 0;
  let inactivated = 0;
  let reminders = 0;
  let graceReminders = 0;

  const globalGraceDays = await getGlobalGraceDays();

  const expiredTrialSubs = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIAL,
      trialEndsAt: { lte: now },
    },
    include: {
      planVersion: true,
      restaurant: {
        include: {
          staff: { where: { role: "OWNER" }, include: { user: true } },
        },
      },
    },
  });

  for (const sub of expiredTrialSubs) {
    const hasPaid =
      sub.paymentStatus === PaymentStatus.PAID || !!sub.razorpaySubscriptionId;

    if (!hasPaid) {
      await inactivateRestaurantForBilling(sub.id, "TRIAL_EXPIRED");
      expiredTrials++;

      const owner = sub.restaurant.staff[0]?.user;
      if (owner?.email) {
        await sendSubscriptionExpired(owner.email, sub.restaurant.name);
      }
      await notifyRestaurantOwner({
        restaurantId: sub.restaurantId,
        title: "Trial expired",
        body: "Your trial has ended and your restaurant is now inactive. Purchase a plan to continue.",
        emailSubject: `Trial expired - ${sub.restaurant.name}`,
        emailHtml: `<p>Your trial for <strong>${sub.restaurant.name}</strong> has expired. Your restaurant is now inactive.</p>`,
      });
      continue;
    }
  }

  const expiredActiveSubs = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { lte: now },
    },
    include: { planVersion: true, restaurant: true },
  });

  for (const sub of expiredActiveSubs) {
    await expireSubscription(sub.id, globalGraceDays);
    expiredActive++;

    await notifyRestaurantOwner({
      restaurantId: sub.restaurantId,
      title: "Subscription expired",
      body: `Your subscription expired. You have ${globalGraceDays} days of grace period remaining.`,
      emailSubject: `Subscription expired - ${sub.restaurant.name}`,
      emailHtml: `<p>Your subscription for <strong>${sub.restaurant.name}</strong> has expired. Grace period: ${globalGraceDays} days.</p>`,
    });
  }

  const graceEnded = await prisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.EXPIRED, SubscriptionStatus.PAST_DUE] },
      gracePeriodEndsAt: { lte: now },
    },
    include: { restaurant: true },
  });

  for (const sub of graceEnded) {
    await inactivateRestaurantForBilling(sub.id, "GRACE_EXPIRED");
    inactivated++;

    await notifyRestaurantOwner({
      restaurantId: sub.restaurantId,
      title: "Restaurant inactive",
      body: "Your grace period has ended. Renew your subscription to restore full access.",
      emailSubject: `Restaurant inactive - ${sub.restaurant.name}`,
      emailHtml: `<p><strong>${sub.restaurant.name}</strong> is now inactive. Renew to continue.</p>`,
    });

    const owner = await prisma.staff.findFirst({
      where: { restaurantId: sub.restaurantId, role: "OWNER" },
      include: { user: true },
    });
    if (owner?.user?.email) {
      await sendSuspensionNotice(owner.user.email, sub.restaurant.name);
    }
  }

  for (const days of REMINDER_DAYS) {
    const targetStart = new Date(now.getTime() + (days - 1) * 24 * 60 * 60 * 1000);
    const targetEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const upcoming = await prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
        OR: [
          { currentPeriodEnd: { gte: targetStart, lte: targetEnd } },
          { trialEndsAt: { gte: targetStart, lte: targetEnd } },
        ],
      },
      include: {
        restaurant: {
          include: {
            staff: { where: { role: "OWNER" }, include: { user: true } },
          },
        },
      },
    });

    for (const sub of upcoming) {
      const alreadySent = await hasRecentEvent(sub.id, "EXPIRY_REMINDER", 20);
      if (alreadySent) continue;

      const owner = sub.restaurant.staff[0]?.user;
      if (owner?.email) {
        await sendRenewalReminder(owner.email, sub.restaurant.name, days);
      }

      await notifyRestaurantOwner({
        restaurantId: sub.restaurantId,
        title: `${days} day${days === 1 ? "" : "s"} until expiry`,
        body: `Your subscription expires in ${days} day${days === 1 ? "" : "s"}. Renew now.`,
      });

      await logSubscriptionEvent(sub.id, "EXPIRY_REMINDER", { days });
      reminders++;
    }
  }

  const inGrace = await prisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.EXPIRED, SubscriptionStatus.PAST_DUE] },
      gracePeriodEndsAt: { gt: now },
    },
    include: {
      restaurant: {
        include: {
          staff: { where: { role: "OWNER" }, include: { user: true } },
        },
      },
    },
  });

  for (const sub of inGrace) {
    const alreadySent = await hasRecentEvent(sub.id, "GRACE_REMINDER", 20);
    if (alreadySent) continue;

    const daysLeft = Math.ceil(
      ((sub.gracePeriodEndsAt?.getTime() ?? now.getTime()) - now.getTime()) /
        (24 * 60 * 60 * 1000)
    );

    const owner = sub.restaurant.staff[0]?.user;
    if (owner?.email && sub.gracePeriodEndsAt) {
      await sendGracePeriodReminder(owner.email, sub.restaurant.name, daysLeft);
    }

    await notifyRestaurantOwner({
      restaurantId: sub.restaurantId,
      title: `${daysLeft} day${daysLeft === 1 ? "" : "s"} of grace remaining`,
      body: `Your restaurant will stop working in ${daysLeft} day${daysLeft === 1 ? "" : "s"}. Renew now.`,
    });

    await logSubscriptionEvent(sub.id, "GRACE_REMINDER", { daysLeft });
    graceReminders++;
  }

  return NextResponse.json({
    processed: {
      expiredTrials,
      expiredActive,
      inactivated,
      reminders,
      graceReminders,
    },
  });
}
