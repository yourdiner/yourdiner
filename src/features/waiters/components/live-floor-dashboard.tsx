"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatCurrency } from "@/lib/utils";
import { resetTable } from "@/lib/table-client";
import { Bell, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type Session = {
  id: string;
  status: string;
  source?: string;
  guestCount: number;
  table: { id: string; number: number; name: string | null };
  staff: { id: string; displayName: string } | null;
  customer: { name: string; phone: string } | null;
  orders: { total: number; status: string }[];
  events?: { type: string; createdAt: Date | string }[];
};

export function LiveFloorDashboard({
  sessions,
  embedded = false,
}: {
  sessions: Session[];
  embedded?: boolean;
}) {
  const router = useRouter();
  const [resetTarget, setResetTarget] = useState<Session | null>(null);
  const [resetting, setResetting] = useState(false);

  async function confirmReset() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const result = await resetTable(resetTarget.table.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Table reset — session ended");
      setResetTarget(null);
      router.refresh();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className={embedded ? "space-y-4" : "space-y-6 p-6"}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold">Live Floor</h1>
          <p className="text-muted-foreground text-sm">
            {sessions.length} active table session(s)
          </p>
        </div>
      )}
      {embedded && (
        <p className="text-label-md text-on-surface-variant">
          {sessions.length} active table session(s)
        </p>
      )}

      {sessions.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No active sessions</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sessions.map((s) => {
            const orderCount = s.orders.length;
            const billTotal = s.orders[0]?.total ?? 0;
            const waiterCalled = (s.events?.length ?? 0) > 0;
            return (
              <div
                key={s.id}
                className={cn(
                  "rounded-xl border p-4 space-y-3",
                  s.status === "BILL_REQUESTED" && "border-amber-500/50 bg-amber-500/5",
                  waiterCalled && s.status !== "BILL_REQUESTED" && "border-blue-500/50 bg-blue-500/5"
                )}
              >
                <div className="flex justify-between items-start gap-2">
                  <Link
                    href={`/admin/orders/${s.id}`}
                    className="min-w-0 flex-1 space-y-1 transition-colors hover:text-primary"
                  >
                    <p className="font-bold text-lg">
                      {s.table.name || `Table ${s.table.number}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {s.guestCount} guests · {s.staff?.displayName ?? "Unassigned"}
                    </p>
                    {s.customer && (
                      <p className="text-sm">
                        {s.customer.name} · {s.customer.phone}
                      </p>
                    )}
                  </Link>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant="outline">{s.status.replace(/_/g, " ")}</Badge>
                    {s.source === "CUSTOMER_QR" && (
                      <Badge variant="secondary" className="text-xs">
                        QR customer
                      </Badge>
                    )}
                    {waiterCalled && (
                      <Badge variant="secondary" className="gap-1 text-blue-700">
                        <Bell className="h-3 w-3" />
                        Waiter called
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="text-sm">
                    <p className="font-semibold">{formatCurrency(billTotal)}</p>
                    <p className="text-muted-foreground">
                      {orderCount > 0 ? "1 open order" : "No order yet"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => setResetTarget(s)}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reset table
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset table?</DialogTitle>
            <DialogDescription>
              This will end the current dining session, revoke customer QR access, and release the
              table for a new session. Pending customer orders will be cancelled.
            </DialogDescription>
          </DialogHeader>
          {resetTarget && (
            <p className="text-sm">
              Table:{" "}
              <span className="font-medium">
                {resetTarget.table.name || `Table ${resetTarget.table.number}`}
              </span>
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReset} disabled={resetting}>
              {resetting ? "Resetting..." : "Reset table"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
