"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { syncSubscriptionInvoicesAction } from "@/features/subscriptions/platform-actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function SyncInvoicesButton({ subscriptionId }: { subscriptionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSync = async () => {
    setLoading(true);
    try {
      await syncSubscriptionInvoicesAction(subscriptionId);
      toast.success("Invoices synced from Razorpay");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleSync} disabled={loading}>
      {loading ? "Syncing..." : "Sync invoices"}
    </Button>
  );
}
