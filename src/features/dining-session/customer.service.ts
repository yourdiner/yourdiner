import { prisma } from "@/lib/db";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

/** Fields safe to return on the unauthenticated customer-facing lookup. */
export type PublicCustomerLookup = {
  name: string;
};

const membershipInclude = {
  membership: { select: { id: true, name: true, discountPercent: true } },
} as const;

function phoneLookupVariants(normalized: string): string[] {
  return Array.from(
    new Set([
      normalized,
      `+91${normalized}`,
      `91${normalized}`,
      `0${normalized}`,
      `${normalized.slice(0, 5)}-${normalized.slice(5)}`,
      `${normalized.slice(0, 5)} ${normalized.slice(5)}`,
    ])
  );
}

/**
 * Staff/admin lookup — full customer record for POS.
 * Avoids loading the entire customer list into memory.
 */
export async function lookupCustomerByPhone(restaurantId: string, phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) return null;

  const exact = await prisma.customer.findFirst({
    where: { restaurantId, phone: normalized },
    include: membershipInclude,
  });
  if (exact) return exact;

  const byVariant = await prisma.customer.findFirst({
    where: { restaurantId, phone: { in: phoneLookupVariants(normalized) } },
    include: membershipInclude,
  });
  if (byVariant) return byVariant;

  // Legacy rows with odd formatting — digit-normalize in Postgres, return at most one row.
  const matches = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "Customer"
    WHERE "restaurantId" = ${restaurantId}
      AND RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${normalized}
    LIMIT 1
  `;
  if (!matches[0]) return null;

  return prisma.customer.findUnique({
    where: { id: matches[0].id },
    include: membershipInclude,
  });
}

/**
 * Host-scoped phone lookup for QR identify.
 * Returns only the display name — never VIP/visits/loyalty (enumeration oracle).
 */
export async function lookupCustomerPublicByPhone(
  restaurantId: string,
  phone: string
): Promise<PublicCustomerLookup | null> {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) return null;

  const exact = await prisma.customer.findFirst({
    where: { restaurantId, phone: normalized },
    select: { name: true },
  });
  if (exact) return { name: exact.name };

  const byVariant = await prisma.customer.findFirst({
    where: { restaurantId, phone: { in: phoneLookupVariants(normalized) } },
    select: { name: true },
  });
  if (byVariant) return { name: byVariant.name };

  const matches = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name
    FROM "Customer"
    WHERE "restaurantId" = ${restaurantId}
      AND RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${normalized}
    LIMIT 1
  `;
  if (!matches[0]) return null;
  return { name: matches[0].name };
}

export async function findOrCreateCustomer(
  restaurantId: string,
  phone: string,
  name?: string
) {
  const normalized = normalizePhone(phone);
  const existing = await lookupCustomerByPhone(restaurantId, normalized);
  if (existing) return existing;

  if (!name?.trim()) return null;

  return prisma.customer.create({
    data: {
      restaurantId,
      name: name.trim(),
      phone: normalized,
    },
    include: membershipInclude,
  });
}
