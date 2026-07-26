"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  subscribeToPlan,
  cancelSubscription,
  renewSubscription,
  verifyRenewalPayment,
  upgradePlan,
  downgradePlan,
} from "@/features/subscriptions/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { Check } from "lucide-react";
import type { PlanWithLatest } from "@/modules/subscription-engine/types";
import { UpgradeCheckoutButton } from "@/features/subscriptions/components/upgrade-checkout-button";

interface SubscriptionViewProps {
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    pricePaid: number;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
    renewalDate: Date | null;
    nextPaymentAt: Date | null;
    gracePeriodEndsAt: Date | null;
    paymentStatus: string;
    autoDebitEnabled?: boolean;
    mandateStatus?: string;
    currentPeriodStart?: Date | null;
    scheduledPlan?: { name: string; slug: string } | null;
    scheduledChangeAt: Date | null;
    pendingUpgradePlanId?: string | null;
    pendingCheckout?: boolean;
    pendingUpgradeAmount?: number | null;
    pendingCheckoutUrl?: string | null;
    razorpaySubscriptionId?: string | null;
    plan: { slug: string; name: string };
    planVersion?: { versionNumber: number } | null;
    invoices: Array<{
      id: string;
      amount: number;
      status: string;
      paidAt: Date | null;
      createdAt: Date;
      invoiceNumber?: string | null;
      invoiceUrl?: string | null;
    }>;
    payments: Array<{
      id: string;
      amount: number;
      status: string;
      paidAt: Date | null;
      createdAt: Date;
      taxAmount?: number;
      paymentMethod?: string | null;
      receiptUrl?: string | null;
    }>;
  } | null;
  plans: PlanWithLatest[];
  razorpayKeyId?: string | null;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export function SubscriptionView({ subscription, plans, razorpayKeyId }: SubscriptionViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("MONTHLY");

  const currentSlug = subscription?.plan.slug;

  const openRazorpayCheckout = (order: {
    orderId: string;
    amount: number;
    currency: string;
    keyId?: string;
  }) => {
    const key = order.keyId || razorpayKeyId;
    if (!key || !window.Razorpay) {
      toast.error("Payment gateway not available");
      return;
    }

    const rzp = new window.Razorpay({
      key,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        try {
          await verifyRenewalPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          toast.success("Payment received — activating shortly");
          router.refresh();
        } catch {
          toast.error("Payment verification failed");
        }
      },
    });
    rzp.open();
  };

  const handleSubscribe = async (planSlug: string) => {
    setLoading(planSlug);
    try {
      const result = await subscribeToPlan({ planSlug, billingCycle });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error("Could not open Razorpay checkout. Check payment gateway configuration.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(null);
    }
  };

  const handleRenew = async () => {
    setLoading("renew");
    try {
      const result = await renewSubscription();
      if (result.orderId && result.amount) {
        openRazorpayCheckout({
          orderId: result.orderId,
          amount: result.amount,
          currency: result.currency || "INR",
          keyId: result.keyId,
        });
      } else {
        toast.success("Subscription renewed!");
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(null);
    }
  };

  const handleUpgrade = async (planSlug: string) => {
    setLoading(planSlug);
    try {
      const result = await upgradePlan({ planSlug, billingCycle });
      if (result.requiresPayment && result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        toast.error("Could not open Razorpay checkout");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(null);
    }
  };

  const handleDowngrade = async (planSlug: string) => {
    setLoading(planSlug);
    try {
      await downgradePlan({ planSlug });
      toast.success("Downgrade scheduled for next renewal");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!confirm("Cancel your subscription?")) return;
    try {
      await cancelSubscription();
      toast.success("Subscription cancelled");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    }
  };

  const pendingUpgradePlan = subscription?.pendingUpgradePlanId
    ? plans.find((p) => p.id === subscription.pendingUpgradePlanId)
    : null;

  const displayStatus =
    subscription?.pendingUpgradePlanId && subscription.pendingCheckout
      ? "Upgrade Pending Payment"
      : subscription?.status;

  const planIndex = (slug: string) => plans.findIndex((p) => p.slug === slug);

  return (
    <div className="space-y-8">
      {subscription && (
        <Card>
          <CardHeader>
            <CardTitle>Current Subscription</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-lg font-semibold">{subscription.plan.name}</span>
              <Badge>{displayStatus}</Badge>
              {subscription.planVersion && (
                <Badge variant="outline">v{subscription.planVersion.versionNumber}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(subscription.pricePaid)} /{" "}
              {subscription.billingCycle === "YEARLY" ? "year" : "month"}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 text-sm">
              <p>
                <span className="text-muted-foreground">Auto Debit: </span>
                {subscription.autoDebitEnabled ? "Enabled" : "Disabled"}
              </p>
              <p>
                <span className="text-muted-foreground">Mandate: </span>
                {subscription.mandateStatus ?? "NONE"}
              </p>
              {subscription.currentPeriodStart && subscription.currentPeriodEnd && (
                <p className="sm:col-span-2">
                  <span className="text-muted-foreground">Current cycle: </span>
                  {formatDate(subscription.currentPeriodStart)} –{" "}
                  {formatDate(subscription.currentPeriodEnd)}
                </p>
              )}
              {subscription.renewalDate && (
                <p>
                  <span className="text-muted-foreground">Renewal: </span>
                  {formatDate(subscription.renewalDate)}
                </p>
              )}
            </div>
            {subscription.trialEndsAt && subscription.status === "TRIAL" && (
              <p className="text-sm text-muted-foreground">
                Trial ends: {formatDate(subscription.trialEndsAt)}
              </p>
            )}
            {subscription.currentPeriodEnd && (
              <p className="text-sm text-muted-foreground">
                Current period ends: {formatDate(subscription.currentPeriodEnd)}
              </p>
            )}
            {subscription.nextPaymentAt && (
              <p className="text-sm text-muted-foreground">
                Next payment: {formatDate(subscription.nextPaymentAt)}
              </p>
            )}
            {subscription.pendingUpgradePlanId && subscription.pendingCheckout && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-2">
                <p>
                  Upgrade to <strong>{pendingUpgradePlan?.name ?? "new plan"}</strong> is pending
                  payment.
                  {subscription.pendingUpgradeAmount != null &&
                    ` ${formatCurrency(subscription.pendingUpgradeAmount)} due now.`}
                  {" "}Your current plan stays active until payment succeeds. Full plan price — new
                  billing cycle starts on payment.
                </p>
                <UpgradeCheckoutButton
                  planSlug={pendingUpgradePlan?.slug ?? currentSlug ?? ""}
                  billingCycle={billingCycle}
                  label="Complete Payment"
                  size="sm"
                  resume={{
                    checkoutUrl: subscription.pendingCheckoutUrl,
                    planName: pendingUpgradePlan?.name ?? "your new plan",
                  }}
                />
              </div>
            )}
            {subscription.scheduledPlan && subscription.scheduledChangeAt && (
              <p className="text-sm text-amber-700">
                Downgrade to {subscription.scheduledPlan.name} scheduled for{" "}
                {formatDate(subscription.scheduledChangeAt)}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(subscription.status === "EXPIRED" ||
                subscription.status === "PAST_DUE" ||
                subscription.status === "SUSPENDED") && (
                <Button size="sm" onClick={handleRenew} disabled={loading === "renew"}>
                  {loading === "renew" ? "Processing..." : "Renew Subscription"}
                </Button>
              )}
              {subscription.status === "ACTIVE" && (
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancel Subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button
          variant={billingCycle === "MONTHLY" ? "default" : "outline"}
          size="sm"
          onClick={() => setBillingCycle("MONTHLY")}
        >
          Monthly
        </Button>
        <Button
          variant={billingCycle === "YEARLY" ? "default" : "outline"}
          size="sm"
          onClick={() => setBillingCycle("YEARLY")}
        >
          Yearly
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = currentSlug === plan.slug;
          const currentIdx = currentSlug ? planIndex(currentSlug) : -1;
          const thisIdx = planIndex(plan.slug);
          const isUpgrade = currentIdx >= 0 && thisIdx > currentIdx;
          const isDowngrade = currentIdx >= 0 && thisIdx < currentIdx;
          const price =
            billingCycle === "YEARLY"
              ? plan.latestVersion?.pricing?.priceYearly
              : plan.latestVersion?.pricing?.priceMonthly;

          return (
            <Card key={plan.id} className={isCurrent ? "border-primary" : ""}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-3xl font-bold">
                    {formatCurrency(price ?? 0)}
                  </span>
                  <span className="text-muted-foreground">
                    /{billingCycle === "YEARLY" ? "year" : "month"}
                  </span>
                </div>
                <ul className="space-y-1 text-sm">
                  {plan.latestVersion?.features.slice(0, 8).map((f) => (
                    <li key={f.code} className="flex items-center gap-2">
                      <Check className="h-3 w-3 text-emerald-500" />
                      {f.name}
                    </li>
                  ))}
                </ul>
                {isUpgrade &&
                !isCurrent &&
                !(subscription?.pendingCheckout && subscription?.pendingUpgradePlanId) ? (
                  <UpgradeCheckoutButton
                    planSlug={plan.slug}
                    billingCycle={billingCycle}
                    label="Upgrade"
                    className="w-full"
                  />
                ) : (
                  <Button
                    className="w-full"
                    variant={isCurrent ? "secondary" : "default"}
                    disabled={
                      isCurrent ||
                      loading === plan.slug ||
                      !!(subscription?.pendingCheckout && subscription.pendingUpgradePlanId)
                    }
                    onClick={() => {
                      if (isUpgrade) handleUpgrade(plan.slug);
                      else if (isDowngrade) handleDowngrade(plan.slug);
                      else handleSubscribe(plan.slug);
                    }}
                  >
                    {isCurrent
                      ? "Current Plan"
                      : subscription?.pendingCheckout && subscription.pendingUpgradePlanId
                        ? "Upgrade Pending"
                        : loading === plan.slug
                          ? "Processing..."
                          : isUpgrade
                            ? "Upgrade"
                            : isDowngrade
                              ? "Schedule at Renewal"
                              : "Subscribe"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {subscription && subscription.payments.length > 0 && (
        <Card id="history">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Tax</th>
                  <th className="pb-2">Method</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {subscription.payments.map((payment) => (
                  <tr key={payment.id} className="border-b">
                    <td className="py-2">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </td>
                    <td className="py-2">{formatCurrency(payment.amount)}</td>
                    <td className="py-2">{formatCurrency(payment.taxAmount ?? 0)}</td>
                    <td className="py-2">{payment.paymentMethod ?? "—"}</td>
                    <td className="py-2">
                      <Badge variant="outline">{payment.status}</Badge>
                    </td>
                    <td className="py-2">
                      {payment.receiptUrl ? (
                        <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                          Download
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {subscription && subscription.invoices.length > 0 && (
        <Card id="invoices">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {subscription.invoices.map((inv) => (
                  <tr key={inv.id} className="border-b">
                    <td className="py-2">{formatDate(inv.createdAt)}</td>
                    <td className="py-2">{formatCurrency(inv.amount)}</td>
                    <td className="py-2">
                      <Badge variant="outline">{inv.status}</Badge>
                    </td>
                    <td className="py-2">
                      {inv.invoiceUrl ? (
                        <a
                          href={inv.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline"
                        >
                          Download
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
