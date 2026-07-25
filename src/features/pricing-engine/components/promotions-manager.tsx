"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  deletePromotion,
  duplicatePromotionAction,
  togglePromotion,
} from "@/features/pricing-engine/actions";

type PromoRow = {
  id: string;
  name: string;
  type: string;
  priority: number;
  stackable: boolean;
  isActive: boolean;
  status: string;
  startTime: string | null;
  endTime: string | null;
  billLabel: string | null;
};

const TYPE_LABELS: Record<string, string> = {
  TIME_PRICE: "Happy Hour",
  DAY_PRICE: "Day Price",
  COMBO: "Combo",
  PERCENT: "% Off",
  FLAT: "Flat Off",
  BILL_FLAT: "Bill Flat",
  BILL_PERCENT: "Bill %",
};

export function PromotionsManager({ promotions }: { promotions: PromoRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        window.alert(result.error ?? "Action failed");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/admin/promotions/new">Create promotion</Link>
        </Button>
      </div>

      {promotions.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No promotions yet. Create happy hours, combos, or bill discounts.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Priority</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Window</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.billLabel && (
                      <div className="text-xs text-muted-foreground">Bill: {p.billLabel}</div>
                    )}
                    {p.stackable && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        Stackable
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">{TYPE_LABELS[p.type] ?? p.type}</td>
                  <td className="px-4 py-3">{p.priority}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant={
                        p.status === "Active"
                          ? "default"
                          : p.status === "Disabled"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.startTime && p.endTime ? `${p.startTime}–${p.endTime}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/promotions/${p.id}`}>Edit</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => run(() => togglePromotion(p.id, !p.isActive))}
                      >
                        {p.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => run(() => duplicatePromotionAction(p.id))}
                      >
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          if (!window.confirm("Disable this promotion?")) return;
                          run(() => deletePromotion(p.id, false));
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
