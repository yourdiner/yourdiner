"use server";

import { prisma } from "@/lib/db";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { requirePlanFeature } from "@/lib/permissions";
import { brandingSchema } from "@/features/branding/schemas";
import { StaffRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { revalidatePublicMenuCache } from "@/lib/menu-cache";
import { getRestaurantBrandingCached } from "@/lib/request-cache";

export async function getBranding() {
  const tenant = await requireTenantContext();
  return getRestaurantBrandingCached(tenant.restaurantId);
}

export async function getPublicBranding(restaurantId: string) {
  const { getCachedPublicBranding } = await import("@/lib/menu-cache");
  return getCachedPublicBranding(restaurantId);
}

export async function updateBranding(input: unknown) {
  const tenant = await requireTenantContext();
  const { staff } = await requireRestaurantStaff(tenant.restaurantId, [StaffRole.OWNER, StaffRole.MANAGER]);
  await requirePlanFeature(tenant.restaurantId, "branding");

  const data = brandingSchema.parse(input);

  const branding = await prisma.restaurantBranding.upsert({
    where: { restaurantId: tenant.restaurantId },
    update: data,
    create: { restaurantId: tenant.restaurantId, ...data },
    include: { logo: true, cover: true, favicon: true },
  });

  await prisma.activityLog.create({
    data: {
      restaurantId: tenant.restaurantId,
      userId: staff.userId,
      action: "UPDATE",
      entity: "branding",
      entityId: branding.id,
    },
  });

  revalidatePath("/dashboard/branding");
  revalidatePath("/public-menu/menu");
  revalidatePublicMenuCache(tenant.restaurantId);
  return branding;
}

export async function setBrandingImage(
  type: "logo" | "cover" | "favicon",
  mediaId: string
) {
  const tenant = await requireTenantContext();
  await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);
  await requirePlanFeature(tenant.restaurantId, "branding");

  const fieldMap = { logo: "logoId", cover: "coverId", favicon: "faviconId" } as const;

  const branding = await prisma.restaurantBranding.upsert({
    where: { restaurantId: tenant.restaurantId },
    update: { [fieldMap[type]]: mediaId },
    create: { restaurantId: tenant.restaurantId, [fieldMap[type]]: mediaId },
    include: { logo: true, cover: true, favicon: true },
  });

  revalidatePath("/dashboard/branding");
  revalidatePath("/public-menu/menu");
  revalidatePublicMenuCache(tenant.restaurantId);
  return branding;
}
