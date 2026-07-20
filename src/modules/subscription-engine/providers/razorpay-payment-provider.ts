import {
  createRazorpayCustomer,
  createRazorpayOrder,
  createRazorpayPlan,
  createRazorpaySubscription,
  cancelRazorpaySubscription,
  fetchRazorpayInvoices,
  fetchRazorpaySubscription,
  isRazorpayConfigured,
} from "@/lib/payments/razorpay";
import { callRazorpay } from "../services/razorpay-client.service";
import type { PaymentProvider } from "./payment-provider";

export class RazorpayPaymentProvider implements PaymentProvider {
  isConfigured(): boolean {
    return isRazorpayConfigured();
  }

  async createPlan(params: {
    amount: number;
    period: "monthly" | "yearly";
    name: string;
    currency?: string;
  }) {
    return callRazorpay({
      endpoint: "plans.create",
      requestBody: params,
      maxAttempts: 1,
      fn: () => createRazorpayPlan(params),
    });
  }

  async createCustomer(name: string, email: string, contact?: string) {
    return callRazorpay({
      endpoint: "customers.create",
      requestBody: { name, email, contact },
      fn: () => createRazorpayCustomer(name, email, contact),
    });
  }

  async createSubscription(params: {
    planId: string;
    customerId: string;
    totalCount?: number;
    notes?: Record<string, string>;
    addons?: Array<{
      name: string;
      amount: number;
      currency?: string;
    }>;
  }) {
    const result = await callRazorpay({
      endpoint: "subscriptions.create",
      requestBody: params,
      fn: () => createRazorpaySubscription(params),
    });
    return { id: result.id, shortUrl: result.short_url };
  }

  async cancelSubscription(subscriptionId: string) {
    await callRazorpay({
      endpoint: "subscriptions.cancel",
      requestBody: { subscriptionId },
      fn: () => cancelRazorpaySubscription(subscriptionId),
    });
  }

  async createOrder(params: {
    amount: number;
    currency?: string;
    receipt: string;
    notes?: Record<string, string>;
  }) {
    return callRazorpay({
      endpoint: "orders.create",
      requestBody: params,
      fn: () => createRazorpayOrder(params),
    });
  }

  async fetchSubscription(subscriptionId: string) {
    if (!isRazorpayConfigured()) return null;
    return callRazorpay({
      endpoint: "subscriptions.fetch",
      requestBody: { subscriptionId },
      fn: () => fetchRazorpaySubscription(subscriptionId),
    });
  }

  async fetchInvoices(params: { subscriptionId?: string; customerId?: string }) {
    if (!isRazorpayConfigured()) return [];
    return callRazorpay({
      endpoint: "invoices.all",
      requestBody: params,
      fn: () => fetchRazorpayInvoices(params),
    });
  }
}

let providerInstance: RazorpayPaymentProvider | null = null;

export function getPaymentProvider(): RazorpayPaymentProvider {
  if (!providerInstance) {
    providerInstance = new RazorpayPaymentProvider();
  }
  return providerInstance;
}
