import { describe, expect, it } from "vitest";
import {
  activeSessionBlocksWindow,
  filterReservationConflicts,
} from "./availability.service";

describe("activeSessionBlocksWindow", () => {
  it("blocks reservation windows that overlap projected dining", () => {
    const startedAt = new Date("2026-07-26T00:30:00.000Z");
    // avg 90 → free at 02:00
    const windowStart = new Date("2026-07-26T01:00:00.000Z");
    const windowEnd = new Date("2026-07-26T02:30:00.000Z");
    expect(activeSessionBlocksWindow(startedAt, windowStart, windowEnd, 90, 0)).toBe(
      true
    );
  });

  it("allows reservations after start + average dining time", () => {
    const startedAt = new Date("2026-07-26T00:30:00.000Z");
    // free at 02:00 — booking 05:00–06:30 must be allowed even if session still open
    const windowStart = new Date("2026-07-26T05:00:00.000Z");
    const windowEnd = new Date("2026-07-26T06:30:00.000Z");
    expect(activeSessionBlocksWindow(startedAt, windowStart, windowEnd, 90, 0)).toBe(
      false
    );
  });

  it("includes cleaning buffer in projected free time", () => {
    const startedAt = new Date("2026-07-26T00:30:00.000Z");
    // 90 + 15 buffer → free 02:15
    const windowStart = new Date("2026-07-26T02:00:00.000Z");
    const windowEnd = new Date("2026-07-26T03:30:00.000Z");
    expect(activeSessionBlocksWindow(startedAt, windowStart, windowEnd, 90, 15)).toBe(
      true
    );
    expect(
      activeSessionBlocksWindow(
        startedAt,
        new Date("2026-07-26T02:15:00.000Z"),
        new Date("2026-07-26T03:45:00.000Z"),
        90,
        15
      )
    ).toBe(false);
  });
});

describe("filterReservationConflicts dining sessions", () => {
  it("does not use a 24h block for CHECKED_IN with active session", () => {
    const windowStart = new Date("2026-07-26T05:00:00.000Z");
    const windowEnd = new Date("2026-07-26T06:30:00.000Z");
    const conflicts = filterReservationConflicts(
      [
        {
          id: "r1",
          restaurantId: "rest",
          tableId: "t1",
          status: "DINING",
          reservedAt: new Date("2026-07-26T00:30:00.000Z"),
          expectedEndAt: new Date("2026-07-26T02:00:00.000Z"),
          diningSessionId: "s1",
          guestName: "Guest",
          diningSession: {
            id: "s1",
            status: "ACTIVE",
            startedAt: new Date("2026-07-26T00:30:00.000Z"),
          },
        },
      ],
      windowStart,
      windowEnd,
      { averageDiningMinutes: 90, cleaningBufferMinutes: 0 }
    );
    expect(conflicts).toHaveLength(0);
  });

  it("still blocks when reservation window overlaps projected dining", () => {
    const windowStart = new Date("2026-07-26T01:00:00.000Z");
    const windowEnd = new Date("2026-07-26T02:30:00.000Z");
    const conflicts = filterReservationConflicts(
      [
        {
          id: "r1",
          restaurantId: "rest",
          tableId: "t1",
          status: "DINING",
          reservedAt: new Date("2026-07-26T00:30:00.000Z"),
          expectedEndAt: new Date("2026-07-26T02:00:00.000Z"),
          diningSessionId: "s1",
          guestName: "Guest",
          diningSession: {
            id: "s1",
            status: "ACTIVE",
            startedAt: new Date("2026-07-26T00:30:00.000Z"),
          },
        },
      ],
      windowStart,
      windowEnd,
      { averageDiningMinutes: 90, cleaningBufferMinutes: 0 }
    );
    expect(conflicts).toHaveLength(1);
  });
});
