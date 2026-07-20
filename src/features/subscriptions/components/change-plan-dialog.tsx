"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminInitiatePlanChange } from "@/features/subscriptions/platform-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

type PlanOption = {
  id: string;
  name: string;
  priceMonthly?: number;
  priceYearly?: number;
};

export function ChangePlanDialog({
  subscriptionId,
  plans,
  currentPlanId,
  currentPlanName,
  currentPeriodStart,
  currentPeriodEnd,
  billingCycle: initialBillingCycle,
  pendingUpgradePlanId,
  pendingUpgradeAmount,
  pendingUpgradePlanName,
}: {
  subscriptionId: string;
  plans: PlanOption[];
  currentPlanId?: string;
  currentPlanName: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  billingCycle: "MONTHLY" | "YEARLY";
  pendingUpgradePlanId?: string | null;
  pendingUpgradeAmount?: number | null;
  pendingUpgradePlanName?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [planId, setPlanId] = useState(plans.find((p) => p.id !== currentPlanId)?.id ?? "");
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">(initialBillingCycle);
  const [effective, setEffective] = useState<"IMMEDIATE" | "NEXT_RENEWAL">("IMMEDIATE");

  const selectedPlan = plans.find((p) => p.id === planId);
  const fullPrice =
    billingCycle === "YEARLY"
      ? selectedPlan?.priceYearly
      : selectedPlan?.priceMonthly;

  const periodLabel =
    currentPeriodStart && currentPeriodEnd
      ? `${formatDate(currentPeriodStart)} → ${formatDate(currentPeriodEnd)}`
      : "—";

  const handleSubmit = async () => {
    if (!planId || planId === currentPlanId) {
      toast.error("Select a different plan");
      return;
    }

    setLoading(true);
    try {
      const result = await adminInitiatePlanChange({
        subscriptionId,
        planId,
        billingCycle,
        effective,
      });

      if ("scheduled" in result && result.scheduled) {
        toast.success(`Plan change to ${selectedPlan?.name} scheduled for next renewal`);
      } else if ("checkoutUrl" in result && result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        toast.success(
          result.chargeAmount
            ? `Checkout opened — ${formatCurrency(result.chargeAmount)} due now (full plan price, new cycle on payment)`
            : "Razorpay checkout opened"
        );
      }

      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Change Plan</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Plan</DialogTitle>
          <DialogDescription>
            Immediate changes require full payment for the new plan. Your current plan stays active
            until payment succeeds. No proration — a fresh billing cycle starts on payment.
          </DialogDescription>
        </DialogHeader>

        {pendingUpgradePlanId && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Upgrade pending payment
            {pendingUpgradePlanName ? ` to ${pendingUpgradePlanName}` : ""}
            {pendingUpgradeAmount ? ` — ${formatCurrency(pendingUpgradeAmount)}` : ""}
          </div>
        )}

        <div className="space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground">Current plan</p>
            <p className="font-medium">
              {currentPlanName} · {periodLabel}
            </p>
          </div>

          <div className="space-y-2">
            <p className="font-medium">New plan</p>
            <Select value={planId} onValueChange={setPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {plans
                  .filter((p) => p.id !== currentPlanId)
                  .map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Billing cycle</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={billingCycle === "MONTHLY" ? "default" : "outline"}
                onClick={() => setBillingCycle("MONTHLY")}
              >
                Monthly
              </Button>
              <Button
                type="button"
                size="sm"
                variant={billingCycle === "YEARLY" ? "default" : "outline"}
                onClick={() => setBillingCycle("YEARLY")}
              >
                Yearly
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="font-medium">Effective</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={effective === "IMMEDIATE" ? "default" : "outline"}
                onClick={() => setEffective("IMMEDIATE")}
              >
                Immediately
              </Button>
              <Button
                type="button"
                size="sm"
                variant={effective === "NEXT_RENEWAL" ? "default" : "outline"}
                onClick={() => setEffective("NEXT_RENEWAL")}
              >
                From Next Renewal
              </Button>
            </div>
          </div>

          {effective === "IMMEDIATE" && selectedPlan && fullPrice != null && (
            <div className="rounded-md bg-muted px-3 py-2">
              <p className="text-muted-foreground">Payment due now</p>
              <p className="text-lg font-semibold">
                {formatCurrency(fullPrice)} / {billingCycle === "YEARLY" ? "year" : "month"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !planId}>
            {loading
              ? "Processing..."
              : effective === "IMMEDIATE"
                ? "Generate Payment"
                : "Schedule Change"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
