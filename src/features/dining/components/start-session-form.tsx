"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lookupStaffCustomer, startStaffSession } from "@/lib/staff-session-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MaterialIcon } from "@/components/layout/material-icon";
import { cn } from "@/lib/utils";
import {
  ReservationConflictDialogs,
  conflictStepFromPayload,
  type ConflictDialogStep,
} from "@/features/reservations/components/reservation-conflict-dialogs";
import type { ReservationConflictPayload } from "@/features/reservations/reservation-conflict.service";

type Props = {
  tableId: string;
  tableLabel: string;
  capacity: number;
};

export function StartSessionForm({ tableId, tableLabel, capacity }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [guestCount, setGuestCount] = useState(Math.min(2, capacity));
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<ReservationConflictPayload | null>(null);
  const [conflictStep, setConflictStep] = useState<ConflictDialogStep>(null);
  const [customerInfo, setCustomerInfo] = useState<{
    visitCount: number;
    isVip: boolean;
    loyaltyPoints: number;
  } | null>(null);

  async function lookupPhone(value: string) {
    setPhone(value);
    setError("");
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 10) {
      try {
        const customer = await lookupStaffCustomer(value);
        if (customer) {
          setCustomerName(customer.name);
          setCustomerInfo({
            visitCount: customer.visitCount,
            isVip: customer.isVip,
            loyaltyPoints: customer.loyaltyPoints,
          });
        } else {
          setCustomerInfo(null);
        }
      } catch {
        setCustomerInfo(null);
      }
    } else {
      setCustomerInfo(null);
    }
  }

  function clearConflict() {
    setConflict(null);
    setConflictStep(null);
  }

  function runStart(overrideAcknowledged: boolean) {
    setError("");

    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
    if (normalizedPhone.length < 10) {
      setError("Customer phone is required (10 digits)");
      return;
    }

    startTransition(async () => {
      const result = await startStaffSession({
        tableId,
        guestCount,
        customerPhone: normalizedPhone,
        customerName: customerName.trim() || undefined,
        notes: notes.trim() || undefined,
        reservationOverrideAcknowledged: overrideAcknowledged || undefined,
      });

      if (!result.ok) {
        if (result.conflict) {
          setConflict(result.conflict);
          setConflictStep(
            overrideAcknowledged ? "block" : conflictStepFromPayload(result.conflict)
          );
          return;
        }
        setError(result.error);
        return;
      }

      clearConflict();
      router.push(`/staff/order/${result.session.id}`);
      router.refresh();
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    runStart(false);
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-surface p-4">
      <ReservationConflictDialogs
        step={conflictStep}
        conflict={conflict}
        pending={pending}
        onClose={clearConflict}
        onContinueAnyway={() => setConflictStep("final")}
        onGoBack={() => setConflictStep("warn")}
        onStartSession={() => runStart(true)}
      />
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center bg-primary-fixed/30">
            <MaterialIcon name="restaurant" className="text-3xl text-primary" />
          </div>
          <h1 className="font-display text-headline-sm font-semibold text-on-background">
            Start Dining Session
          </h1>
          <p className="mt-1 text-on-surface-variant">
            {tableLabel} · up to {capacity} guests
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 border border-tertiary-fixed bg-surface-container-lowest p-6"
        >
          <div className="space-y-2">
            <Label htmlFor="phone">
              Mobile number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => lookupPhone(e.target.value)}
              placeholder="9876543210"
              required
              minLength={10}
              autoComplete="tel"
            />
          </div>

          {customerInfo && (
            <div className="border border-primary-fixed bg-primary-fixed/20 p-4 text-label-sm">
              <p>
                {customerInfo.isVip && "★ VIP · "}
                {customerInfo.visitCount} visits · {customerInfo.loyaltyPoints} loyalty pts
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="customerName">Customer name</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Walk-in guest"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guestCount">Number of guests</Label>
            <Input
              id="guestCount"
              type="number"
              min={1}
              max={capacity}
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>

          {error && (
            <p className={cn("text-sm text-destructive")} role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-3 pt-1 sm:flex-row">
            <Button type="button" variant="outline" className="sm:flex-1" asChild>
              <Link href="/staff/floor">
                <MaterialIcon name="arrow_back" className="mr-1 text-base" />
                Back to floor
              </Link>
            </Button>
            <Button type="submit" className="gap-2 sm:flex-1" disabled={pending}>
              <MaterialIcon name="restaurant" />
              {pending ? "Starting…" : "Start Session & Order"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
