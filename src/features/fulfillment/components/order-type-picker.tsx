"use client";

import Link from "next/link";
import { MaterialIcon } from "@/components/layout/material-icon";

const ORDER_TYPES = [
  {
    type: "dine-in",
    href: "/admin/orders/new/dine-in",
    icon: "restaurant",
    emoji: "🍽",
    title: "Dine-In",
    description: "Select a table, assign waiter, and manage an in-restaurant session.",
  },
  {
    type: "takeaway",
    href: "/admin/orders/new/takeaway",
    icon: "takeout_dining",
    emoji: "🥡",
    title: "Takeaway",
    description: "Customer picks up at the counter. No table required.",
    requiresFulfillment: true,
  },
  {
    type: "delivery",
    href: "/admin/orders/new/delivery",
    icon: "delivery_dining",
    emoji: "🛵",
    title: "Delivery",
    description: "Deliver to customer address with delivery details.",
    requiresFulfillment: true,
  },
] as const;

export function OrderTypePicker({ fulfillmentEnabled }: { fulfillmentEnabled: boolean }) {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <p className="text-label-md uppercase tracking-widest text-secondary">New Order</p>
        <h2 className="font-display text-2xl font-bold md:text-3xl">Select order type</h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          Choose how this order will be fulfilled.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {ORDER_TYPES.map((item) => {
          const disabled =
            "requiresFulfillment" in item && item.requiresFulfillment && !fulfillmentEnabled;
          const content = (
            <div
              className={`flex h-full flex-col border p-6 transition-all ${
                disabled
                  ? "cursor-not-allowed border-tertiary-fixed bg-surface-container-low opacity-60"
                  : "cursor-pointer border-tertiary-fixed bg-white hover:border-primary hover:shadow-md"
              }`}
            >
              <span className="text-3xl">{item.emoji}</span>
              <h3 className="font-display mt-4 text-xl font-semibold">{item.title}</h3>
              <p className="mt-2 flex-1 text-sm text-on-surface-variant">{item.description}</p>
              {disabled ? (
                <p className="mt-4 text-xs font-semibold text-secondary">
                  Requires Professional or Premium plan
                </p>
              ) : (
                <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-primary">
                  Continue
                  <MaterialIcon name="arrow_forward" className="text-base" />
                </span>
              )}
            </div>
          );

          if (disabled) return <div key={item.type}>{content}</div>;
          return (
            <Link key={item.type} href={item.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
