export interface RazorpaySubscriptionEntity {
  id: string;
  status: string;
  plan_id?: string;
  current_start?: number;
  current_end?: number;
  charge_at?: number;
  short_url?: string;
}

export interface RazorpayInvoiceEntity {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoice_number?: string;
  short_url?: string;
  paid_at?: number;
  created_at?: number;
}

export interface PaymentProvider {
  isConfigured(): boolean;
  createPlan(params: {
    amount: number;
    period: "monthly" | "yearly";
    name: string;
    currency?: string;
  }): Promise<{ id: string }>;
  createCustomer(
    name: string,
    email: string,
    contact?: string
  ): Promise<{ id: string }>;
  createSubscription(params: {
    planId: string;
    customerId: string;
    totalCount?: number;
    notes?: Record<string, string>;
    addons?: Array<{
      name: string;
      amount: number;
      currency?: string;
    }>;
  }): Promise<{ id: string; shortUrl?: string }>;
  cancelSubscription(subscriptionId: string): Promise<void>;
  createOrder(params: {
    amount: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }): Promise<{ id: string; amount: number; currency: string }>;
  fetchSubscription(subscriptionId: string): Promise<RazorpaySubscriptionEntity | null>;
  fetchInvoices(params: {
    subscriptionId?: string;
    customerId?: string;
  }): Promise<RazorpayInvoiceEntity[]>;
}
