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
import type { OrderSettings } from "@/lib/order-settings";

interface SettingsOrdersProps {
  orderSettings: OrderSettings;
}

export function SettingsOrders({ orderSettings }: SettingsOrdersProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<OrderSettings>(orderSettings);

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateRestaurantSettings({ orderSettings: form });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Order settings saved");
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
        <CardTitle>Customer QR ordering</CardTitle>
        <CardDescription>
          Control first-order approval and inactivity timeout for customer table sessions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label htmlFor="require-first-order">Require first order approval</Label>
            <p className="text-sm text-muted-foreground">
              Hold a customer&apos;s first order until staff approves it before sending to kitchen.
            </p>
          </div>
          <Switch
            id="require-first-order"
            checked={form.requireFirstOrderApproval !== false}
            onCheckedChange={(checked) =>
              setForm((prev) => ({ ...prev, requireFirstOrderApproval: checked }))
            }
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inactivity-minutes">Session inactivity timeout (minutes)</Label>
          <Input
            id="inactivity-minutes"
            type="number"
            min={15}
            max={720}
            value={form.customerSessionInactivityMinutes ?? 120}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                customerSessionInactivityMinutes: Number(e.target.value) || 120,
              }))
            }
          />
          <p className="text-sm text-muted-foreground">
            Customer sessions expire after this period without activity.
          </p>
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save order settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
