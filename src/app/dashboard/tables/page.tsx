import { requireTenantPageContext } from "@/lib/tenancy";

import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";

import { UpgradePrompt } from "@/components/upgrade-prompt";

import { getTables } from "@/features/tables/actions";

import { restaurantHasCustomerQrOrdering } from "@/lib/customer-order-service";

import { TablesManager } from "@/features/tables/components/tables-manager";



export default async function TablesPage() {

  const tenant = await requireTenantPageContext();

  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "tables");



  if (!hasAccess) {

    const planLabel = getModuleUpgradeLabel("tables");

    return (

      <div>

        <div className="border-b px-8 py-4">

          <h1 className="text-2xl font-bold">Tables</h1>

        </div>

        <div className="p-6">

          <UpgradePrompt

            title={`Upgrade to ${planLabel} Plan`}

            description="Table management, visual layout, and per-table QR codes are available on the Cafe Staff plan and above."

          />

        </div>

      </div>

    );

  }



  const tables = await getTables();
  const canGenerateTableQr = await restaurantHasCustomerQrOrdering(tenant.restaurantId);

  return (
    <div>
      <div className="border-b px-8 py-4">
        <h1 className="text-2xl font-bold">Tables</h1>
        <p className="text-muted-foreground">Manage seating, capacity, and table status</p>
      </div>
      <div className="p-6">
        <TablesManager tables={tables} canGenerateTableQr={canGenerateTableQr} />
      </div>
    </div>
  );

}

