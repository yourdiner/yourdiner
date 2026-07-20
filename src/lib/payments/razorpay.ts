import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";

let razorpayInstance: Razorpay | null = null;

export function isRazorpayConfigured(): boolean {
  return !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export function getPublicRazorpayKeyId(): string | undefined {
  return process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID;
}

export function getRazorpay(): Razorpay | null {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return null;
  }

  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  return razorpayInstance;
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const left = Buffer.from(a, "hex");
    const right = Buffer.from(b, "hex");
    if (left.length === 0 || left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

export interface CreateSubscriptionParams {
  planId: string;
  customerId: string;
  totalCount?: number;
  notes?: Record<string, string>;
  addons?: Array<{
    name: string;
    amount: number;
    currency?: string;
  }>;
}

export interface CreateOrderParams {
  amount: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

export async function createRazorpaySubscription(
  params: CreateSubscriptionParams
): Promise<{ id: string; short_url?: string }> {
  const razorpay = getRazorpay();
  if (!razorpay) {
    throw new Error("Razorpay not configured");
  }

  return razorpay.subscriptions.create({
    plan_id: params.planId,
    customer_id: params.customerId,
    total_count: params.totalCount || 12,
    notes: params.notes,
    ...(params.addons?.length
      ? {
          addons: params.addons.map((addon) => ({
            item: {
              name: addon.name.slice(0, 250),
              amount: Math.round(addon.amount),
              currency: addon.currency ?? "INR",
            },
          })),
        }
      : {}),
  } as Parameters<typeof razorpay.subscriptions.create>[0]) as Promise<{
    id: string;
    short_url?: string;
  }>;
}

export async function createRazorpayOrder(
  params: CreateOrderParams
): Promise<{ id: string; amount: number; currency: string }> {
  const razorpay = getRazorpay();
  if (!razorpay) {
    throw new Error("Razorpay not configured");
  }

  const order = await razorpay.orders.create({
    amount: params.amount,
    currency: params.currency ?? "INR",
    receipt: params.receipt,
    notes: params.notes,
  });

  return {
    id: order.id,
    amount: Number(order.amount),
    currency: order.currency,
  };
}

export async function createRazorpayCustomer(
  name: string,
  email: string,
  contact?: string
): Promise<{ id: string }> {
  const razorpay = getRazorpay();
  if (!razorpay) {
    throw new Error("Razorpay not configured");
  }

  return razorpay.customers.create({ name, email, contact }) as Promise<{ id: string }>;
}

export async function cancelRazorpaySubscription(subscriptionId: string): Promise<void> {
  const razorpay = getRazorpay();
  if (!razorpay) return;
  await razorpay.subscriptions.cancel(subscriptionId);
}

export function getRazorpayErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const payload = error as {
      error?: { description?: string; reason?: string; field?: string };
      message?: string;
    };
    if (payload.error?.description) return payload.error.description;
    if (payload.error?.reason) return payload.error.reason;
    if (payload.message) return payload.message;
  }
  return error instanceof Error ? error.message : String(error);
}

export function isRazorpayClientError(error: unknown): boolean {
  if (error && typeof error === "object" && "statusCode" in error) {
    const code = Number((error as { statusCode: number | string }).statusCode);
    return code >= 400 && code < 500;
  }
  return false;
}

export async function createRazorpayPlan(params: {
  amount: number;
  period: "monthly" | "yearly";
  name: string;
  currency?: string;
}): Promise<{ id: string }> {
  const razorpay = getRazorpay();
  if (!razorpay) {
    throw new Error("Razorpay not configured");
  }

  const amount = Math.round(params.amount);
  if (amount < 100) {
    throw new Error(
      `Plan amount must be at least ₹1.00 (100 paise). Received ${amount} paise for "${params.name}".`
    );
  }

  const item = {
    name: params.name.slice(0, 250),
    amount,
    currency: params.currency ?? "INR",
    description: `${params.name} subscription`,
  };

  const billingOptions =
    params.period === "yearly"
      ? [
          { period: "yearly" as const, interval: 1 },
          { period: "monthly" as const, interval: 12 },
        ]
      : [{ period: "monthly" as const, interval: 1 }];

  let lastError: unknown;
  for (const billing of billingOptions) {
    try {
      const plan = await razorpay.plans.create({
        period: billing.period,
        interval: billing.interval,
        item,
      });
      return { id: plan.id };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(getRazorpayErrorMessage(lastError));
}

export interface RazorpayInvoiceEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_number?: string;
  short_url?: string;
  paid_at?: number;
  created_at?: number;
}

export async function fetchRazorpayInvoices(params: {
  subscriptionId?: string;
  customerId?: string;
}): Promise<RazorpayInvoiceEntity[]> {
  const razorpay = getRazorpay();
  if (!razorpay) return [];

  const query: Record<string, string | number> = { count: 100 };
  if (params.subscriptionId) query.subscription_id = params.subscriptionId;
  if (params.customerId) query.customer_id = params.customerId;

  const result = await razorpay.invoices.all(query);
  const items = (result as { items?: RazorpayInvoiceEntity[] }).items ?? [];
  return items;
}

export async function fetchRazorpaySubscription(subscriptionId: string) {
  const razorpay = getRazorpay();
  if (!razorpay) return null;
  return razorpay.subscriptions.fetch(subscriptionId) as Promise<{
    id: string;
    charge_at?: number;
    current_start?: number;
    current_end?: number;
    status: string;
    short_url?: string;
  }>;
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return safeEqualHex(expected, signature);
}

export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret || !signature) return false;

  const expected = createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return safeEqualHex(expected, signature);
}

export async function fetchRazorpayOrder(orderId: string): Promise<{
  id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string> | null;
}> {
  const razorpay = getRazorpay();
  if (!razorpay) throw new Error("Razorpay not configured");
  const order = await razorpay.orders.fetch(orderId);
  return {
    id: order.id,
    amount: Number(order.amount),
    currency: String(order.currency),
    status: String(order.status),
    notes: (order.notes as Record<string, string> | null | undefined) ?? null,
  };
}

export async function fetchRazorpayPayment(paymentId: string): Promise<{
  id: string;
  order_id?: string;
  amount: number;
  status: string;
}> {
  const razorpay = getRazorpay();
  if (!razorpay) throw new Error("Razorpay not configured");
  const payment = await razorpay.payments.fetch(paymentId);
  return {
    id: payment.id,
    order_id: payment.order_id ? String(payment.order_id) : undefined,
    amount: Number(payment.amount),
    status: String(payment.status),
  };
}

export interface PaymentProvider {
  createCustomer(name: string, email: string): Promise<{ id: string }>;
  createSubscription(planId: string, customerId: string): Promise<{ id: string; shortUrl?: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  createOrder(amount: number, receipt: string): Promise<{ id: string }>;
}
