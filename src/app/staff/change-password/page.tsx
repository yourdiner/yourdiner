import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/staff-session";
import { prisma } from "@/lib/db";
import { StaffChangePasswordForm } from "@/features/staff/components/staff-change-password-form";

export const dynamic = "force-dynamic";

export default async function StaffChangePasswordPage() {
  const session = await getStaffSession();
  if (!session) redirect("/staff/login");

  const staff = await prisma.staff.findUnique({
    where: { id: session.staffId },
    select: { mustChangePassword: true, isActive: true },
  });

  if (!staff?.isActive) redirect("/staff/login");
  if (!staff.mustChangePassword) redirect("/staff/floor");

  return <StaffChangePasswordForm />;
}
