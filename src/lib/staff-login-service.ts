import { prisma } from "@/lib/db";
import { verifyPassword } from "better-auth/crypto";
import { requireTenantContext } from "@/lib/tenancy";
import { isRestaurantOperational } from "@/lib/restaurant-access";
import { getErrorMessage } from "@/lib/errors";
import { StaffRole } from "@prisma/client";

const FLOOR_ROLES: StaffRole[] = ["STAFF", "CASHIER", "KITCHEN"];

export type StaffLoginResult =
  | {
      ok: true;
      staffId: string;
      displayName: string;
      role: StaffRole;
      mustChangePassword: boolean;
    }
  | { ok: false; error: string };

export async function verifyStaffPasswordLogin(
  mobile: string,
  password: string
): Promise<StaffLoginResult> {
  try {
    const tenant = await requireTenantContext();
    if (!isRestaurantOperational(tenant.restaurantStatus)) {
      return { ok: false, error: "This restaurant is no longer active" };
    }
    const normalizedMobile = mobile.replace(/\D/g, "").slice(-10);

    if (!normalizedMobile || normalizedMobile.length < 10) {
      return { ok: false, error: "Enter your 10-digit mobile number (not email)" };
    }

    if (!password.trim()) {
      return { ok: false, error: "Password is required" };
    }

    const staff = await prisma.staff.findFirst({
      where: {
        restaurantId: tenant.restaurantId,
        mobile: normalizedMobile,
        isActive: true,
        role: { in: FLOOR_ROLES },
      },
      select: {
        id: true,
        displayName: true,
        role: true,
        pinHash: true,
        mustChangePassword: true,
      },
    });

    if (!staff) {
      return { ok: false, error: "Invalid mobile or password" };
    }

    if (!staff.pinHash) {
      return {
        ok: false,
        error: "No password set for this staff member. Ask your manager to reset it in Team settings.",
      };
    }

    const valid = await verifyPassword({ hash: staff.pinHash, password });
    if (!valid) {
      return { ok: false, error: "Invalid mobile or password" };
    }

    return {
      ok: true,
      staffId: staff.id,
      displayName: staff.displayName,
      role: staff.role,
      mustChangePassword: staff.mustChangePassword,
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

/** @deprecated Prefer verifyStaffPasswordLogin */
export const verifyStaffPinLogin = verifyStaffPasswordLogin;
