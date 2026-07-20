"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ReservationConflictPayload } from "@/features/reservations/reservation-conflict.service";

export type ConflictDialogStep = "block" | "warn" | "final" | null;

type Props = {
  step: ConflictDialogStep;
  conflict: ReservationConflictPayload | null;
  pending?: boolean;
  onClose: () => void;
  onContinueAnyway: () => void;
  onGoBack: () => void;
  onStartSession: () => void;
};

export function ReservationConflictDialogs({
  step,
  conflict,
  pending,
  onClose,
  onContinueAnyway,
  onGoBack,
  onStartSession,
}: Props) {
  if (!conflict || !step) return null;

  if (step === "block") {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reservation Conflict</DialogTitle>
            <DialogDescription className="text-left text-on-surface">
              {conflict.message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === "warn") {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reservation Conflict Warning</DialogTitle>
            <DialogDescription className="sr-only">
              Reservation conflict warning with timing details
            </DialogDescription>
            <div className="space-y-4 text-left text-sm text-on-surface">
                <p>
                  This table has a reservation at {conflict.reservedAtLabel}.
                </p>
                <p>
                  The expected dining session is likely to overlap with this reservation.
                </p>
                <p>Are you sure you want to continue?</p>
                <dl className="space-y-1 border border-tertiary-fixed bg-surface-container-low p-3 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-on-surface-variant">Current Time</dt>
                    <dd className="font-medium">{conflict.currentTimeLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-on-surface-variant">Expected Finish</dt>
                    <dd className="font-medium">{conflict.expectedFinishLabel}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-on-surface-variant">Reservation Time</dt>
                    <dd className="font-medium">{conflict.reservedAtLabel}</dd>
                  </div>
                </dl>
              </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={onContinueAnyway} disabled={pending}>
              Continue Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onGoBack()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Final Confirmation</DialogTitle>
          <DialogDescription className="space-y-3 text-left text-on-surface">
            <span className="block">
              You are about to seat a customer on a table that already has an upcoming
              reservation.
            </span>
            <span className="block">
              This may delay or prevent the reserved customer from being seated on time.
            </span>
            <span className="block">Do you want to continue?</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onGoBack} disabled={pending}>
            Go Back
          </Button>
          <Button type="button" onClick={onStartSession} disabled={pending}>
            {pending ? "Starting…" : "Start Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function conflictStepFromPayload(
  conflict: ReservationConflictPayload
): ConflictDialogStep {
  if (conflict.canOverride && conflict.policy === "WARN") return "warn";
  return "block";
}
