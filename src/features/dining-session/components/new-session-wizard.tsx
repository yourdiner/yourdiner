"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startAdminSession, lookupAdminCustomer } from "@/lib/session-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { MaterialIcon } from "@/components/layout/material-icon";
import {
  ReservationConflictDialogs,
  conflictStepFromPayload,
  type ConflictDialogStep,
} from "@/features/reservations/components/reservation-conflict-dialogs";
import type { ReservationConflictPayload } from "@/features/reservations/reservation-conflict.service";

type TableRow = {
  id: string;
  name: string;
  number: number;
  capacity: number;
  status: string;
  displayStatus?: string;
  canStartSession?: boolean;
  blockReason?: string | null;
  activeSessionId: string | null;
  blockingReservation?: {
    id: string;
    guestName: string;
    guestCount: number;
    holdExpiresAt: string | Date;
  } | null;
};

type Waiter = { id: string; displayName: string };

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  CLEANING: "Cleaning",
  DISABLED: "Disabled",
};

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "bg-primary-fixed text-on-primary-fixed",
  OCCUPIED: "bg-secondary-container text-on-secondary-container",
  RESERVED: "bg-tertiary-fixed text-tertiary",
  CLEANING: "bg-surface-container-high text-on-surface-variant",
};

export function NewSessionWizard({
  tables,
  waiters,
}: {
  tables: TableRow[];
  waiters: Waiter[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<ReservationConflictPayload | null>(null);
  const [conflictStep, setConflictStep] = useState<ConflictDialogStep>(null);

  const [tableId, setTableId] = useState("");
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [guestCount, setGuestCount] = useState(2);
  const [notes, setNotes] = useState("");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [customerInfo, setCustomerInfo] = useState<{
    visitCount: number;
    isVip: boolean;
    loyaltyPoints: number;
    membership?: { name: string; discountPercent: number | null };
  } | null>(null);

  const selectedTable = tables.find((t) => t.id === tableId);

  async function lookupPhone(value: string) {
    setPhone(value);
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 10) {
      const customer = await lookupAdminCustomer(value);
      if (customer) {
        setCustomerName(customer.name);
        setCustomerInfo({
          visitCount: customer.visitCount,
          isVip: customer.isVip,
          loyaltyPoints: customer.loyaltyPoints,
          membership: customer.membership ?? undefined,
        });
      } else {
        setCustomerInfo(null);
      }
    }
  }

  function canSelectTable(t: TableRow) {
    if (t.activeSessionId) return false;
    if (t.canStartSession === false) return false;
    const visual = t.displayStatus ?? t.status;
    // Dining-window RESERVED still allows start; conflict policy handles override.
    return visual === "AVAILABLE" || visual === "RESERVED";
  }

  function clearConflict() {
    setConflict(null);
    setConflictStep(null);
  }

  function runStart(overrideAcknowledged: boolean) {
    setError("");
    startTransition(async () => {
      const result = await startAdminSession({
        tableId,
        guestCount,
        customerPhone: phone || undefined,
        customerName: customerName || undefined,
        notes: notes || undefined,
        staffId,
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
      router.push(`/admin/orders/${result.session.id}/order`);
    });
  }

  function startSession() {
    runStart(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <ReservationConflictDialogs
        step={conflictStep}
        conflict={conflict}
        pending={pending}
        onClose={clearConflict}
        onContinueAnyway={() => setConflictStep("final")}
        onGoBack={() => setConflictStep("warn")}
        onStartSession={() => runStart(true)}
      />
      <div className="mb-8 flex items-center gap-4">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center text-label-sm font-bold",
                step >= s ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant"
              )}
            >
              {s}
            </div>
            {s < 4 && <div className="h-px w-8 bg-tertiary-fixed" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-headline-sm font-semibold">Select Table</h3>
            <p className="text-on-surface-variant">Choose an available table to start a dining session.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {tables.map((t) => {
              const selectable = canSelectTable(t);
              const label = t.name || `T${t.number}`;
              const visualStatus = t.displayStatus ?? t.status;
              if (t.activeSessionId) {
                return (
                  <Link
                    key={t.id}
                    href={`/admin/orders/${t.activeSessionId}`}
                    className="border border-secondary bg-secondary-fixed/20 p-4 text-center transition-colors hover:bg-secondary-fixed/40"
                  >
                    <p className="font-semibold">{label}</p>
                    <span className="mt-2 inline-block text-label-sm text-secondary">View session →</span>
                  </Link>
                );
              }
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!selectable}
                  onClick={() => {
                    setTableId(t.id);
                    setGuestCount(Math.min(2, t.capacity));
                  }}
                  className={cn(
                    "border p-4 text-left transition-all",
                    tableId === t.id
                      ? "border-primary bg-primary-fixed/30 ring-2 ring-primary"
                      : "border-tertiary-fixed hover:bg-surface-container-low",
                    !selectable && "cursor-not-allowed opacity-40"
                  )}
                >
                  <p className="font-semibold">{label}</p>
                  <p className="text-xs text-on-surface-variant">Seats {t.capacity}</p>
                  <span
                    className={cn(
                      "mt-2 inline-block px-2 py-0.5 text-label-sm",
                      STATUS_COLOR[visualStatus] ?? "bg-surface-container"
                    )}
                  >
                    {STATUS_LABEL[visualStatus] ?? visualStatus}
                  </span>
                  {t.blockingReservation && visualStatus === "RESERVED" && (
                    <p className="mt-2 text-xs text-on-surface-variant">
                      {t.blockingReservation.guestName} · hold until{" "}
                      {new Date(t.blockingReservation.holdExpiresAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                  {!selectable && visualStatus === "AVAILABLE" && t.blockReason && (
                    <p className="mt-2 text-xs text-on-surface-variant">{t.blockReason}</p>
                  )}
                </button>
              );
            })}
          </div>
          <Button disabled={!tableId} onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      )}

      {step === 2 && selectedTable && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-headline-sm font-semibold">Customer Details</h3>
            <p className="text-on-surface-variant">
              Table: {selectedTable.name || `T${selectedTable.number}`}
            </p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => lookupPhone(e.target.value)}
                placeholder="9876543210"
              />
            </div>
            {customerInfo && (
              <div className="border border-primary-fixed bg-primary-fixed/20 p-4 text-sm">
                <p>
                  {customerInfo.isVip && "★ VIP · "}
                  {customerInfo.visitCount} visits · {customerInfo.loyaltyPoints} loyalty pts
                </p>
                {customerInfo.membership && (
                  <p className="text-on-surface-variant">
                    Member: {customerInfo.membership.name}
                    {customerInfo.membership.discountPercent
                      ? ` (${customerInfo.membership.discountPercent}% off)`
                      : ""}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Walk-in guest"
              />
            </div>
            <div className="space-y-2">
              <Label>Number of Guests</Label>
              <Input
                type="number"
                min={1}
                max={selectedTable.capacity}
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-headline-sm font-semibold">Assign Waiter</h3>
            <p className="text-on-surface-variant">Optional — can reassign later from session detail.</p>
          </div>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setStaffId(null)}
              className={cn(
                "w-full border p-4 text-left",
                staffId === null ? "border-primary bg-primary-fixed/20" : "border-tertiary-fixed"
              )}
            >
              Unassigned
            </button>
            {waiters.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setStaffId(w.id)}
                className={cn(
                  "w-full border p-4 text-left",
                  staffId === w.id ? "border-primary bg-primary-fixed/20" : "border-tertiary-fixed"
                )}
              >
                {w.displayName}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={() => setStep(4)}>Continue</Button>
          </div>
        </div>
      )}

      {step === 4 && selectedTable && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display text-headline-sm font-semibold">Start Dining Session</h3>
            <p className="text-on-surface-variant">Review and confirm to open the ordering interface.</p>
          </div>
          <div className="space-y-2 border border-tertiary-fixed bg-white p-6 text-sm">
            <p>
              <span className="text-on-surface-variant">Table:</span>{" "}
              {selectedTable.name || `T${selectedTable.number}`}
            </p>
            <p>
              <span className="text-on-surface-variant">Customer:</span>{" "}
              {customerName || "Walk-in"} {phone && `· ${phone}`}
            </p>
            <p>
              <span className="text-on-surface-variant">Guests:</span> {guestCount}
            </p>
            <p>
              <span className="text-on-surface-variant">Waiter:</span>{" "}
              {staffId ? waiters.find((w) => w.id === staffId)?.displayName : "Unassigned"}
            </p>
            {notes && (
              <p>
                <span className="text-on-surface-variant">Notes:</span> {notes}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button disabled={pending} onClick={startSession} className="gap-2">
              <MaterialIcon name="restaurant" />
              {pending ? "Starting…" : "Start Session & Order"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
