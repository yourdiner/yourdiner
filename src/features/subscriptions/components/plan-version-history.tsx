"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resyncRazorpayPlansAction } from "@/features/subscriptions/platform-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

type VersionRow = {
  id: string;
  versionNumber: number;
  razorpayPlanIdMonthly: string | null;
  razorpayPlanIdYearly: string | null;
  razorpaySyncStatus: string;
  razorpaySyncError?: string | null;
  pricing: Array<{ priceMonthly: number; priceYearly: number }>;
};

export function PlanVersionHistory({ versions }: { versions: VersionRow[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleResync = async (versionId: string) => {
    setLoading(versionId);
    try {
      await resyncRazorpayPlansAction(versionId);
      toast.success("Razorpay plans synced");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Version History</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 pr-4">Version</th>
              <th className="pb-2 pr-4">Monthly</th>
              <th className="pb-2 pr-4">Yearly</th>
              <th className="pb-2 pr-4">Razorpay Monthly</th>
              <th className="pb-2 pr-4">Razorpay Yearly</th>
              <th className="pb-2 pr-4">Sync</th>
              <th className="pb-2"></th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => {
              const pricing = v.pricing[0];
              return (
                <tr key={v.id} className="border-b">
                  <td className="py-2 pr-4 font-medium">v{v.versionNumber}</td>
                  <td className="py-2 pr-4">
                    {pricing ? formatCurrency(pricing.priceMonthly) : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {pricing ? formatCurrency(pricing.priceYearly) : "—"}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {v.razorpayPlanIdMonthly ?? "—"}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs">
                    {v.razorpayPlanIdYearly ?? "—"}
                  </td>
                  <td className="py-2 pr-4">
                    <Badge
                      variant={
                        v.razorpaySyncStatus === "SYNCED"
                          ? "default"
                          : v.razorpaySyncStatus === "FAILED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {v.razorpaySyncStatus}
                    </Badge>
                    {v.razorpaySyncStatus === "PENDING" &&
                      v.razorpayPlanIdMonthly &&
                      !v.razorpayPlanIdYearly && (
                        <p className="mt-1 text-xs text-amber-700">Yearly pending</p>
                      )}
                    {v.razorpaySyncError && (
                      <p className="mt-1 max-w-xs text-xs text-destructive">{v.razorpaySyncError}</p>
                    )}
                  </td>
                  <td className="py-2">
                    {v.razorpaySyncStatus !== "SYNCED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading === v.id}
                        onClick={() => handleResync(v.id)}
                      >
                        {loading === v.id
                          ? "Syncing..."
                          : v.razorpayPlanIdMonthly && !v.razorpayPlanIdYearly
                            ? "Sync Yearly"
                            : "Retry Sync"}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
