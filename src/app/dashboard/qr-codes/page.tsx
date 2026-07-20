import { requireTenantPageContext } from "@/lib/tenancy";
import { getModuleUpgradeLabel, restaurantHasModuleAccess } from "@/lib/plan-access";
import { UpgradePrompt } from "@/components/upgrade-prompt";
import { getQRCodes } from "@/features/qr/actions";
import { QRCodesManager } from "@/features/qr/components/qr-codes-manager";

export default async function QRCodesPage() {
  const tenant = await requireTenantPageContext();
  const hasAccess = await restaurantHasModuleAccess(tenant.restaurantId, "qr_codes");

  if (!hasAccess) {
    return (
      <div>
        <div className="border-b px-8 py-4">
          <h1 className="text-2xl font-bold">QR Codes</h1>
        </div>
        <div className="p-6">
          <UpgradePrompt
            title={`Upgrade to ${getModuleUpgradeLabel("qr_codes")} Plan`}
            description="QR code management is available on the Starter plan and above."
          />
        </div>
      </div>
    );
  }

  const qrCodes = await getQRCodes();

  return (
    <div>
      <div className="border-b px-8 py-4">
        <h1 className="text-2xl font-bold">QR Codes</h1>
        <p className="text-muted-foreground">Generate and manage QR codes for your menu</p>
      </div>
      <div className="p-6">
        <QRCodesManager initialQRCodes={qrCodes} />
      </div>
    </div>
  );
}
