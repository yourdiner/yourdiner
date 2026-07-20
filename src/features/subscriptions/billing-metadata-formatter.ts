import { formatCurrency, formatDate } from "@/lib/utils";

export type PlanNameMap = Record<string, string>;

function planLabel(map: PlanNameMap, id?: string | null): string {
  if (!id || typeof id !== "string") return "—";
  return map[id] ?? `${id.slice(0, 8)}…`;
}

function formatGenericMetadata(meta: Record<string, unknown>, planNames: PlanNameMap): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(meta)) {
    if (value === null || value === undefined || value === "") continue;

    if (key === "fromPlanId" || key === "toPlanId" || key === "targetPlanId" || key === "planId") {
      continue;
    }

    const label = key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (c) => c.toUpperCase())
      .trim();

    if (typeof value === "number" && /amount|credit|price|paid/i.test(key)) {
      parts.push(`${label}: ${formatCurrency(value)}`);
    } else if (typeof value === "boolean") {
      parts.push(`${label}: ${value ? "Yes" : "No"}`);
    } else {
      parts.push(`${label}: ${String(value)}`);
    }
  }

  return parts.join(" · ") || "—";
}

export function formatSubscriptionEventDetails(
  type: string,
  metadata: unknown,
  planNames: PlanNameMap
): string {
  const meta =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  switch (type) {
    case "UPGRADED": {
      if (meta.pending === true) {
        const parts: string[] = [];
        if (meta.targetPlanId) {
          parts.push(`Upgrade to ${planLabel(planNames, meta.targetPlanId as string)} pending`);
        } else {
          parts.push("Upgrade pending");
        }
        if (meta.chargeAmount != null) {
          parts.push(`charge ${formatCurrency(meta.chargeAmount as number)}`);
        }
        if (meta.daysRemaining != null) {
          parts.push(`${meta.daysRemaining} days remaining on current period`);
        }
        if (meta.remainingCredit != null) {
          parts.push(`${formatCurrency(meta.remainingCredit as number)} credit applied`);
        }
        if (meta.razorpaySubscriptionId) {
          parts.push(`Razorpay sub ${meta.razorpaySubscriptionId}`);
        }
        return parts.join(" · ");
      }
      if (meta.fromPlanId || meta.toPlanId) {
        return `${planLabel(planNames, meta.fromPlanId as string)} → ${planLabel(planNames, meta.toPlanId as string)}`;
      }
      break;
    }
    case "DOWNGRADE_SCHEDULED":
    case "DOWNGRADE_APPLIED":
    case "PLAN_CHANGED": {
      if (meta.fromPlanId || meta.toPlanId) {
        return `${planLabel(planNames, meta.fromPlanId as string)} → ${planLabel(planNames, meta.toPlanId as string)}`;
      }
      break;
    }
    case "CREATED": {
      const parts: string[] = [];
      if (meta.planSlug) parts.push(`Plan: ${meta.planSlug}`);
      if (meta.billingCycle) parts.push(`Billing: ${meta.billingCycle}`);
      if (meta.activated) parts.push("Activated");
      return parts.join(" · ") || "Subscription created";
    }
    case "RENEWED":
      return meta.orderId ? `Order ${meta.orderId}` : "Subscription renewed";
    case "PAYMENT_SUCCEEDED":
      return meta.amount != null
        ? `Payment of ${formatCurrency(meta.amount as number)} succeeded`
        : "Payment succeeded";
    case "PAYMENT_FAILED":
      return "Payment failed";
    case "GRACE_STARTED":
      return meta.gracePeriodEndsAt
        ? `Grace period until ${formatDate(meta.gracePeriodEndsAt as string)}`
        : "Grace period started";
    case "GRACE_REMINDER":
    case "EXPIRY_REMINDER":
      return meta.days != null ? `${meta.days} days remaining` : formatGenericMetadata(meta, planNames);
    case "EXTENDED":
    case "FREE_DAYS_ADDED":
      return meta.days != null ? `Extended by ${meta.days} days` : formatGenericMetadata(meta, planNames);
    case "MANDATE_CREATED":
      return meta.razorpaySubscriptionId
        ? `Mandate created (${meta.razorpaySubscriptionId})`
        : "Mandate created";
    case "CANCELLED":
      return "Subscription cancelled";
    case "SUSPENDED":
      return "Subscription suspended";
    case "RESUMED":
      return "Subscription resumed";
    default:
      break;
  }

  if (meta.fromPlanId || meta.toPlanId) {
    return `${planLabel(planNames, meta.fromPlanId as string)} → ${planLabel(planNames, meta.toPlanId as string)}`;
  }

  return formatGenericMetadata(meta, planNames);
}

export function formatBillingAuditDetails(
  action: string,
  metadata: unknown,
  planNames: PlanNameMap
): string {
  return formatSubscriptionEventDetails(action, metadata, planNames);
}

export async function buildPlanNameMap(): Promise<PlanNameMap> {
  const { prisma } = await import("@/lib/db");
  const plans = await prisma.plan.findMany({ select: { id: true, name: true } });
  return Object.fromEntries(plans.map((p) => [p.id, p.name]));
}
