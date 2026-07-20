import { PlatformSidebarServer } from "@/components/layout/platform-sidebar-server";
import { getPlatformSettingsAction } from "@/features/platform/settings-actions";
import { BillingSettingsForm } from "@/features/platform/components/billing-settings-form";
import { BrandSettingsForm } from "@/features/platform/components/brand-settings-form";

export default async function PlatformSettingsPage() {
  const settings = await getPlatformSettingsAction();

  return (
    <div className="flex h-screen">
      <PlatformSidebarServer />
      <main className="flex-1 overflow-y-auto">
        <div className="border-b px-8 py-6">
          <h1 className="text-2xl font-bold">Platform Settings</h1>
          <p className="text-muted-foreground">
            Global configuration for {settings.brandName || "your platform"}
          </p>
        </div>
        <div className="space-y-6 p-8">
          <BrandSettingsForm
            brandName={settings.brandName || "Restaurant OS"}
            brandLogo={settings.brandLogo ?? null}
          />
          <BillingSettingsForm
            defaultTrialDays={settings.defaultTrialDays}
            globalGracePeriodDays={settings.globalGracePeriodDays}
            razorpayConfigured={settings.razorpayConfigured}
          />
        </div>
      </main>
    </div>
  );
}
