import { requireTenantPageContext } from "@/lib/tenancy";
import { getStaffSession } from "@/lib/staff-session";
import { redirect } from "next/navigation";
import { StaffLoginForm } from "@/features/staff/components/staff-login-form";

export const dynamic = "force-dynamic";

export default async function StaffLoginPage() {
  const existing = await getStaffSession();
  if (existing) redirect("/staff/floor");

  const tenant = await requireTenantPageContext();
  return <StaffLoginForm restaurantName={tenant.name} />;
}
