"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  adminExtendSubscription,
  adminSuspendSubscription,
  adminResumeSubscription,
  adminCancelSubscription,
} from "@/features/subscriptions/platform-actions";
import { ChangePlanDialog } from "@/features/subscriptions/components/change-plan-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type PlanOption = {
  id: string;
  name: string;
  slug: string;
  priceMonthly?: number;
  priceYearly?: number;
};

export function SubscriptionAdminActions({
  subscriptionId,
  status,
  plans,
  currentPlanId,
  currentPlanName,
  currentPeriodStart,
  currentPeriodEnd,
  billingCycle,
  pendingUpgradePlanId,
  pendingCheckout,
  pendingUpgradeAmount,
  pendingUpgradePlanName,
}: {
  subscriptionId: string;
  status: string;
  plans: PlanOption[];
  currentPlanId?: string;
  currentPlanName: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  billingCycle: "MONTHLY" | "YEARLY";
  pendingUpgradePlanId?: string | null;
  pendingCheckout?: boolean;
  pendingUpgradeAmount?: number | null;
  pendingUpgradePlanName?: string | null;
}) {
  const router = useRouter();
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);

  const displayStatus =
    pendingUpgradePlanId && pendingCheckout ? "Upgrade Pending Payment" : status;

  const run = async (action: () => Promise<unknown>, message: string) => {
    setLoading(true);
    try {
      await action();
      toast.success(message);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={displayStatus === "Upgrade Pending Payment" ? "secondary" : "outline"}>
          {displayStatus}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">
        Plan changes open Razorpay checkout for full plan price (no proration). The subscription
        updates only after payment succeeds. Schedule changes apply at the next renewal.
      </p>

      <ChangePlanDialog
        subscriptionId={subscriptionId}
        plans={plans}
        currentPlanId={currentPlanId}
        currentPlanName={currentPlanName}
        currentPeriodStart={currentPeriodStart}
        currentPeriodEnd={currentPeriodEnd}
        billingCycle={billingCycle}
        pendingUpgradePlanId={pendingUpgradePlanId}
        pendingUpgradeAmount={pendingUpgradeAmount}
        pendingUpgradePlanName={pendingUpgradePlanName}
      />

      <div className="flex flex-wrap gap-2">
        {status !== "SUSPENDED" ? (
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => run(() => adminSuspendSubscription(subscriptionId), "Suspended")}
          >
            Suspend
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => run(() => adminResumeSubscription(subscriptionId), "Resumed")}
          >
            Resume
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => run(() => adminCancelSubscription(subscriptionId), "Cancelled")}
        >
          Cancel
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <Input
          type="number"
          className="w-24"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
        />
        <Button
          size="sm"
          disabled={loading}
          onClick={() =>
            run(() => adminExtendSubscription(subscriptionId, days), `Extended by ${days} days`)
          }
        >
          Add Free Days
        </Button>
      </div>
    </div>
  );
}
