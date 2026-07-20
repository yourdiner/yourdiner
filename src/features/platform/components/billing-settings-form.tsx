"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBillingSettings } from "@/features/platform/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequiredLabel } from "@/components/ui/required-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface BillingSettingsFormProps {
  defaultTrialDays: number;
  globalGracePeriodDays: number;
  razorpayConfigured: boolean;
}

export function BillingSettingsForm({
  defaultTrialDays: initialTrialDays,
  globalGracePeriodDays: initialGraceDays,
  razorpayConfigured,
}: BillingSettingsFormProps) {
  const router = useRouter();
  const [trialDays, setTrialDays] = useState(initialTrialDays);
  const [graceDays, setGraceDays] = useState(initialGraceDays);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await updateBillingSettings({
        defaultTrialDays: trialDays,
        globalGracePeriodDays: graceDays,
      });
      toast.success("Billing settings saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing & Subscriptions</CardTitle>
        <CardDescription>
          Global trial and grace period settings apply to all restaurants and plans.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <RequiredLabel htmlFor="trialDays">Default trial days</RequiredLabel>
            <Input
              id="trialDays"
              type="number"
              min={0}
              max={365}
              value={trialDays}
              onChange={(e) => setTrialDays(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Restaurants are suspended the day after trial ends if no plan is purchased.
            </p>
          </div>
          <div className="space-y-2">
            <RequiredLabel htmlFor="graceDays">Global grace period (days)</RequiredLabel>
            <Input
              id="graceDays"
              type="number"
              min={0}
              max={90}
              value={graceDays}
              onChange={(e) => setGraceDays(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Applies only to expired paid subscriptions, not trials.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Razorpay</span>
          <Badge variant={razorpayConfigured ? "default" : "secondary"}>
            {razorpayConfigured ? "Configured" : "Not configured"}
          </Badge>
          {!razorpayConfigured && (
            <span className="text-xs text-muted-foreground">
              Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env
            </span>
          )}
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save billing settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
