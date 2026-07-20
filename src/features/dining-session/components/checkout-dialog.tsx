"use client";

import { useMemo, useState, useTransition } from "react";
import { createAdminSessionClient } from "@/lib/session-client";
import type { LoyaltySettings } from "@/lib/loyalty-settings";
import { loyaltyPointsToPaise } from "@/lib/loyalty-settings";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type OrderLineItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  variantNameSnapshot?: string | null;
  modifiers?: unknown;
};

type OrderSummary = {
  items: OrderLineItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
};

function checkoutLineLabel(item: OrderLineItem): string {
  const variant = item.variantNameSnapshot?.trim();
  return variant ? `${item.name} (${variant})` : item.name;
}

function groupCheckoutLineItems(items: OrderLineItem[]): OrderLineItem[] {
  const grouped = new Map<string, OrderLineItem>();
  for (const item of items) {
    const key = `${item.name}\0${item.variantNameSnapshot ?? ""}\0${item.unitPrice}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.totalPrice += item.totalPrice;
    } else {
      grouped.set(key, { ...item });
    }
  }
  return Array.from(grouped.values());
}

function computeCheckoutTotals(
  order: OrderSummary,
  discountType: "PERCENT" | "FLAT" | "NONE",
  discountValue: number,
  loyaltyPoints: number,
  pointValueInRupees: number
) {
  let manualDiscountPaise = 0;
  if (discountType === "FLAT") {
    manualDiscountPaise = Math.max(0, discountValue);
  } else if (discountType === "PERCENT") {
    manualDiscountPaise = Math.round((order.subtotal * discountValue) / 100);
  }

  const grossBeforeCheckout = order.total + order.discountAmount;
  const preLoyaltyTotal = Math.max(0, grossBeforeCheckout - manualDiscountPaise);
  let loyaltyDiscountPaise = loyaltyPointsToPaise(loyaltyPoints, pointValueInRupees);
  loyaltyDiscountPaise = Math.min(loyaltyDiscountPaise, preLoyaltyTotal);
  const finalTotal = Math.max(0, preLoyaltyTotal - loyaltyDiscountPaise);

  return { manualDiscountPaise, loyaltyDiscountPaise, preLoyaltyTotal, finalTotal };
}

export function CheckoutDialog({
  sessionId,
  open,
  onOpenChange,
  order,
  loyaltySettings,
  customerPoints,
  onSuccess,
}: {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderSummary;
  loyaltySettings: LoyaltySettings;
  customerPoints: number;
  onSuccess: () => void;
}) {
  const sessionApi = useMemo(() => createAdminSessionClient(sessionId), [sessionId]);
  const [pending, startTransition] = useTransition();
  const [discountType, setDiscountType] = useState<"PERCENT" | "FLAT" | "NONE">("NONE");
  const [discountInput, setDiscountInput] = useState("");
  const [loyaltyPointsInput, setLoyaltyPointsInput] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "UPI" | "OTHER">("CASH");

  const showLoyalty = loyaltySettings.enabled && customerPoints > 0;

  const discountValue =
    discountType === "NONE"
      ? 0
      : discountType === "FLAT"
        ? Math.round(parseFloat(discountInput || "0") * 100)
        : Math.min(100, Math.max(0, parseFloat(discountInput || "0")));

  const loyaltyPoints = showLoyalty
    ? Math.min(customerPoints, Math.max(0, parseInt(loyaltyPointsInput || "0", 10) || 0))
    : 0;

  const totals = computeCheckoutTotals(
    order,
    discountType,
    discountValue,
    loyaltyPoints,
    loyaltySettings.pointValueInRupees
  );

  const groupedItems = useMemo(() => groupCheckoutLineItems(order.items), [order.items]);

  function resetForm() {
    setDiscountType("NONE");
    setDiscountInput("");
    setLoyaltyPointsInput("0");
    setPaymentMethod("CASH");
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  function submitCheckout() {
    startTransition(async () => {
      const result = await sessionApi.checkout({
        discountType,
        discountValue,
        loyaltyPointsRedeemed: loyaltyPoints > 0 ? loyaltyPoints : undefined,
        paymentMethod,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Checkout complete");
      resetForm();
      onOpenChange(false);
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg border-tertiary-fixed">
        <DialogHeader>
          <DialogTitle className="font-display">Checkout</DialogTitle>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          {/* Bill summary */}
          <section className="space-y-2 text-sm">
            <p className="text-label-sm font-medium uppercase tracking-wide text-secondary">
              Bill Summary
            </p>
            {groupedItems.length > 0 && (
              <div className="space-y-2 rounded-md border border-tertiary-fixed p-3">
                {groupedItems.map((item) => (
                  <div
                    key={`${item.id}-${item.variantNameSnapshot ?? ""}-${item.unitPrice}`}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{checkoutLineLabel(item)}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium">{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatCurrency(order.taxAmount)}</span>
            </div>
            {order.discountAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Existing discount</span>
                <span>-{formatCurrency(order.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Total due</span>
              <span>{formatCurrency(order.total + order.discountAmount)}</span>
            </div>
          </section>

          <Separator />

          {/* Discount */}
          <section className="space-y-3">
            <p className="text-label-sm font-medium uppercase tracking-wide text-secondary">
              Discount
            </p>
            <div className="flex flex-wrap gap-2">
              {(["NONE", "PERCENT", "FLAT"] as const).map((type) => (
                <Button
                  key={type}
                  type="button"
                  size="sm"
                  variant={discountType === type ? "default" : "outline"}
                  onClick={() => {
                    setDiscountType(type);
                    setDiscountInput("");
                  }}
                >
                  {type === "NONE" ? "None" : type === "PERCENT" ? "Percentage" : "Flat (₹)"}
                </Button>
              ))}
            </div>
            {discountType !== "NONE" && (
              <div>
                <Label>
                  {discountType === "PERCENT" ? "Discount %" : "Discount amount (₹)"}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={discountType === "PERCENT" ? 100 : undefined}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  placeholder={discountType === "PERCENT" ? "10" : "50"}
                />
              </div>
            )}
            {totals.manualDiscountPaise > 0 && (
              <p className="text-sm text-muted-foreground">
                Discount: -{formatCurrency(totals.manualDiscountPaise)}
              </p>
            )}
          </section>

          {/* Loyalty */}
          {showLoyalty && (
            <>
              <Separator />
              <section className="space-y-3">
                <p className="text-label-sm font-medium uppercase tracking-wide text-secondary">
                  Loyalty Points
                </p>
                <p className="text-sm text-muted-foreground">
                  Balance: {customerPoints} pts · 1 pt = ₹{loyaltySettings.pointValueInRupees}
                </p>
                <div>
                  <Label>Points to redeem</Label>
                  <Input
                    type="number"
                    min={0}
                    max={customerPoints}
                    value={loyaltyPointsInput}
                    onChange={(e) => setLoyaltyPointsInput(e.target.value)}
                  />
                </div>
                {totals.loyaltyDiscountPaise > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Loyalty discount: -{formatCurrency(totals.loyaltyDiscountPaise)}
                  </p>
                )}
              </section>
            </>
          )}

          <Separator />

          {/* Payment */}
          <section className="space-y-3">
            <p className="text-label-sm font-medium uppercase tracking-wide text-secondary">
              Payment
            </p>
            <div>
              <Label>Payment method</Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as typeof paymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Cash</SelectItem>
                  <SelectItem value="CARD">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>

          <Separator />

          {/* Final bill */}
          <section className="rounded-md bg-muted/50 p-4 space-y-2 text-sm">
            <p className="text-label-sm font-medium uppercase tracking-wide text-secondary">
              Final Bill
            </p>
            <div className="flex justify-between">
              <span>Subtotal + tax</span>
              <span>{formatCurrency(order.total + order.discountAmount)}</span>
            </div>
            {totals.manualDiscountPaise > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>-{formatCurrency(totals.manualDiscountPaise)}</span>
              </div>
            )}
            {totals.loyaltyDiscountPaise > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Loyalty ({loyaltyPoints} pts)</span>
                <span>-{formatCurrency(totals.loyaltyDiscountPaise)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Total to collect</span>
              <span>{formatCurrency(totals.finalTotal)}</span>
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submitCheckout} disabled={pending}>
            {pending ? "Processing…" : "Collect & Close Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
