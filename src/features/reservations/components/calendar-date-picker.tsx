"use client";

import { useRouter } from "next/navigation";

export function CalendarDatePicker({ dateStr }: { dateStr: string }) {
  const router = useRouter();

  return (
    <input
      type="date"
      defaultValue={dateStr}
      className="border px-2 py-1 text-sm"
      onChange={(e) => {
        router.push(`/admin/reservations/calendar?date=${e.target.value}`);
      }}
    />
  );
}
