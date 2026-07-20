"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { SubscriptionBanner as BannerType } from "@/lib/subscription";

export function SubscriptionBanner({ banner }: { banner: BannerType }) {
  return (
    <div
      className={
        banner.variant === "destructive"
          ? "bg-destructive/10 border-b border-destructive/20 px-6 py-3 flex items-center justify-between gap-4"
          : "bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 flex items-center justify-between gap-4"
      }
    >
      <p
        className={
          banner.variant === "destructive" ? "text-sm text-destructive" : "text-sm text-amber-800"
        }
      >
        {banner.message}
      </p>
      <Link href="/admin/subscription">
        <Button size="sm" variant={banner.variant === "destructive" ? "destructive" : "default"}>
          Renew Now
        </Button>
      </Link>
    </div>
  );
}
