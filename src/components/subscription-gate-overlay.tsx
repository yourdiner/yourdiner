"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreditCard, FileText, History } from "lucide-react";

export function SubscriptionGateOverlay() {
  const pathname = usePathname();
  const isBillingPage =
    pathname === "/dashboard/subscription" ||
    pathname.startsWith("/dashboard/subscription/");

  if (isBillingPage) return null;

  return (
    <div className="fixed inset-0 z-50 ml-64 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-lg space-y-6 p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <CreditCard className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Your subscription has expired</h2>
          <p className="text-muted-foreground">
            Renew your plan to continue using the system. Purchase a plan on the subscription page
            to restore full access.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/admin/subscription">
            <Button size="lg" className="w-full sm:w-auto">
              <CreditCard className="mr-2 h-4 w-4" />
              Renew Subscription
            </Button>
          </Link>
          <Link href="/admin/subscription#history">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <History className="mr-2 h-4 w-4" />
              View Payment History
            </Button>
          </Link>
          <Link href="/admin/subscription#invoices">
            <Button size="lg" variant="outline" className="w-full sm:w-auto">
              <FileText className="mr-2 h-4 w-4" />
              Download Invoice
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
