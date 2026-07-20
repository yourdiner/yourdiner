"use client";

import { useState } from "react";
import { usePollInterval } from "@/hooks/use-poll-interval";
import { fetchKitchenQueue } from "@/lib/kitchen-client";
import { KitchenDashboard } from "@/features/fulfillment/components/kitchen-dashboard";
import type { SerializedKitchenTicket } from "@/features/fulfillment/fulfillment-queries";

const POLL_MS = 10_000;

export function KitchenDashboardPoller({
  initialTickets,
}: {
  initialTickets: SerializedKitchenTicket[];
}) {
  const [tickets, setTickets] = useState(initialTickets);

  usePollInterval(() => {
    void fetchKitchenQueue().then((next) => {
      if (next.ok) setTickets(next.data);
    });
  }, POLL_MS);

  return <KitchenDashboard tickets={tickets} />;
}
