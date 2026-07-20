"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lookupAdminCustomer } from "@/lib/session-client";
import { createTakeawayOrderClient } from "@/lib/fulfillment-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredLabel } from "@/components/ui/required-label";

export function TakeawayOrderWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [notes, setNotes] = useState("");
  const [customerInfo, setCustomerInfo] = useState<{
    visitCount: number;
    isVip: boolean;
  } | null>(null);

  async function handlePhoneChange(value: string) {
    setPhone(value);
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 10) {
      const customer = await lookupAdminCustomer(value);
      if (customer) {
        setName(customer.name);
        setCustomerInfo({ visitCount: customer.visitCount, isVip: customer.isVip });
      } else {
        setCustomerInfo(null);
      }
    } else {
      setCustomerInfo(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const result = await createTakeawayOrderClient({
          phone,
          name,
          pickupTime: pickupTime ? new Date(pickupTime).toISOString() : null,
          notes: notes || undefined,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/admin/orders/takeaway/${result.orderId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create order");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-md space-y-6">
      <div>
        <Link href="/admin/orders/new" className="text-sm text-primary underline">
          ← Back to order types
        </Link>
        <h2 className="font-display mt-4 text-2xl font-bold">New Takeaway Order</h2>
        <p className="text-sm text-on-surface-variant">Enter customer details to begin.</p>
      </div>

      <div className="space-y-2">
        <RequiredLabel htmlFor="ta-phone">Mobile number</RequiredLabel>
        <Input
          id="ta-phone"
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder="10-digit mobile"
          required
        />
      </div>

      <div className="space-y-2">
        <RequiredLabel htmlFor="ta-name">Customer name</RequiredLabel>
        <Input
          id="ta-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </div>

      {customerInfo && (
        <p className="text-sm text-on-surface-variant">
          Returning guest · {customerInfo.visitCount} visits
          {customerInfo.isVip && " · VIP"}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="ta-pickup">Pickup time (optional)</Label>
        <Input
          id="ta-pickup"
          type="datetime-local"
          value={pickupTime}
          onChange={(e) => setPickupTime(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ta-notes">Notes (optional)</Label>
        <Input
          id="ta-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Special instructions"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating..." : "Continue to Menu"}
      </Button>
    </form>
  );
}
