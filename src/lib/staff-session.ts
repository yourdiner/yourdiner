import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { createHash, randomBytes } from "crypto";
import { StaffRole } from "@prisma/client";
import { requireTenantContext, type TenantContext } from "@/lib/tenancy";
import { AppError } from "@/lib/errors";

export const STAFF_SESSION_COOKIE = "staff_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type StaffSessionPayload = {
  staffId: string;
  restaurantId: string;
  displayName: string;
  role: StaffRole;
  token: string;
};

function generateToken() {
  return randomBytes(32).toString("hex");
}

function hashStaffToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenLookupValues(token: string): string[] {
  const hashed = hashStaffToken(token);
  return hashed === token ? [token] : [hashed, token];
}

export async function createStaffSession(staffId: string): Promise<string> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: { restaurantId: true },
  });
  if (!staff) throw new Error("STAFF_NOT_FOUND");

  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.staffSession.create({
    data: {
      staffId,
      restaurantId: staff.restaurantId,
      token: hashStaffToken(token),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroyStaffSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  if (token) {
    const tokens = tokenLookupValues(token);
    await prisma.staffSession.updateMany({
      where: { token: { in: tokens }, isActive: true },
      data: { isActive: false },
    });
    await prisma.staffSession.deleteMany({ where: { token: { in: tokens } } });
  }

  cookieStore.set(STAFF_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export const getStaffSession = cache(async (): Promise<StaffSessionPayload | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_SESSION_COOKIE)?.value;
  if (!token) return null;

  const hashed = hashStaffToken(token);
  let session = await prisma.staffSession.findUnique({
    where: { token: hashed },
    include: {
      staff: {
        select: {
          id: true,
          restaurantId: true,
          displayName: true,
          role: true,
          isActive: true,
        },
      },
    },
  });

  // Dual-read: migrate legacy plaintext tokens on first use
  if (!session) {
    session = await prisma.staffSession.findUnique({
      where: { token },
      include: {
        staff: {
          select: {
            id: true,
            restaurantId: true,
            displayName: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
    if (session) {
      await prisma.staffSession
        .update({
          where: { id: session.id },
          data: { token: hashed },
        })
        .catch(() => undefined);
    }
  }

  if (!session || !session.isActive || session.expiresAt < new Date() || !session.staff.isActive) {
    return null;
  }

  return {
    staffId: session.staff.id,
    restaurantId: session.staff.restaurantId,
    displayName: session.staff.displayName,
    role: session.staff.role,
    token,
  };
});

export async function requireStaffSession(): Promise<StaffSessionPayload> {
  const session = await getStaffSession();
  if (!session) {
    throw new Error("STAFF_UNAUTHORIZED");
  }
  return session;
}

export function assertStaffTenantMatch(
  staffSession: StaffSessionPayload,
  tenant: TenantContext
): void {
  if (staffSession.restaurantId !== tenant.restaurantId) {
    throw new AppError("Staff session does not match tenant", "FORBIDDEN", 403);
  }
}

export async function requireStaffTenantSession(): Promise<{
  staffSession: StaffSessionPayload;
  tenant: TenantContext;
}> {
  const staffSession = await requireStaffSession();
  const tenant = await requireTenantContext();
  assertStaffTenantMatch(staffSession, tenant);
  return { staffSession, tenant };
}
