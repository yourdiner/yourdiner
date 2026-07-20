"use client";

import { useState } from "react";
import type { StaffRole } from "@prisma/client";
import { usePollInterval } from "@/hooks/use-poll-interval";
import { fetchStaffFloorTables } from "@/lib/floor-client";
import { FloorGrid } from "@/features/floor/components/floor-grid";
import type { TableAvailabilityStatus } from "@/features/tables/table-availability.logic";

const POLL_MS = 15_000;

type FloorTable = {
  id: string;
  number: number;
  name: string | null;
  capacity: number;
  status: TableAvailabilityStatus;
  diningSession: {
    id: string;
    status: string;
    guestCount: number;
    staff: { id: string; displayName: string } | null;
    customer: { name: string } | null;
    orders: { total: number; status: string }[];
  } | null;
  activeReservation: {
    id: string;
    guestName: string;
    guestCount: number;
    reservedAt: string | Date;
    holdExpiresAt: string | Date;
  } | null;
};

type FloorViewer = {
  staffId: string;
  role: StaffRole;
};

export function FloorGridPoller({
  initialTables,
  viewer,
}: {
  initialTables: FloorTable[];
  viewer: FloorViewer;
}) {
  const [tables, setTables] = useState(initialTables);
  const [currentViewer, setCurrentViewer] = useState(viewer);

  usePollInterval(() => {
    void fetchStaffFloorTables().then((next) => {
      if (next.ok) {
        setTables(next.data.tables);
        setCurrentViewer(next.data.viewer);
      }
    });
  }, POLL_MS);

  return <FloorGrid tables={tables} viewer={currentViewer} />;
}
