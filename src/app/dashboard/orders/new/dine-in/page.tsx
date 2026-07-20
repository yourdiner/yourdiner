import { requireTenantPageContext } from "@/lib/tenancy";
import { restaurantHasModuleAccess } from "@/lib/plan-access";
import { redirect } from "next/navigation";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import {
  adminGetWizardTables,
  adminGetWaitersForAssignment,
} from "@/features/dining-session/queries";
import { NewSessionWizard } from "@/features/dining-session/components/new-session-wizard";

export const dynamic = "force-dynamic";

export default async function NewDineInOrderPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "orders");
  if (!hasAccess) redirect("/admin/orders");

  const [tables, waiters] = await Promise.all([
    adminGetWizardTables(),
    adminGetWaitersForAssignment(),
  ]);

  return (
    <AdminPageShell title="New Order — Dine-In" showSearch={false}>
      <NewSessionWizard tables={tables} waiters={waiters} />
    </AdminPageShell>
  );
}
