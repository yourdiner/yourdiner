"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsGeneral } from "@/features/restaurants/components/settings-general";
import { SettingsMediaUploads } from "@/features/restaurants/components/settings-media-uploads";
import { SettingsTaxReceipt } from "@/features/restaurants/components/settings-tax-receipt";
import { SettingsLoyalty } from "@/features/restaurants/components/settings-loyalty";
import { SettingsReservations } from "@/features/restaurants/components/settings-reservations";
import { SettingsOrders } from "@/features/restaurants/components/settings-orders";
import { DnsInstructions } from "@/features/admin/components/dns-instructions";
import type { LoyaltySettings } from "@/lib/loyalty-settings";
import type { TaxSettings } from "@/lib/tax-settings";
import type { ReservationSettings } from "@/lib/reservation-settings";
import type { OrderSettings } from "@/lib/order-settings";

type BrandingData = {
  about: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  googleMapsUrl: string | null;
  socialLinks?: unknown;
  gstNumber: string | null;
  panNumber: string | null;
  receiptFooter: string | null;
  invoiceFooter: string | null;
  logo: { id: string; url: string } | null;
  cover: { id: string; url: string } | null;
  favicon: { id: string; url: string } | null;
} | null;

interface SettingsPageTabsProps {
  restaurant: {
    name: string;
    subdomain: string;
    uuid: string;
    customDomain?: string | null;
    customDomainStatus?: string | null;
    settings: {
      language: string;
      currency: string;
      timezone: string;
    } | null;
  };
  branding: BrandingData;
  loyaltySettings: LoyaltySettings;
  taxSettings: TaxSettings;
  reservationSettings: ReservationSettings;
  orderSettings: OrderSettings;
  showReservationsTab?: boolean;
}

export function SettingsPageTabs({
  restaurant,
  branding,
  loyaltySettings,
  taxSettings,
  reservationSettings,
  orderSettings,
  showReservationsTab = false,
}: SettingsPageTabsProps) {
  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap gap-1">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="media">Media</TabsTrigger>
        <TabsTrigger value="tax">Tax & Receipt</TabsTrigger>
        <TabsTrigger value="loyalty">Loyalty</TabsTrigger>
        <TabsTrigger value="orders">Orders</TabsTrigger>
        {showReservationsTab ? <TabsTrigger value="reservations">Reservations</TabsTrigger> : null}
        <TabsTrigger value="dns">DNS</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <SettingsGeneral
          restaurant={restaurant}
          branding={
            branding
              ? {
                  about: branding.about,
                  address: branding.address,
                  city: branding.city,
                  state: branding.state,
                  postalCode: branding.postalCode,
                  phone: branding.phone,
                  email: branding.email,
                  googleMapsUrl: branding.googleMapsUrl,
                  socialLinks: branding.socialLinks,
                }
              : null
          }
        />
      </TabsContent>

      <TabsContent value="media">
        <SettingsMediaUploads branding={branding} />
      </TabsContent>

      <TabsContent value="tax">
        <SettingsTaxReceipt
          branding={
            branding
              ? {
                  gstNumber: branding.gstNumber,
                  panNumber: branding.panNumber,
                  receiptFooter: branding.receiptFooter,
                  invoiceFooter: branding.invoiceFooter,
                }
              : null
          }
          taxSettings={taxSettings}
        />
      </TabsContent>

      <TabsContent value="loyalty">
        <SettingsLoyalty loyaltySettings={loyaltySettings} />
      </TabsContent>

      <TabsContent value="orders">
        <SettingsOrders orderSettings={orderSettings} />
      </TabsContent>

      {showReservationsTab ? (
        <TabsContent value="reservations">
          <SettingsReservations reservationSettings={reservationSettings} />
        </TabsContent>
      ) : null}

      <TabsContent value="dns">
        <DnsInstructions
          subdomain={restaurant.subdomain}
          uuid={restaurant.uuid}
          customDomain={restaurant.customDomain}
          customDomainStatus={restaurant.customDomainStatus}
          rootDomain={process.env.NEXT_PUBLIC_ROOT_DOMAIN?.split(":")[0]}
        />
      </TabsContent>
    </Tabs>
  );
}
