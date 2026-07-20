export type TenantContext = {
  restaurantId: string;
  uuid: string;
  tenantKey: string;
  slug: string;
  name: string;
  restaurantStatus: import("@prisma/client").RestaurantStatus;
  subscriptionActive?: boolean;
  customDomain?: string | null;
  customDomainStatus?: import("@prisma/client").CustomDomainStatus | string | null;
};
