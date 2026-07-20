"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lookupAdminCustomer } from "@/lib/session-client";
import { createDeliveryOrderClient } from "@/lib/fulfillment-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredLabel } from "@/components/ui/required-label";
import { Textarea } from "@/components/ui/textarea";

export function DeliveryOrderWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [landmark, setLandmark] = useState("");
  const [instructions, setInstructions] = useState("");
  const [deliveryCharges, setDeliveryCharges] = useState("0");
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState("");
  const [deliveryPartner, setDeliveryPartner] = useState("");
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
        const result = await createDeliveryOrderClient({
          phone,
          name,
          address,
          landmark: landmark || undefined,
          instructions: instructions || undefined,
          deliveryCharges: parseFloat(deliveryCharges) || 0,
          estimatedDeliveryAt: estimatedDeliveryAt
            ? new Date(estimatedDeliveryAt).toISOString()
            : null,
          deliveryPartner: deliveryPartner || undefined,
          notes: notes || undefined,
        });
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.push(`/admin/orders/delivery/${result.orderId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create order");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-6">
      <div>
        <Link href="/admin/orders/new" className="text-sm text-primary underline">
          ← Back to order types
        </Link>
        <h2 className="font-display mt-4 text-2xl font-bold">New Delivery Order</h2>
        <p className="text-sm text-on-surface-variant">Customer and delivery details.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <RequiredLabel htmlFor="dl-phone">Mobile number</RequiredLabel>
          <Input
            id="dl-phone"
            type="tel"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <RequiredLabel htmlFor="dl-name">Customer name</RequiredLabel>
          <Input id="dl-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        {customerInfo && (
          <p className="text-sm text-on-surface-variant sm:col-span-2">
            Returning guest · {customerInfo.visitCount} visits
          </p>
        )}
        <div className="space-y-2 sm:col-span-2">
          <RequiredLabel htmlFor="dl-address">Delivery address</RequiredLabel>
          <Textarea
            id="dl-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            rows={2}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dl-landmark">Landmark</Label>
          <Input id="dl-landmark" value={landmark} onChange={(e) => setLandmark(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dl-charges">Delivery charges (₹)</Label>
          <Input
            id="dl-charges"
            type="number"
            min={0}
            step="0.01"
            value={deliveryCharges}
            onChange={(e) => setDeliveryCharges(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="dl-instructions">Delivery instructions</Label>
          <Input
            id="dl-instructions"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dl-eta">Estimated delivery</Label>
          <Input
            id="dl-eta"
            type="datetime-local"
            value={estimatedDeliveryAt}
            onChange={(e) => setEstimatedDeliveryAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dl-partner">Delivery partner</Label>
          <Input
            id="dl-partner"
            value={deliveryPartner}
            onChange={(e) => setDeliveryPartner(e.target.value)}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="dl-notes">Order notes</Label>
          <Input id="dl-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating..." : "Continue to Menu"}
      </Button>
    </form>
  );
}
