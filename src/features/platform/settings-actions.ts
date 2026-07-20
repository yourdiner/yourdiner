"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/tenancy";
import {
  getPlatformSettings,
  invalidatePlatformSettingsCache,
} from "@/modules/subscription-engine/services/platform-settings.service";
import { isRazorpayConfigured } from "@/lib/payments/razorpay";
import { prisma } from "@/lib/db";

const billingSettingsSchema = z.object({
  defaultTrialDays: z.number().int().min(0).max(365),
  globalGracePeriodDays: z.number().int().min(0).max(90),
});

const brandSettingsSchema = z.object({
  brandName: z.string().trim().min(1, "Brand name is required").max(60),
  brandLogo: z
    .string()
    .trim()
    .url("Enter a valid logo URL")
    .max(2048)
    .optional()
    .or(z.literal("")),
});

export async function getPlatformSettingsAction() {
  await requireSuperAdmin();
  const settings = await getPlatformSettings();
  return {
    ...settings,
    razorpayConfigured: isRazorpayConfigured(),
  };
}

export async function updateBillingSettings(input: unknown) {
  await requireSuperAdmin();
  const data = billingSettingsSchema.parse(input);
  const existing = await getPlatformSettings();

  const updated = await prisma.platformSettings.update({
    where: { id: existing.id },
    data: {
      defaultTrialDays: data.defaultTrialDays,
      globalGracePeriodDays: data.globalGracePeriodDays,
    },
  });

  invalidatePlatformSettingsCache();
  revalidatePath("/platform/settings");
  return updated;
}

export async function updateBrandSettings(input: unknown) {
  await requireSuperAdmin();
  const data = brandSettingsSchema.parse(input);
  const existing = await getPlatformSettings();

  const updated = await prisma.platformSettings.update({
    where: { id: existing.id },
    data: {
      brandName: data.brandName,
      brandLogo: data.brandLogo ? data.brandLogo : null,
    },
  });

  invalidatePlatformSettingsCache();
  revalidatePath("/", "layout");
  return updated;
}
