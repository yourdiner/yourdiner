import { requireTenantPageContext, requireRestaurantStaff } from "@/lib/tenancy";
import { parsePrinterSettings } from "@/features/printing/settings";
import { getRecentPrintJobs } from "@/features/printing/printer.service";
import { PrintersSettingsForm } from "@/features/printing/components/printers-settings-form";
import { prisma } from "@/lib/db";

export default async function PrintersPage() {
  const tenant = await requireTenantPageContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

  const [row, jobs] = await Promise.all([
    prisma.restaurantSettings.findUnique({
      where: { restaurantId: tenant.restaurantId },
      select: { printerSettings: true },
    }),
    getRecentPrintJobs(tenant.restaurantId),
  ]);

  return (
    <div>
      <div className="border-b px-8 py-4">
        <h1 className="text-2xl font-bold">Printers</h1>
        <p className="text-muted-foreground">
          Configure billing and kitchen thermal printers. Browser print works without hardware.
        </p>
      </div>
      <div className="p-6">
        <PrintersSettingsForm
          initialSettings={parsePrinterSettings(row?.printerSettings)}
          initialJobs={jobs}
        />
      </div>
    </div>
  );
}
