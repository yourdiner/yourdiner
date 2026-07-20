"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePollInterval } from "@/hooks/use-poll-interval";
import {
  approveCustomerSession,
  fetchPendingCustomerSessions,
  rejectCustomerSession,
  type PendingCustomerSession,
} from "@/lib/customer-session-admin-client";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

const POLL_MS = 8000;

export function PendingCustomerSessionsPanel({
  initialSessions = [],
}: {
  initialSessions?: PendingCustomerSession[];
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [pending, startTransition] = useTransition();
  const [actingId, setActingId] = useState<string | null>(null);

  usePollInterval(() => {
    void fetchPendingCustomerSessions().then((result) => {
      if (result.ok) setSessions(result.data);
    });
  }, POLL_MS);

  async function handleAction(
    sessionId: string,
    action: "approve" | "reject"
  ) {
    setActingId(sessionId);
    try {
      const result =
        action === "approve"
          ? await approveCustomerSession(sessionId)
          : await rejectCustomerSession(sessionId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(action === "approve" ? "Session approved" : "Session rejected");
      startTransition(() => {
        router.refresh();
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } finally {
      setActingId(null);
    }
  }

  if (sessions.length === 0) return null;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="font-display text-headline-sm font-semibold">Pending customer sessions</h4>
        <Badge variant="secondary">{sessions.length} waiting</Badge>
      </div>
      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex flex-col gap-3 border border-amber-200 bg-amber-50/50 p-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-medium">
                {session.table.name || `Table ${session.table.number}`}
              </p>
              <p className="text-sm text-muted-foreground">
                {session.customer?.name ?? "Guest"} · {session.customer?.phone ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Scanned {formatDateTime(session.createdAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleAction(session.id, "approve")}
                disabled={pending || actingId === session.id}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(session.id, "reject")}
                disabled={pending || actingId === session.id}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
