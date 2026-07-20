import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStaffTenantSession } from "@/lib/staff-session";
import { hashStaffPassword } from "@/lib/staff-pin";
import { prisma } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(request: NextRequest) {
  try {
    const { staffSession } = await requireStaffTenantSession();
    const parsed = bodySchema.parse(await request.json());
    const passwordHash = await hashStaffPassword(parsed.newPassword);

    await prisma.staff.update({
      where: { id: staffSession.staffId },
      data: {
        pinHash: passwordHash,
        mustChangePassword: false,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error) },
      { status: 400 }
    );
  }
}
