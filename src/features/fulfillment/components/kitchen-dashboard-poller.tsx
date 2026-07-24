"use client";

import { useCallback, useRef, useState } from "react";
import { usePollInterval } from "@/hooks/use-poll-interval";
import { fetchKitchenQueue } from "@/lib/kitchen-client";
import { KitchenDashboard } from "@/features/fulfillment/components/kitchen-dashboard";
import type { SerializedKitchenItem } from "@/features/fulfillment/kitchen-item.service";

const POLL_MS = 10_000;

function mergeItems(
  prev: SerializedKitchenItem[],
  incoming: SerializedKitchenItem[],
  clearedIds: string[]
): SerializedKitchenItem[] {
  const map = new Map(prev.map((item) => [item.id, item]));
  for (const id of clearedIds) {
    map.delete(id);
  }
  for (const item of incoming) {
    if (
      item.kitchenStatus === "SENT" ||
      item.kitchenStatus === "PREPARING" ||
      item.kitchenStatus === "READY"
    ) {
      map.set(item.id, item);
    } else {
      map.delete(item.id);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.kitchenSentAt).getTime() - new Date(b.kitchenSentAt).getTime()
  );
}

export function KitchenDashboardPoller({
  initialItems,
  initialServerTime,
}: {
  initialItems: SerializedKitchenItem[];
  initialServerTime?: string;
}) {
  const [items, setItems] = useState(initialItems);
  const sinceRef = useRef<string | null>(
    initialServerTime ??
      initialItems.reduce<string | null>((max, item) => {
        if (!max || item.kitchenStatusUpdatedAt > max) return item.kitchenStatusUpdatedAt;
        return max;
      }, null)
  );

  const applyLocalUpdate = useCallback(
    (update: SerializedKitchenItem | { id: string; removed: true }) => {
      setItems((prev) => {
        if ("removed" in update) {
          return prev.filter((i) => i.id !== update.id);
        }
        return mergeItems(prev, [update], []);
      });
      if (!("removed" in update)) {
        const ts = update.kitchenStatusUpdatedAt;
        if (!sinceRef.current || ts > sinceRef.current) {
          sinceRef.current = ts;
        }
      }
    },
    []
  );

  usePollInterval(() => {
    void fetchKitchenQueue(sinceRef.current ?? undefined).then((next) => {
      if (!next.ok) return;
      setItems((prev) => {
        // Full snapshot when no since was sent (or server returned full list without cleared-only)
        if (!sinceRef.current) {
          return next.items.slice().sort(
            (a, b) =>
              new Date(a.kitchenSentAt).getTime() - new Date(b.kitchenSentAt).getTime()
          );
        }
        return mergeItems(prev, next.items, next.clearedIds);
      });
      if (next.serverTime) {
        sinceRef.current = next.serverTime;
      }
    });
  }, POLL_MS);

  return <KitchenDashboard items={items} onItemUpdated={applyLocalUpdate} />;
}
