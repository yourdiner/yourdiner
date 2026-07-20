"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRestaurantSettings } from "@/lib/settings-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import type { LoyaltySettings } from "@/lib/loyalty-settings";

interface SettingsLoyaltyProps {
  loyaltySettings: LoyaltySettings;
}

export function SettingsLoyalty({ loyaltySettings }: SettingsLoyaltyProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<LoyaltySettings>(loyaltySettings);

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateRestaurantSettings({ loyaltySettings: form });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Loyalty settings saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Loyalty Program</CardTitle>
        <CardDescription>
          Configure how customers earn and redeem loyalty points at checkout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label htmlFor="loyalty-enabled">Enable loyalty system</Label>
            <p className="text-sm text-muted-foreground">
              Allow earning and redeeming points during checkout
            </p>
          </div>
          <Switch
            id="loyalty-enabled"
            checked={form.enabled}
            onCheckedChange={(enabled) => setForm({ ...form, enabled })}
          />
        </div>

        {form.enabled && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Earn rate (% of bill)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.earnPercentOfBill}
                onChange={(e) =>
                  setForm({ ...form, earnPercentOfBill: Number(e.target.value) || 0 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Percentage of the paid bill added as loyalty points after checkout
              </p>
            </div>
            <div className="space-y-2">
              <Label>Point value (₹ per point)</Label>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                value={form.pointValueInRupees}
                onChange={(e) =>
                  setForm({ ...form, pointValueInRupees: Number(e.target.value) || 1 })
                }
              />
              <p className="text-xs text-muted-foreground">
                1 loyalty point = this many rupees when redeemed
              </p>
            </div>
          </div>
        )}

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save Loyalty Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
