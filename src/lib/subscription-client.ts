export type UpgradeCheckoutResponse =
  | {
      ok: true;
      razorpaySubscriptionId: string;
      checkoutUrl?: string;
      amount?: number;
      planName: string;
      keyId?: string;
    }
  | { ok: false; error: string };

export type SubscriptionStatusResponse =
  | {
      ok: true;
      status: string;
      active: boolean;
      pendingCheckout: boolean;
      pendingUpgradePlanId: string | null;
      planSlug: string;
      planName: string;
    }
  | { ok: false; error: string };

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      ok: false,
      error: text.slice(0, 200) || `Request failed (${res.status})`,
    } as T;
  }
}

export async function createUpgradeCheckout(input: {
  planSlug: string;
  billingCycle: "MONTHLY" | "YEARLY";
}): Promise<UpgradeCheckoutResponse> {
  const res = await fetch("/api/admin/subscription/upgrade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<UpgradeCheckoutResponse>(res);
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
  const res = await fetch("/api/admin/subscription/status", { cache: "no-store" });
  return parseJson<SubscriptionStatusResponse>(res);
}

export type PendingCheckoutResponse =
  | { ok: true; checkoutUrl: string }
  | { ok: false; error: string };

export async function fetchPendingCheckoutUrl(): Promise<PendingCheckoutResponse> {
  const res = await fetch("/api/admin/subscription/checkout", { cache: "no-store" });
  return parseJson<PendingCheckoutResponse>(res);
}
