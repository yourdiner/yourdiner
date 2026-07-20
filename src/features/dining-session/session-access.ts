import type { StaffRole } from "@prisma/client";
import type { OrderActor } from "./auth";

export type SessionViewer =
  | { kind: "admin" }
  | { kind: "staff"; staffId: string; role: StaffRole };

export function toSessionViewer(actor: OrderActor): SessionViewer {
  if (actor.type === "admin") return { kind: "admin" };
  if (actor.type === "staff") {
    return { kind: "staff", staffId: actor.staffId, role: actor.role };
  }
  return { kind: "admin" };
}

/** Admin dashboard users and managers/cashiers may access any table; waiters only their assignment. */
export function canAccessAssignedSession(
  viewer: SessionViewer,
  assignedStaffId: string | null
): boolean {
  if (viewer.kind === "admin") return true;
  if (["OWNER", "MANAGER", "CASHIER"].includes(viewer.role)) return true;
  if (!assignedStaffId) return true;
  return assignedStaffId === viewer.staffId;
}

export function actorCanAccessAssignedSession(
  actor: OrderActor,
  assignedStaffId: string | null
): boolean {
  if (actor.type === "customer") return true;
  return canAccessAssignedSession(toSessionViewer(actor), assignedStaffId);
}
