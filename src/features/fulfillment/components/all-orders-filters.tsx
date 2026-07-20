"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const ORDER_TYPES = [
  { value: "", label: "All types" },
  { value: "DINE_IN", label: "Dine-In" },
  { value: "TAKEAWAY", label: "Takeaway" },
  { value: "DELIVERY", label: "Delivery" },
];

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY", label: "Ready" },
  { value: "READY_FOR_PICKUP", label: "Ready for pickup" },
  { value: "PICKED_UP", label: "Picked up" },
  { value: "OUT_FOR_DELIVERY", label: "Out for delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "SERVED", label: "Served" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const PAYMENT_STATUSES = [
  { value: "", label: "All payments" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "PARTIAL", label: "Partial" },
  { value: "REFUNDED", label: "Refunded" },
];

export function AllOrdersFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`/admin/orders?${params.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="mb-4 flex flex-wrap gap-3">
      <input
        type="search"
        placeholder="Search customer..."
        defaultValue={searchParams.get("q") ?? ""}
        className="min-w-[180px] border border-tertiary-fixed px-3 py-2 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            update("q", (e.target as HTMLInputElement).value);
          }
        }}
      />
      <select
        className="border border-tertiary-fixed px-3 py-2 text-sm"
        value={searchParams.get("type") ?? ""}
        onChange={(e) => update("type", e.target.value)}
      >
        {ORDER_TYPES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className="border border-tertiary-fixed px-3 py-2 text-sm"
        value={searchParams.get("status") ?? ""}
        onChange={(e) => update("status", e.target.value)}
      >
        {STATUSES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select
        className="border border-tertiary-fixed px-3 py-2 text-sm"
        value={searchParams.get("payment") ?? ""}
        onChange={(e) => update("payment", e.target.value)}
      >
        {PAYMENT_STATUSES.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
