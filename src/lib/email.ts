import { Resend } from "resend";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const client = getResend();
  if (!client) {
    console.log(`[Email] To: [REDACTED] | Subject: ${params.subject}`);
    return true;
  }

  const { error } = await client.emails.send({
    from: process.env.EMAIL_FROM || "noreply@restaurant-os.com",
    to: params.to,
    subject: params.subject,
    html: params.html,
  });

  if (error) {
    console.error("Email send error");
    return false;
  }

  return true;
}

export async function sendRenewalReminder(
  email: string,
  restaurantName: string,
  daysLeft: number
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Subscription renewal reminder - ${restaurantName}`,
    html: `
      <h2>Subscription Renewal Reminder</h2>
      <p>Your subscription for <strong>${restaurantName}</strong> will expire in <strong>${daysLeft} days</strong>.</p>
      <p>Please renew your subscription to continue using all features.</p>
    `,
  });
}

export async function sendSubscriptionExpired(
  email: string,
  restaurantName: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Subscription expired - ${restaurantName}`,
    html: `
      <h2>Subscription Expired</h2>
      <p>Your subscription for <strong>${restaurantName}</strong> has expired.</p>
      <p>Your grace period has started. Renew now to avoid interruption.</p>
    `,
  });
}

export async function sendGracePeriodReminder(
  email: string,
  restaurantName: string,
  daysLeft: number
): Promise<boolean> {
  const dayLabel = daysLeft === 1 ? "1 day" : `${daysLeft} days`;
  return sendEmail({
    to: email,
    subject: `Grace period reminder - ${restaurantName}`,
    html: `
      <h2>Grace Period Reminder</h2>
      <p>Your subscription for <strong>${restaurantName}</strong> is in grace period.</p>
      <p>Your restaurant will stop working in <strong>${dayLabel}</strong>. Renew now to continue uninterrupted.</p>
    `,
  });
}

export async function sendSuspensionNotice(
  email: string,
  restaurantName: string
): Promise<boolean> {
  return sendEmail({
    to: email,
    subject: `Restaurant suspended - ${restaurantName}`,
    html: `
      <h2>Restaurant Suspended</h2>
      <p>Your grace period for <strong>${restaurantName}</strong> has ended.</p>
      <p>Your restaurant is now in read-only mode. Renew your subscription to restore full access.</p>
    `,
  });
}
