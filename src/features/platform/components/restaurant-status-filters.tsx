"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "DELETED", label: "Deleted" },
] as const;

export function RestaurantStatusFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("status") ?? "";

  function setFilter(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (status) params.set("status", status);
    else params.delete("status");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {FILTERS.map((filter) => (
        <button
          key={filter.label}
          type="button"
          onClick={() => setFilter(filter.value)}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors",
            current === filter.value
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background hover:bg-muted"
          )}
        >
          {filter.label}
        </button>
      ))}
      <Link
        href="/platform/billing/archive"
        className="ml-auto text-sm text-primary underline self-center"
      >
        Archived billing
      </Link>
    </div>
  );
}
