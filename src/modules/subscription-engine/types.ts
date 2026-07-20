import type {
  BillingCycle,
  PaymentStatus,
  PlanStatus,
  SubscriptionStatus,
} from "@prisma/client";

export interface SubscriptionState {
  status: SubscriptionStatus;
  paymentStatus: PaymentStatus;
  isActive: boolean;
  isGracePeriod: boolean;
  isSuspended: boolean;
  isReadOnly: boolean;
  graceDaysLeft: number | null;
  gracePeriodEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  planSlug: string;
  planName: string;
  planVersionNumber: number | null;
  billingCycle: BillingCycle;
  pricePaid: number;
  banner: SubscriptionBanner | null;
}

export interface SubscriptionBanner {
  message: string;
  daysRemaining: number;
  expiredOn: Date;
  variant: "warning" | "destructive";
}

export interface EffectivePrice {
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  taxRate: number;
  discountPercent: number;
}

export interface ProrationResult {
  remainingCredit: number;
  newPlanPrice: number;
  chargeAmount: number;
  daysRemaining: number;
}

export interface CreatePlanVersionInput {
  planId: string;
  featureCodes: string[];
  trialDays?: number;
  graceDays?: number;
  billingPeriodDefault?: BillingCycle;
  notes?: string;
  createdById?: string;
  pricing?: {
    currency?: string;
    priceMonthly: number;
    priceYearly: number;
    taxRate?: number;
    taxInclusive?: boolean;
    discountPercent?: number;
    offerStartDate?: Date;
    offerEndDate?: Date;
    effectiveFrom?: Date;
    effectiveTo?: Date;
  };
}

export interface SubscribeInput {
  restaurantId: string;
  planId: string;
  billingCycle: BillingCycle;
  actorUserId?: string;
}

export interface RenewInput {
  subscriptionId: string;
  actorUserId?: string;
  paymentDate?: Date;
}

export type PlanWithLatest = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: PlanStatus;
  displayOrder: number;
  isVisible: boolean;
  latestVersion: {
    id: string;
    versionNumber: number;
    trialDays: number;
    graceDays: number;
    features: { code: string; name: string; enabled: boolean }[];
    pricing: EffectivePrice | null;
  } | null;
};
