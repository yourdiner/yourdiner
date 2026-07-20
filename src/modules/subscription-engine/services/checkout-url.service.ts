import { InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPaymentProvider } from "../providers/razorpay-payment-provider";

const PAYABLE_INVOICE_STATUSES = new Set(["issued", "partially_paid", "pending"]);

type InvoiceLike = {
  status: string | InvoiceStatus;
  invoiceUrl?: string | null;
  createdAt?: Date | string;
};

function pickPayableInvoiceUrl(
  invoices: Array<{ status: string; short_url?: string; created_at?: number }>
): string | null {
  const payable = invoices
    .filter((inv) => inv.short_url && PAYABLE_INVOICE_STATUSES.has(inv.status))
    .sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0));

  return payable[0]?.short_url ?? null;
}

/** Prefer a pending invoice URL already stored locally (no Razorpay call). */
export function pickPayableInvoiceUrlFromRecords(invoices: InvoiceLike[]): string | null {
  const payable = invoices
    .filter(
      (inv) =>
        inv.invoiceUrl &&
        (inv.status === InvoiceStatus.PENDING || inv.status === "PENDING")
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
    );

  return payable[0]?.invoiceUrl ?? null;
}

export async function findLocalPayableInvoiceUrl(
  subscriptionId: string
): Promise<string | null> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      subscriptionId,
      status: InvoiceStatus.PENDING,
      invoiceUrl: { not: null },
    },
    orderBy: { createdAt: "desc" },
    select: { invoiceUrl: true },
  });

  return invoice?.invoiceUrl ?? null;
}

function isRateLimitError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /too many requests|rate limit/i.test(message);
}

/**
 * Razorpay subscription auth URLs (short_url) are broken on some test/live
 * accounts ("Hosted page is not available"), while the first-cycle invoice
 * short_url works. Prefer a payable invoice link when one exists.
 */
export async function resolveSubscriptionCheckoutUrl(input: {
  razorpaySubscriptionId: string;
  subscriptionShortUrl?: string | null;
  subscriptionId?: string;
  /** When false, only use local DB + stored URL (no Razorpay). Default false. */
  refresh?: boolean;
  /** Retry invoice fetch once — only for post-create flows. */
  retryInvoiceFetch?: boolean;
}): Promise<string | null> {
  if (input.subscriptionId) {
    const localUrl = await findLocalPayableInvoiceUrl(input.subscriptionId);
    if (localUrl) return localUrl;
  }

  if (!input.refresh) {
    return input.subscriptionShortUrl ?? null;
  }

  const provider = getPaymentProvider();
  if (!provider.isConfigured()) {
    return input.subscriptionShortUrl ?? null;
  }

  try {
    const [invoices, rzSub] = await Promise.all([
      provider.fetchInvoices({ subscriptionId: input.razorpaySubscriptionId }),
      provider.fetchSubscription(input.razorpaySubscriptionId),
    ]);

    let invoiceUrl = pickPayableInvoiceUrl(invoices);

    if (!invoiceUrl && input.retryInvoiceFetch) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const retryInvoices = await provider.fetchInvoices({
        subscriptionId: input.razorpaySubscriptionId,
      });
      invoiceUrl = pickPayableInvoiceUrl(retryInvoices);
    }

    if (invoiceUrl) return invoiceUrl;

    return rzSub?.short_url ?? input.subscriptionShortUrl ?? null;
  } catch (error) {
    if (isRateLimitError(error)) {
      return input.subscriptionShortUrl ?? null;
    }
    throw error;
  }
}

export async function persistPendingCheckoutUrl(
  subscriptionId: string,
  razorpaySubscriptionId: string,
  subscriptionShortUrl?: string | null,
  options?: { refresh?: boolean; retryInvoiceFetch?: boolean }
): Promise<string | null> {
  const checkoutUrl = await resolveSubscriptionCheckoutUrl({
    subscriptionId,
    razorpaySubscriptionId,
    subscriptionShortUrl,
    refresh: options?.refresh ?? false,
    retryInvoiceFetch: options?.retryInvoiceFetch ?? false,
  });

  if (checkoutUrl) {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { pendingCheckoutUrl: checkoutUrl },
    });
  }

  return checkoutUrl;
}

export async function applyLocalCheckoutUrlFromInvoices(
  subscriptionId: string,
  invoices: InvoiceLike[],
  currentUrl?: string | null
): Promise<string | null> {
  const localUrl = pickPayableInvoiceUrlFromRecords(invoices);
  if (!localUrl || localUrl === currentUrl) {
    return localUrl ?? currentUrl ?? null;
  }

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { pendingCheckoutUrl: localUrl },
  });

  return localUrl;
}
