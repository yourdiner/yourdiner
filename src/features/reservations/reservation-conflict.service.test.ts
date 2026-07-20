import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { ReservationStatus } from "@prisma/client";

const getRestaurantReservationSettings = vi.fn();

vi.mock("@/lib/reservation-settings", () => ({
  getRestaurantReservationSettings,
}));

const prisma = {
  reservation: {
    findMany: vi.fn(),
  },
  activityLog: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db", () => ({
  prisma,
}));

describe("ReservationConflictService policy + audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRestaurantReservationSettings.mockResolvedValue({
      enabled: true,
      averageDiningMinutes: 90,
      holdTimeMinutes: 30,
      cleaningBufferMinutes: 0,
      autoMarkNoShow: true,
      autoReleaseOnNoShow: true,
      allowWalkInOverride: true,
      reservationIntervalMinutes: 30,
      reservationConflictPolicy: "BLOCK",
    });
    prisma.reservation.findMany.mockResolvedValue([
      {
        id: "res-1",
        guestName: "Alex",
        reservedAt: new Date(2026, 6, 12, 16, 30),
        holdExpiresAt: new Date(2026, 6, 12, 17, 0),
        status: ReservationStatus.CONFIRMED,
      },
    ]);
    prisma.activityLog.create.mockResolvedValue({ id: "log-1" });
  });

  it("BLOCK rejects overlapping session without creating an audit log", async () => {
    const { assertSessionReservationAllowed } = await import("./reservation-conflict.service");
    const now = new Date(2026, 6, 12, 15, 40);

    await expect(
      assertSessionReservationAllowed({
        restaurantId: "rest-1",
        tableId: "table-1",
        now,
      })
    ).rejects.toMatchObject({
      code: "RESERVATION_OVERLAP",
      details: expect.objectContaining({
        policy: "BLOCK",
        canOverride: false,
      }),
    });
    expect(prisma.activityLog.create).not.toHaveBeenCalled();
  });

  it("WARN without acknowledgment returns warning payload", async () => {
    getRestaurantReservationSettings.mockResolvedValue({
      enabled: true,
      averageDiningMinutes: 90,
      holdTimeMinutes: 30,
      cleaningBufferMinutes: 0,
      autoMarkNoShow: true,
      autoReleaseOnNoShow: true,
      allowWalkInOverride: true,
      reservationIntervalMinutes: 30,
      reservationConflictPolicy: "WARN",
    });

    const { assertSessionReservationAllowed } = await import("./reservation-conflict.service");
    const now = new Date(2026, 6, 12, 15, 40);

    try {
      await assertSessionReservationAllowed({
        restaurantId: "rest-1",
        tableId: "table-1",
        now,
      });
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({
        code: "RESERVATION_OVERLAP",
        details: expect.objectContaining({
          policy: "WARN",
          canOverride: true,
        }),
      });
    }
  });

  it("WARN with override allows and logReservationOverride writes audit", async () => {
    getRestaurantReservationSettings.mockResolvedValue({
      enabled: true,
      averageDiningMinutes: 90,
      holdTimeMinutes: 30,
      cleaningBufferMinutes: 0,
      autoMarkNoShow: true,
      autoReleaseOnNoShow: true,
      allowWalkInOverride: true,
      reservationIntervalMinutes: 30,
      reservationConflictPolicy: "WARN",
    });

    const {
      assertSessionReservationAllowed,
      logReservationOverride,
    } = await import("./reservation-conflict.service");
    const now = new Date(2026, 6, 12, 15, 40);

    const result = await assertSessionReservationAllowed({
      restaurantId: "rest-1",
      tableId: "table-1",
      now,
      overrideAcknowledged: true,
    });

    expect(result).toMatchObject({
      allowed: true,
      overridden: true,
    });
    if (!result.overridden) throw new Error("expected override");

    await logReservationOverride({
      restaurantId: "rest-1",
      tableId: "table-1",
      actor: {
        type: "admin",
        userId: "user-1",
        staffId: "staff-1",
        role: "OWNER",
        displayName: "Owner",
      },
      conflict: result.conflict,
    });

    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        restaurantId: "rest-1",
        userId: "user-1",
        action: "CREATE",
        entity: "reservation_conflict_override",
        entityId: "res-1",
        metadata: expect.objectContaining({
          reason: "Reservation Override",
          tableId: "table-1",
          reservationId: "res-1",
          userName: "Owner",
          role: "Admin",
        }),
      }),
    });
  });

  it("allows when expected finish is before reservation", async () => {
    getRestaurantReservationSettings.mockResolvedValue({
      enabled: true,
      averageDiningMinutes: 30,
      holdTimeMinutes: 30,
      cleaningBufferMinutes: 0,
      autoMarkNoShow: true,
      autoReleaseOnNoShow: true,
      allowWalkInOverride: true,
      reservationIntervalMinutes: 30,
      reservationConflictPolicy: "BLOCK",
    });

    const { assertSessionReservationAllowed } = await import("./reservation-conflict.service");
    const result = await assertSessionReservationAllowed({
      restaurantId: "rest-1",
      tableId: "table-1",
      now: new Date(2026, 6, 12, 15, 40),
    });
    expect(result).toEqual({ allowed: true, overridden: false });
  });
});
