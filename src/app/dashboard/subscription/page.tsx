import { getSubscription, getPlans } from "@/features/subscriptions/actions";
import { SubscriptionView } from "@/features/subscriptions/components/subscription-view";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { getPublicRazorpayKeyId } from "@/lib/payments/razorpay";
import Script from "next/script";

export default async function SubscriptionPage() {
  const [subscription, plans] = await Promise.all([getSubscription(), getPlans()]);

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <AdminPageShell title="Subscription" showSearch={false}>
        <div className="mx-auto max-w-[1152px]">
          <p className="mb-6 text-sm text-on-surface-variant">
            Manage your plan, billing cycle, and payment history.
          </p>
          <SubscriptionView
            subscription={subscription}
            plans={plans}
            razorpayKeyId={getPublicRazorpayKeyId()}
          />
        </div>
      </AdminPageShell>
    </>
  );
}
