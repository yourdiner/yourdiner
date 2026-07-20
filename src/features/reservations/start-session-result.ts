import { AppError, getErrorMessage } from "@/lib/errors";
import {
  conflictPayloadFromError,
  type ReservationConflictPayload,
} from "@/features/reservations/reservation-conflict.service";

export type StartSessionClientResult =
  | { ok: true; session: { id: string } }
  | {
      ok: false;
      error: string;
      code?: string;
      conflict?: ReservationConflictPayload;
    };

export function startSessionFailureFromError(error: unknown): StartSessionClientResult {
  const conflict = conflictPayloadFromError(error);
  if (error instanceof AppError && conflict) {
    return {
      ok: false,
      error: error.message,
      code: error.code,
      conflict,
    };
  }
  return { ok: false, error: getErrorMessage(error) };
}
