"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import {
  createRestaurantAndOwner,
  isSubdomainAvailable,
} from "@/features/restaurants/create-restaurant-core";
import { onboardingSchema } from "@/features/onboarding/onboarding-schema";

const SUBDOMAIN_RE = /^[a-z0-9]{3,32}$/;

export async function checkSubdomainAvailabilityAction(
  subdomain: string
): Promise<{ available: boolean; reason?: string }> {
  const value = (subdomain || "").trim().toLowerCase();
  if (!SUBDOMAIN_RE.test(value)) {
    return { available: false, reason: "invalid" };
  }
  const available = await isSubdomainAvailable(value);
  return { available };
}

export async function submitRestaurantOnboarding(input: unknown) {
  const data = onboardingSchema.parse(input);

  const ownerPhone = `+${data.dialCode.replace(/^\+/, "")}${data.phone}`;

  try {
    const { restaurant } = await createRestaurantAndOwner({
      name: data.name,
      subdomain: data.subdomain,
      // Public onboarding always starts on the trial-eligible starter plan.
      planSlug: "starter",
      ownerName: data.ownerName,
      ownerEmail: data.ownerEmail,
      ownerPhone,
      address: data.address,
      city: data.city,
      state: data.state || undefined,
      postalCode: data.postalCode || undefined,
      country: data.country,
    });

    revalidatePath("/platform/restaurants");
    return { success: true as const, restaurantName: restaurant.name };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("Could not create restaurant. Please try again.", "ONBOARDING_FAILED", 500);
  }
}
