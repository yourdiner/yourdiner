"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredLabel } from "@/components/ui/required-label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createReservationApi,
  suggestTableApi,
} from "@/lib/reservation-client";

type TableOption = {
  id: string;
  name: string;
  number: number;
  capacity: number;
};

export function ReservationForm({ tables }: { tables: TableOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [form, setForm] = useState({
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    guestCount: 2,
    date: new Date().toISOString().slice(0, 10),
    time: "19:00",
    tableId: "",
    specialRequest: "",
    source: "ADMIN" as const,
    status: "CONFIRMED" as const,
  });

  const reservedAtIso = () => new Date(`${form.date}T${form.time}:00`).toISOString();

  const refreshSuggestion = async () => {
    try {
      const result = await suggestTableApi({
        reservedAt: reservedAtIso(),
        guestCount: form.guestCount,
      });
      if (!result.ok) {
        setSuggestion(null);
        return;
      }
      const table = result.data;
      if (table) {
        setSuggestion(`Recommended: ${table.name || `Table ${table.number}`} (${table.capacity} seats)`);
        setForm((f) => ({ ...f, tableId: table.id }));
      } else {
        setSuggestion("No tables available for selected time.");
        setForm((f) => ({ ...f, tableId: "" }));
      }
    } catch {
      setSuggestion(null);
    }
  };

  const handleSubmit = () => {
    startTransition(async () => {
      try {
        const result = await createReservationApi({
          ...form,
          guestEmail: form.guestEmail || undefined,
          reservedAt: reservedAtIso(),
          tableId: form.tableId || undefined,
          specialRequest: form.specialRequest || undefined,
        });
        if (!result.ok) {
          throw new Error(result.error);
        }
        toast.success("Reservation created");
        router.push("/admin/reservations");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create reservation");
      }
    });
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <RequiredLabel>Customer name</RequiredLabel>
          <Input
            value={form.guestName}
            onChange={(e) => setForm({ ...form, guestName: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel>Mobile</RequiredLabel>
          <Input
            value={form.guestPhone}
            onChange={(e) => setForm({ ...form, guestPhone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Email (optional)</Label>
          <Input
            type="email"
            value={form.guestEmail}
            onChange={(e) => setForm({ ...form, guestEmail: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel>Guests</RequiredLabel>
          <Input
            type="number"
            min={1}
            value={form.guestCount}
            onChange={(e) =>
              setForm({ ...form, guestCount: Number(e.target.value) || 1 })
            }
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel>Date</RequiredLabel>
          <Input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <RequiredLabel>Time</RequiredLabel>
          <Input
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-2">
              <Label>Table</Label>
              <Select
                value={form.tableId}
                onValueChange={(v) => setForm({ ...form, tableId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name || `Table ${t.number}`} ({t.capacity} seats)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={refreshSuggestion}>
              Suggest
            </Button>
          </div>
          {suggestion && (
            <p
              className={`text-sm ${suggestion.includes("No tables") ? "text-destructive" : "text-muted-foreground"}`}
            >
              {suggestion}
            </p>
          )}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Special notes</Label>
          <Textarea
            value={form.specialRequest}
            onChange={(e) => setForm({ ...form, specialRequest: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Source</Label>
          <Select
            value={form.source}
            onValueChange={(v) =>
              setForm({ ...form, source: v as typeof form.source })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ADMIN">Admin</SelectItem>
              <SelectItem value="PHONE">Phone</SelectItem>
              <SelectItem value="WALK_IN">Walk-in</SelectItem>
              <SelectItem value="WEBSITE">Website</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button className="w-full" disabled={pending || !form.guestName || !form.guestPhone} onClick={handleSubmit}>
        {pending ? "Creating..." : "Create Reservation"}
      </Button>
    </div>
  );
}
