"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DashboardData = {
  counts: {
    upcoming: number;
    reserved: number;
    late: number;
    checkedIn: number;
    noShow: number;
    cancelled: number;
    completed: number;
  };
  tablesReserved: number;
  tablesAvailable: number;
};

export function ReservationsDashboard({ data }: { data: DashboardData }) {
  const stats = [
    { label: "Upcoming", value: data.counts.upcoming },
    { label: "Reserved", value: data.counts.reserved },
    { label: "Late", value: data.counts.late },
    { label: "Checked In", value: data.counts.checkedIn },
    { label: "No Show", value: data.counts.noShow },
    { label: "Cancelled", value: data.counts.cancelled },
    { label: "Completed", value: data.counts.completed },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/reservations/new"
          className="bg-primary px-6 py-3 text-sm font-semibold text-on-primary"
        >
          New Reservation
        </Link>
        <Link
          href="/admin/reservations/calendar"
          className="border border-tertiary-fixed px-6 py-3 text-sm font-semibold"
        >
          Calendar View
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tables available now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-700">{data.tablesAvailable}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tables reserved / occupied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-700">{data.tablesReserved}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
