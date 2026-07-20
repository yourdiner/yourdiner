import type { OrderActor } from "./auth";

export function actorStaffId(actor: OrderActor): string | undefined {
  return actor.type === "staff" ? actor.staffId : undefined;
}

export function actorUserId(actor: OrderActor): string | undefined {
  return actor.type === "admin" ? actor.userId : undefined;
}

export function actorDisplayName(actor: OrderActor): string {
  if (actor.type === "customer") return actor.displayName;
  return actor.displayName;
}
