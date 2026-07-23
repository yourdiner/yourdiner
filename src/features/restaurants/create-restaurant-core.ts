import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "crypto";

export interface CreateRestaurantCoreInput {
  name: string;
  subdomain: string;
  planSlug: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  address: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

/**
 * Shared restaurant + owner creation used by both the super-admin create flow
 * and the public onboarding form. Callers are responsible for authorization.
 */
export async function createRestaurantAndOwner(data: CreateRestaurantCoreInput) {
  const existing = await prisma.restaurant.findUnique({
    where: { subdomain: data.subdomain },
  });
  if (existing) throw new AppError("Subdomain already taken", "SUBDOMAIN_EXISTS", 400);

  const existingUser = await prisma.user.findUnique({ where: { email: data.ownerEmail } });
  if (existingUser) throw new AppError("Owner email already registered", "EMAIL_EXISTS", 400);

  const plan = await prisma.plan.findUnique({ where: { slug: data.planSlug } });
  if (!plan) throw new AppError("Plan not found", "PLAN_NOT_FOUND", 404);

  const tempPassword = randomBytes(9).toString("base64url");
  const passwordHash = await hashPassword(tempPassword);

  const restaurant = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.ownerName,
        email: data.ownerEmail,
        emailVerified: true,
        mustChangePassword: true,
      },
    });

    await tx.account.create({
      data: {
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: passwordHash,
      },
    });

    const r = await tx.restaurant.create({
      data: {
        name: data.name,
        slug: slugify(data.name) + "-" + Date.now().toString(36),
        subdomain: data.subdomain,
        ownerTempPassword: tempPassword,
      },
    });

    await tx.restaurantSettings.create({ data: { restaurantId: r.id } });
    await tx.restaurantBranding.create({
      data: {
        restaurantId: r.id,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country ?? "IN",
        phone: data.ownerPhone,
        email: data.ownerEmail,
      },
    });

    await tx.staff.create({
      data: {
        userId: user.id,
        restaurantId: r.id,
        role: "OWNER",
        displayName: data.ownerName,
        mobile: data.ownerPhone,
      },
    });

    return r;
  });

  const { startTrial } = await import("@/lib/subscription");
  await startTrial(restaurant.id, plan.id);

  return { restaurant, tempPassword };
}

/** Returns true if the subdomain is available (not already taken). */
export async function isSubdomainAvailable(subdomain: string): Promise<boolean> {
  const existing = await prisma.restaurant.findUnique({
    where: { subdomain },
    select: { id: true },
  });
  return !existing;
}
