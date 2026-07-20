import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReservationStatus } from "@prisma/client";

const prisma = {
  reservation: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({ prisma }));

describe("isWithinCustomerQrCheckInWindow", () => {
  const reservedAt = new Date(2026, 6, 12, 19, 0);
  const holdExpiresAt = new Date(2026, 6, 12, 19, 30);

  it("allows early arrival within 2 hours before reservedAt", async () => {
    const { isWithinCustomerQrCheckInWindow } = await import("./customer-qr-check-in");
    expect(
      isWithinCustomerQrCheckInWindow(reservedAt, holdExpiresAt, new Date(2026, 6, 12, 17, 0))
    ).toBe(true);
    expect(
      isWithinCustomerQrCheckInWindow(reservedAt, holdExpiresAt, new Date(2026, 6, 12, 18, 30))
    ).toBe(true);
  });

  it("allows during the hold window after reservedAt", async () => {
    const { isWithinCustomerQrCheckInWindow } = await import("./customer-qr-check-in");
    expect(
      isWithinCustomerQrCheckInWindow(reservedAt, holdExpiresAt, new Date(2026, 6, 12, 19, 10))
    ).toBe(true);
  });

  it("rejects more than 2 hours early", async () => {
    const { isWithinCustomerQrCheckInWindow } = await import("./customer-qr-check-in");
    expect(
      isWithinCustomerQrCheckInWindow(reservedAt, holdExpiresAt, new Date(2026, 6, 12, 16, 59))
    ).toBe(false);
  });

  it("rejects at or after holdExpiresAt", async () => {
    const { isWithinCustomerQrCheckInWindow } = await import("./customer-qr-check-in");
    expect(isWithinCustomerQrCheckInWindow(reservedAt, holdExpiresAt, holdExpiresAt)).toBe(false);
    expect(
      isWithinCustomerQrCheckInWindow(reservedAt, holdExpiresAt, new Date(2026, 6, 12, 19, 31))
    ).toBe(false);
  });
});

describe("findCustomerCheckInReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching reservation during hold window", async () => {
    const now = new Date(2026, 6, 12, 19, 10);
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-1",
        guestName: "Jordan",
        guestCount: 2,
        guestPhone: "9876543210",
        reservedAt: new Date(2026, 6, 12, 19, 0),
        holdExpiresAt: new Date(2026, 6, 12, 19, 30),
        status: ReservationStatus.CONFIRMED,
      },
    ]);

    const { findCustomerCheckInReservation } = await import("./customer-qr-check-in");
    const match = await findCustomerCheckInReservation({
      restaurantId: "rest-1",
      tableId: "table-1",
      phone: "9876543210",
      now,
    });

    expect(match?.id).toBe("res-1");
  });

  it("returns matching reservation for early arrival within 2 hours", async () => {
    const now = new Date(2026, 6, 12, 17, 30);
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-early",
        guestName: "Sam",
        guestCount: 4,
        guestPhone: "9123456780",
        reservedAt: new Date(2026, 6, 12, 19, 0),
        holdExpiresAt: new Date(2026, 6, 12, 19, 30),
        status: ReservationStatus.CONFIRMED,
      },
    ]);

    const { findCustomerCheckInReservation } = await import("./customer-qr-check-in");
    const match = await findCustomerCheckInReservation({
      restaurantId: "rest-1",
      tableId: "table-1",
      phone: "+91 91234 56780",
      now,
    });

    expect(match?.id).toBe("res-early");
  });

  it("returns null for wrong phone during hold", async () => {
    const now = new Date(2026, 6, 12, 19, 10);
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-1",
        guestName: "Jordan",
        guestCount: 2,
        guestPhone: "9876543210",
        reservedAt: new Date(2026, 6, 12, 19, 0),
        holdExpiresAt: new Date(2026, 6, 12, 19, 30),
        status: ReservationStatus.CONFIRMED,
      },
    ]);

    const { findCustomerCheckInReservation } = await import("./customer-qr-check-in");
    const match = await findCustomerCheckInReservation({
      restaurantId: "rest-1",
      tableId: "table-1",
      phone: "9000000000",
      now,
    });

    expect(match).toBeNull();
  });

  it("returns null when outside early and hold windows", async () => {
    const now = new Date(2026, 6, 12, 16, 0);
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-1",
        guestName: "Jordan",
        guestCount: 2,
        guestPhone: "9876543210",
        reservedAt: new Date(2026, 6, 12, 19, 0),
        holdExpiresAt: new Date(2026, 6, 12, 19, 30),
        status: ReservationStatus.CONFIRMED,
      },
    ]);

    const { findCustomerCheckInReservation } = await import("./customer-qr-check-in");
    const match = await findCustomerCheckInReservation({
      restaurantId: "rest-1",
      tableId: "table-1",
      phone: "9876543210",
      now,
    });

    expect(match).toBeNull();
  });
});
