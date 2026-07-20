import { prisma } from "@/lib/db";

const CACHE_TTL_MS = 60_000;

let cachedSettings: {
  defaultTrialDays: number;
  globalGracePeriodDays: number;
  fetchedAt: number;
} | null = null;

let cachedBrand: {
  brandName: string;
  brandLogo: string | null;
  fetchedAt: number;
} | null = null;

export async function getPlatformSettings() {
  const row = await prisma.platformSettings.findFirst();
  if (row) {
    if (row.defaultTrialDays == null || row.globalGracePeriodDays == null) {
      return prisma.platformSettings.update({
        where: { id: row.id },
        data: {
          defaultTrialDays: row.defaultTrialDays ?? 7,
          globalGracePeriodDays: row.globalGracePeriodDays ?? 7,
        },
      });
    }
    return row;
  }

  return prisma.platformSettings.create({
    data: {
      defaultTrialDays: 7,
      globalGracePeriodDays: 7,
    },
  });
}

async function getCachedBillingSettings() {
  const now = Date.now();
  if (cachedSettings && now - cachedSettings.fetchedAt < CACHE_TTL_MS) {
    return cachedSettings;
  }

  const settings = await getPlatformSettings();
  cachedSettings = {
    defaultTrialDays: settings.defaultTrialDays,
    globalGracePeriodDays: settings.globalGracePeriodDays,
    fetchedAt: now,
  };
  return cachedSettings;
}

export async function getDefaultTrialDays(): Promise<number> {
  const settings = await getCachedBillingSettings();
  return settings.defaultTrialDays;
}

export async function getGlobalGraceDays(): Promise<number> {
  const settings = await getCachedBillingSettings();
  return settings.globalGracePeriodDays;
}

/** Returns the platform brand name + logo (cached), used across the whole app. */
export async function getPlatformBrand(): Promise<{
  brandName: string;
  brandLogo: string | null;
}> {
  const now = Date.now();
  if (cachedBrand && now - cachedBrand.fetchedAt < CACHE_TTL_MS) {
    return { brandName: cachedBrand.brandName, brandLogo: cachedBrand.brandLogo };
  }

  const settings = await getPlatformSettings();
  cachedBrand = {
    brandName: settings.brandName || "Restaurant OS",
    brandLogo: settings.brandLogo ?? null,
    fetchedAt: now,
  };
  return { brandName: cachedBrand.brandName, brandLogo: cachedBrand.brandLogo };
}

export function invalidatePlatformSettingsCache() {
  cachedSettings = null;
  cachedBrand = null;
}
