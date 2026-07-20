"use client";

import { useState } from "react";
import { usePollInterval } from "@/hooks/use-poll-interval";
import { fetchActiveFloorSessions } from "@/lib/floor-client";
import { LiveFloorDashboard } from "@/features/waiters/components/live-floor-dashboard";

const POLL_MS = 12_000;

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

export function LiveFloorDashboardPoller({
  initialSessions,
  embedded = false,
}: {
  initialSessions: Session[];
  embedded?: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions);

  usePollInterval(() => {
    void fetchActiveFloorSessions().then((next) => {
      if (next.ok) setSessions(next.data);
    });
  }, POLL_MS);

  return <LiveFloorDashboard sessions={sessions} embedded={embedded} />;
}
