"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRestaurantSettings } from "@/lib/settings-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { ReservationSettings } from "@/lib/reservation-settings";

export function SettingsReservations({
  reservationSettings,
}: {
  reservationSettings: ReservationSettings;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<ReservationSettings>(reservationSettings);

  const handleSave = async () => {
    setLoading(true);
    try {
      const result = await updateRestaurantSettings({ reservationSettings: form });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Reservation settings saved");
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
        <CardTitle>Reservations</CardTitle>
        <CardDescription>
          Configure how reservations block tables, hold times, and no-show handling.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <Label>Enable reservations</Label>
            <p className="text-sm text-muted-foreground">Allow creating and managing reservations</p>
          </div>
          <Switch
            checked={form.enabled}
            onCheckedChange={(enabled) => setForm({ ...form, enabled })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Average dining time (minutes)</Label>
            <Input
              type="number"
              min={15}
              max={300}
              value={form.averageDiningMinutes}
              onChange={(e) =>
                setForm({ ...form, averageDiningMinutes: Number(e.target.value) || 90 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Reservation hold time (minutes)</Label>
            <Input
              type="number"
              min={5}
              max={120}
              value={form.holdTimeMinutes}
              onChange={(e) =>
                setForm({ ...form, holdTimeMinutes: Number(e.target.value) || 30 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Cleaning buffer (minutes)</Label>
            <Input
              type="number"
              min={0}
              max={60}
              value={form.cleaningBufferMinutes}
              onChange={(e) =>
                setForm({ ...form, cleaningBufferMinutes: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Reservation interval</Label>
            <Select
              value={String(form.reservationIntervalMinutes)}
              onValueChange={(v) =>
                setForm({
                  ...form,
                  reservationIntervalMinutes: Number(v) as 15 | 30 | 60,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">60 minutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          {[
            {
              key: "autoMarkNoShow" as const,
              label: "Auto mark no show",
              desc: "Mark confirmed reservations as no show after hold time expires",
            },
            {
              key: "autoReleaseOnNoShow" as const,
              label: "Auto release table after no show",
              desc: "Immediately free the table when marked no show",
            },
            {
              key: "allowWalkInOverride" as const,
              label: "Allow walk-in override",
              desc: "Warn staff when assigning a walk-in over an upcoming reservation",
            },
          ].map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div>
                <Label>{item.label}</Label>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
              <Switch
                checked={form[item.key]}
                onCheckedChange={(checked) => setForm({ ...form, [item.key]: checked })}
              />
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg border p-4">
          <div>
            <Label>Reservation Conflict Policy</Label>
            <p className="text-sm text-muted-foreground">
              What happens when starting a dine-in session would overlap a future reservation
            </p>
          </div>
          <div className="space-y-3">
            <label className="flex cursor-pointer gap-3 rounded-md border p-3 has-[:checked]:border-primary">
              <input
                type="radio"
                name="reservationConflictPolicy"
                className="mt-1"
                checked={form.reservationConflictPolicy === "BLOCK"}
                onChange={() => setForm({ ...form, reservationConflictPolicy: "BLOCK" })}
              />
              <span>
                <span className="block font-medium">Block overlapping sessions (Recommended)</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Prevent staff from seating customers if the expected dining time overlaps with an
                  upcoming reservation.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-md border p-3 has-[:checked]:border-primary">
              <input
                type="radio"
                name="reservationConflictPolicy"
                className="mt-1"
                checked={form.reservationConflictPolicy === "WARN"}
                onChange={() => setForm({ ...form, reservationConflictPolicy: "WARN" })}
              />
              <span>
                <span className="block font-medium">Warn and allow override</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Display two confirmation dialogs before allowing an overlapping session. This
                  should only be used if your restaurant prefers manual decisions.
                </span>
              </span>
            </label>
          </div>
        </div>

        <Button onClick={handleSave} disabled={loading}>
          {loading ? "Saving..." : "Save reservation settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
