"use server";

import { headers } from "next/headers";
import { hashPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  requireSession,
  buildTenantUrl,
  buildRestaurantUrl,
} from "@/lib/tenancy";
import {
  parseHostname,
  buildPlatformUrl,
  buildLocalPlatformUrl,
  isPlatformHostname,
} from "@/lib/hostname";
import { AppError } from "@/lib/errors";
import { changePasswordSchema, registerSchema } from "@/features/auth/schemas";
import { slugify } from "@/lib/utils";
import { toTenantHostKey } from "@/lib/tenancy-keys";
import { adminStaffRoleFilter } from "@/lib/prisma-filters";
import { startTrial } from "@/lib/subscription";

export async function registerOwner(input: unknown) {
  const data = registerSchema.parse(input);

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new AppError("Email already registered", "EMAIL_EXISTS", 400);
  }

  const slug = slugify(data.restaurantName);
  const tempSubdomain = `pending-${Date.now().toString(36)}`;
  const starterPlan = await prisma.plan.findUnique({ where: { slug: "starter" } });
  if (!starterPlan) {
    throw new AppError("System not configured", "PLAN_NOT_FOUND", 500);
  }

  const passwordHash = await hashPassword(data.password);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: data.name,
        email: data.email,
        emailVerified: true,
        mustChangePassword: false,
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

    const restaurant = await tx.restaurant.create({
      data: {
        name: data.restaurantName,
        slug: `${slug}-${Date.now().toString(36)}`,
        subdomain: tempSubdomain,
      },
    });

    const tenantKey = toTenantHostKey(restaurant.uuid);
    const updatedRestaurant = await tx.restaurant.update({
      where: { id: restaurant.id },
      data: { subdomain: tenantKey },
    });

    await tx.restaurantSettings.create({
      data: { restaurantId: restaurant.id },
    });

    await tx.restaurantBranding.create({
      data: { restaurantId: restaurant.id },
    });

    await tx.staff.create({
      data: {
        userId: user.id,
        restaurantId: restaurant.id,
        role: "OWNER",
        displayName: data.name,
      },
    });

    await tx.activityLog.create({
      data: {
        restaurantId: restaurant.id,
        userId: user.id,
        action: "CREATE",
        entity: "restaurant",
        entityId: restaurant.id,
      },
    });

    return { restaurant: updatedRestaurant, user };
  });

  await startTrial(result.restaurant.id, starterPlan.id);

  return {
    redirectUrl: buildTenantUrl(toTenantHostKey(result.restaurant.uuid), "/admin"),
  };
}

export async function completeForcedPasswordChange(input: unknown) {
  const session = await requireSession();
  const data = changePasswordSchema.parse(input);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, mustChangePassword: true },
  });

  if (!user) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }

  if (!user.mustChangePassword) {
    throw new AppError("Password change is not required", "FORBIDDEN", 403);
  }

  const passwordHash = await hashPassword(data.newPassword);

  await prisma.$transaction([
    prisma.account.updateMany({
      where: { userId: user.id, providerId: "credential" },
      data: { password: passwordHash },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: false },
    }),
  ]);

  revalidatePath("/admin");
  return { success: true };
}

export async function getMustChangePassword(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mustChangePassword: true },
  });
  return user?.mustChangePassword ?? false;
}

export async function checkCurrentUserMustChangePassword(): Promise<boolean> {
  const session = await requireSession();
  return getMustChangePassword(session.user.id);
}

/** Resolves where to send the user after a successful login (full URL or same-origin path). */
export async function getPostLoginRedirectUrl(): Promise<string> {
  const session = await requireSession();
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const parsed = parseHostname(host);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { platformRole: true },
  });

  if (user?.platformRole === "SUPER_ADMIN") {
    const hostname = host.split(":")[0];
    if (isPlatformHostname(hostname)) {
      return "/";
    }
    if (host.includes("localhost")) {
      return buildLocalPlatformUrl("/");
    }
    return buildPlatformUrl("/");
  }

  if (parsed.type === "tenant" || parsed.type === "custom") {
    return "/admin";
  }

  const staff = await prisma.staff.findFirst({
    where: {
      userId: session.user.id,
      ...adminStaffRoleFilter(),
      isActive: true,
      restaurant: { status: { not: "DELETED" } },
    },
    include: {
      restaurant: {
        select: {
          subdomain: true,
          uuid: true,
          customDomain: true,
          customDomainStatus: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (staff?.restaurant) {
    return buildRestaurantUrl(
      {
        tenantKey: staff.restaurant.subdomain || toTenantHostKey(staff.restaurant.uuid),
        customDomain: staff.restaurant.customDomain,
        customDomainStatus: staff.restaurant.customDomainStatus,
      },
      "/admin"
    );
  }

  return "/admin";
}
