"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  duplicatePlanAction,
  disablePlan,
  enablePlan,
  archivePlan,
} from "@/features/subscriptions/platform-actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { PlanStatus } from "@prisma/client";

export function PlanActions({ planId, status }: { planId: string; status: PlanStatus }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setLoading(true);
    try {
      await action();
      toast.success(message);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={() => run(() => duplicatePlanAction(planId), "Plan duplicated")}
      >
        Duplicate
      </Button>
      {status === "ACTIVE" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => run(() => disablePlan(planId), "Plan disabled")}
        >
          Disable
        </Button>
      ) : status === "DISABLED" ? (
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => run(() => enablePlan(planId), "Plan enabled")}
        >
          Enable
        </Button>
      ) : null}
      {status !== "ARCHIVED" && (
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => run(() => archivePlan(planId), "Plan archived")}
        >
          Archive
        </Button>
      )}
    </>
  );
}
