import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import {
  tryClaimWebhookEvent,
  markWebhookProcessed,
  releaseWebhookClaim,
} from "@/lib/subscription";
import { logBillingAction } from "@/modules/subscription-engine/services/billing-audit.service";
import {
  handleSubscriptionAuthenticated,
  handleSubscriptionActivated,
  handleSubscriptionCharged,
  handleSubscriptionCompleted,
  handleSubscriptionCancelled,
  handlePaymentCaptured,
  handlePaymentFailedEvent,
  handleInvoiceCreated,
  handleInvoicePaid,
  handleInvoiceExpired,
  handleSubscriptionHaltedOrPending,
} from "@/modules/subscription-engine/webhooks/handlers";

export const runtime = "nodejs";

type WebhookPayload = Record<string, unknown>;

async function processWebhookEvent(eventType: string, payload: WebhookPayload) {
  switch (eventType) {
    case "subscription.authenticated":
      await handleSubscriptionAuthenticated(payload);
      break;
    case "subscription.activated":
      await handleSubscriptionActivated(payload);
      break;
    case "subscription.charged":
      await handleSubscriptionCharged(payload);
      break;
    case "subscription.completed":
      await handleSubscriptionCompleted(payload);
      break;
    case "subscription.cancelled":
      await handleSubscriptionCancelled(payload);
      break;
    case "payment.captured":
      await handlePaymentCaptured(payload);
      break;
    case "payment.failed":
      await handlePaymentFailedEvent(payload);
      break;
    case "invoice.created":
      await handleInvoiceCreated(payload);
      break;
    case "invoice.paid":
      await handleInvoicePaid(payload);
      break;
    case "invoice.expired":
      await handleInvoiceExpired(payload);
      break;
    case "subscription.halted":
    case "subscription.pending":
      await handleSubscriptionHaltedOrPending(payload);
      break;
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") || "";

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body);
  const { event: eventType, payload } = event;
  const eventId = typeof event.id === "string" ? event.id : null;

  if (!eventId) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  const claim = await tryClaimWebhookEvent(eventId, eventType, event);
  if (claim === "duplicate" || claim === "in_flight") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await processWebhookEvent(eventType, payload as WebhookPayload);
    await markWebhookProcessed(eventId, eventType, event);

    await logBillingAction({
      action: "WEBHOOK_RECEIVED",
      entityType: "WebhookEvent",
      entityId: eventId,
      metadata: { eventType },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    await releaseWebhookClaim(eventId);
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
