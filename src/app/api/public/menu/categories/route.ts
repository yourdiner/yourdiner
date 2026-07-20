import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/tenancy";
import { getCachedCategoriesWithFirstProducts } from "@/lib/menu-catalog";
import { parseSocialLinks } from "@/lib/social-links";
import { prisma } from "@/lib/db";
import {
  normalizeBrandPrimary,
  normalizeBrandSecondary,
  normalizeBrandAccent,
} from "@/lib/brand-colors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const tenant = await requireTenantContext();
    const [restaurant, categories] = await Promise.all([
      prisma.restaurant.findFirst({
        where: { id: tenant.restaurantId, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          branding: {
            select: {
              primaryColor: true,
              secondaryColor: true,
              accentColor: true,
              fontFamily: true,
              about: true,
              address: true,
              phone: true,
              email: true,
              gstNumber: true,
              receiptFooter: true,
              openingHours: true,
              socialLinks: true,
              logo: { select: { url: true } },
              cover: { select: { url: true } },
            },
          },
        },
      }),
      getCachedCategoriesWithFirstProducts(tenant.restaurantId),
    ]);

    if (!restaurant) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const branding = restaurant.branding
      ? {
          ...restaurant.branding,
          primaryColor: normalizeBrandPrimary(restaurant.branding.primaryColor),
          secondaryColor: normalizeBrandSecondary(restaurant.branding.secondaryColor),
          accentColor: normalizeBrandAccent(restaurant.branding.accentColor),
          openingHours: restaurant.branding.openingHours ?? [],
          socialLinks: parseSocialLinks(restaurant.branding.socialLinks),
        }
      : null;

    return NextResponse.json(
      {
        restaurant: { id: restaurant.id, name: restaurant.name, branding },
        categories,
      },
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
}
