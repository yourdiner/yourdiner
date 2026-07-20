import { describe, expect, it } from "vitest";
import { ReservationStatus } from "@prisma/client";
import { getReservationDisplayGroup } from "./reservation-queries";

function at(hour: number, minute = 0) {
  return new Date(2026, 6, 12, hour, minute);
}

const reservation = {
  status: ReservationStatus.CONFIRMED,
  reservedAt: at(0, 15),
  holdExpiresAt: at(0, 29),
};

describe("getReservationDisplayGroup (12:15 AM reservation, 14 min hold)", () => {
  it("before reserved time -> UPCOMING", () => {
    expect(getReservationDisplayGroup(reservation, at(0, 10))).toBe("UPCOMING");
  });

  it("during hold window -> RESERVED", () => {
    expect(getReservationDisplayGroup(reservation, at(0, 15))).toBe("RESERVED");
    expect(getReservationDisplayGroup(reservation, at(0, 28))).toBe("RESERVED");
  });

  it("after hold expires -> LATE (not UPCOMING)", () => {
    expect(getReservationDisplayGroup(reservation, at(0, 29))).toBe("LATE");
    expect(getReservationDisplayGroup(reservation, at(0, 45))).toBe("LATE");
  });

  it("NO_SHOW status -> NO_SHOW", () => {
    expect(
      getReservationDisplayGroup(
        { ...reservation, status: ReservationStatus.NO_SHOW },
        at(0, 45)
      )
    ).toBe("NO_SHOW");
  });
});
