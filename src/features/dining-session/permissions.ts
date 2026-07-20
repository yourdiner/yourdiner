import { StaffRole } from "@prisma/client";

import type { OrderActor } from "./auth";



function staffRole(actor: OrderActor): StaffRole | null {

  if (actor.type === "staff" || actor.type === "admin") return actor.role;

  return null;

}



export function canManageSessions(actor: OrderActor): boolean {

  if (actor.type === "customer") return false;

  if (actor.type === "admin") return true;

  const role = staffRole(actor);

  return role !== null && ["OWNER", "MANAGER", "CASHIER", "STAFF"].includes(role);

}



export function canOverrideTable(actor: OrderActor): boolean {

  if (actor.type === "customer") return false;

  if (actor.type === "admin") return true;

  const role = staffRole(actor);

  return role === "OWNER" || role === "MANAGER";

}



export function canApplyDiscount(actor: OrderActor): boolean {

  if (actor.type === "customer") return false;

  if (actor.type === "admin") return true;

  const role = staffRole(actor);

  return role === "OWNER" || role === "MANAGER";

}



export function canVoidSentItems(actor: OrderActor): boolean {
  if (actor.type === "customer") return false;
  if (actor.type === "staff") return false;
  if (actor.type === "admin") {
    return actor.role === "OWNER" || actor.role === "MANAGER";
  }
  return false;
}



export function canCloseSession(actor: OrderActor): boolean {

  if (actor.type === "customer") return false;

  if (actor.type === "admin") return true;

  const role = staffRole(actor);

  return role !== null && ["OWNER", "MANAGER", "CASHIER"].includes(role);

}



export function canTransferTable(actor: OrderActor): boolean {

  return canOverrideTable(actor);

}



export function canMergeTables(actor: OrderActor): boolean {

  return canOverrideTable(actor);

}



export function adminRoleLevel(role: StaffRole): number {

  const hierarchy: Record<StaffRole, number> = {

    OWNER: 100,

    MANAGER: 80,

    CASHIER: 60,

    STAFF: 40,

    KITCHEN: 30,

    VIEWER: 10,

  };

  return hierarchy[role];

}

