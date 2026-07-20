import { getRestaurantSettings } from "@/features/restaurants/actions";
import { SettingsPageTabs } from "@/features/restaurants/components/settings-page-tabs";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { parseLoyaltySettings } from "@/lib/loyalty-settings";
import { parseTaxSettings } from "@/lib/tax-settings";
import { parseReservationSettings } from "@/lib/reservation-settings";
import { parseOrderSettings } from "@/lib/order-settings";
import { restaurantHasModuleAccess } from "@/lib/plan-access";
import { requireTenantPageContext } from "@/lib/tenancy";

export default async function SettingsPage() {
  const tenant = await requireTenantPageContext();
  const restaurant = await getRestaurantSettings();

  if (!restaurant) return null;

  const showReservationsTab = await restaurantHasModuleAccess(
    tenant.restaurantId,
    "reservations"
  );

  const branding = restaurant.branding
    ? {
        about: restaurant.branding.about,
        address: restaurant.branding.address,
        city: restaurant.branding.city,
        state: restaurant.branding.state,
        postalCode: restaurant.branding.postalCode,
        phone: restaurant.branding.phone,
        email: restaurant.branding.email,
        googleMapsUrl: restaurant.branding.googleMapsUrl,
        socialLinks: restaurant.branding.socialLinks,
        gstNumber: restaurant.branding.gstNumber,
        panNumber: restaurant.branding.panNumber,
        receiptFooter: restaurant.branding.receiptFooter,
        invoiceFooter: restaurant.branding.invoiceFooter,
        logo: restaurant.branding.logo,
        cover: restaurant.branding.cover,
        favicon: restaurant.branding.favicon,
      }
    : null;

  const loyaltySettings = parseLoyaltySettings(restaurant.settings?.loyaltySettings);
  const taxSettings = parseTaxSettings(
    restaurant.settings as { taxPercent?: number; taxInclusive?: boolean } | null
  );
  const reservationSettings = parseReservationSettings(
    restaurant.settings?.reservationSettings,
    restaurant.settings?.averageDiningMinutes ?? 90
  );
  const orderSettings = parseOrderSettings(restaurant.settings?.orderSettings);

  return (
    <AdminPageShell title="Settings" searchPlaceholder="Search settings...">
      <div className="mx-auto max-w-[1152px]">
        <SettingsPageTabs
          restaurant={{
            name: restaurant.name,
            subdomain: restaurant.subdomain,
            uuid: restaurant.uuid,
            customDomain: restaurant.customDomain,
            customDomainStatus: restaurant.customDomainStatus,
            settings: restaurant.settings,
          }}
          branding={branding}
          loyaltySettings={loyaltySettings}
          taxSettings={taxSettings}
          reservationSettings={reservationSettings}
          orderSettings={orderSettings}
          showReservationsTab={showReservationsTab}
        />
      </div>
    </AdminPageShell>
  );
}
