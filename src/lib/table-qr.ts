import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { buildRestaurantUrl, buildTenantUrl } from "@/lib/hostname";
import { toTenantHostKey } from "@/lib/tenancy-keys";

/** Cryptographically random URL slug for table QR links (unguessable). */
export function generateTableQrSlug(): string {
  return randomBytes(10).toString("base64url");
}

/**
 * Legacy predictable slug (`T1`, `T2`, …). Kept for seed/demo and for
 * resolving existing printed QR codes that still store this format.
 * New tables must use {@link generateTableQrSlug}.
 */
export function tableQrSlugFromNumber(tableNumber: number): string {
  return `T${tableNumber}`;
}

export function normalizeTableQrSlug(slug: string): string {
  const trimmed = slug.trim();
  if (/^T\d+$/i.test(trimmed)) {
    return `T${trimmed.slice(1)}`;
  }
  if (/^\d+$/.test(trimmed)) {
    return `T${trimmed}`;
  }
  return trimmed;
}

/**
 * Resolve a table by its QR slug only.
 * Does NOT fall back to table number — that allowed guessing `/customer/table/T3`.
 * Existing tables whose stored qrSlug is still `T{n}` continue to work via slug match.
 */
export async function resolveTableByQrSlug(restaurantId: string, slug: string) {
  const trimmed = slug.trim();
  if (!trimmed) {
    throw new AppError("Table not found", "NOT_FOUND", 404);
  }

  const normalized = normalizeTableQrSlug(trimmed);
  const candidates = Array.from(new Set([trimmed, normalized, slug]));

  const table = await prisma.table.findFirst({
    where: {
      restaurantId,
      isActive: true,
      qrSlug: { in: candidates },
    },
  });

  if (!table) {
    throw new AppError("Table not found", "NOT_FOUND", 404);
  }

  return table;
}

/** Create a unique random qrSlug for a restaurant (retries on rare collisions). */
export async function allocateTableQrSlug(restaurantId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const qrSlug = generateTableQrSlug();
    const clash = await prisma.table.findFirst({
      where: { restaurantId, qrSlug },
      select: { id: true },
    });
    if (!clash) return qrSlug;
  }
  throw new AppError("Could not allocate table QR slug", "INTERNAL", 500);
}

/** @deprecated Prefer buildCustomerTableUrlForRestaurant when custom domains matter. */
export function buildCustomerTableUrl(tenantKey: string, qrSlug: string): string {
  return buildTenantUrl(tenantKey, `/customer/table/${qrSlug}`);
}

export function buildCustomerTableUrlForRestaurant(
  restaurant: {
    uuid?: string;
    subdomain?: string | null;
    tenantKey?: string;
    customDomain?: string | null;
    customDomainStatus?: string | null;
  },
  qrSlug: string
): string {
  const tenantKey =
    restaurant.tenantKey ||
    restaurant.subdomain?.trim().toLowerCase() ||
    (restaurant.uuid ? toTenantHostKey(restaurant.uuid) : "");
  return buildRestaurantUrl(
    {
      tenantKey,
      customDomain: restaurant.customDomain,
      customDomainStatus: restaurant.customDomainStatus,
    },
    `/customer/table/${qrSlug}`
  );
}
