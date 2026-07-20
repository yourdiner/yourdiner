export interface LandingPlan {
  id: string;
  name: string;
  description: string | null;
  highlighted: boolean;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  features: string[];
  trialDays: number;
}

export const LANDING_PRIMARY = "#0B5ED7";
export const LANDING_ACCENT = "#FFC107";
