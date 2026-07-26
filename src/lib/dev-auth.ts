import "server-only";

import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db";
import { buildPlatformUrl, buildLocalPlatformUrl, buildTenantUrl } from "@/lib/hostname";
import { toTenantHostKey } from "@/lib/tenancy-keys";
import { DEV_SEED_PASSWORD } from "@/lib/dev-auth-constants";

export { DEV_SEED_PASSWORD };

export function isDevAuthEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.NODE_ENV === "development" || process.env.ENABLE_DEV_LOGIN === "true"
  );
}

/** Better Auth uses scrypt hashes formatted as `salt:hex`. Legacy bcrypt uses `$2...`. */
function isBetterAuthPasswordHash(hash: string | null | undefined): boolean {
  if (!hash || hash.startsWith("$2")) return false;
  const [salt, key] = hash.split(":");
  return Boolean(salt && key);
}

/** Ensures the user has a credential account with a Better Auth–compatible password hash. */
export async function ensureDevCredentialAccount(userId: string): Promise<void> {
  const passwordHash = await hashPassword(DEV_SEED_PASSWORD);
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  });

  if (!account) {
    await prisma.account.create({
      data: {
        accountId: userId,
        providerId: "credential",
        userId,
        password: passwordHash,
      },
    });
    return;
  }

  if (!isBetterAuthPasswordHash(account.password)) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password: passwordHash },
    });
  }
}

export type DevUserRole =
  | "SUPER_ADMIN"
  | "OWNER"
  | "MANAGER"
  | "STAFF"
  | "KITCHEN"
  | "CASHIER"
  | "CUSTOMER";

export type DevUser = {
  id: string;
  label: string;
  email: string;
  role: DevUserRole;
  /** Full dashboard URL on the correct host (tenant subdomain or platform). */
  redirectUrl: string;
  /** One-click login URL — always on the same origin as redirectUrl. */
  loginUrl: string;
  tenantHost?: string;
  description?: string;
};

/** Dev login on the target host so session cookies bind to the tenant/platform origin. */
export function buildDevLoginUrl(
  redirectUrl: string,
  email: string,
  role?: DevUserRole
): string {
  if (role === "CUSTOMER") return redirectUrl;

  const target = new URL(redirectUrl);
  const login = new URL("/api/dev/impersonate", target.origin);
  login.searchParams.set("email", email);
  if (role) login.searchParams.set("role", role);
  login.searchParams.set("redirect", `${target.pathname}${target.search}`);
  return login.toString();
}

function tenantHostFromUrl(url: string): string | undefined {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
}

export async function getDevUsers(): Promise<DevUser[]> {
  if (!isDevAuthEnabled()) return [];

  const demoRestaurant = await prisma.restaurant.findFirst({
    where: { slug: "demo-cafe" },
    include: {
      staff: {
        include: { user: true },
      },
      tables: {
        where: { isActive: true },
        take: 1,
      },
    },
  });

  const users: DevUser[] = [];

  const superAdmin = await prisma.user.findFirst({
    where: { platformRole: "SUPER_ADMIN" },
  });

  if (superAdmin) {
    const redirectUrl = buildLocalPlatformUrl("/");
    users.push({
      id: superAdmin.id,
      label: "Super Admin",
      email: superAdmin.email,
      role: "SUPER_ADMIN",
      redirectUrl,
      loginUrl: buildDevLoginUrl(redirectUrl, superAdmin.email, "SUPER_ADMIN"),
      tenantHost: tenantHostFromUrl(redirectUrl),
      description: "Platform administration",
    });
  }

  if (!demoRestaurant) return users;

  const hostKey = demoRestaurant.subdomain || toTenantHostKey(demoRestaurant.uuid);

  const roleLabels: Record<string, string> = {
    OWNER: "Restaurant Owner",
    MANAGER: "Manager",
    STAFF: "Waiter",
    KITCHEN: "Kitchen Staff",
    CASHIER: "Cashier",
  };

  const staffOrder = ["OWNER", "MANAGER", "STAFF", "KITCHEN", "CASHIER"] as const;
  let waiterCount = 0;

  for (const role of staffOrder) {
    const members = demoRestaurant.staff.filter((s) => s.role === role);
    for (const member of members) {
      let label = roleLabels[role] || role;
      if (role === "STAFF") {
        waiterCount++;
        label = `Waiter ${waiterCount}`;
      }

      const dashboardPath =
        role === "OWNER" || role === "MANAGER" ? "/admin" : "/staff/login";

      const redirectUrl = buildTenantUrl(hostKey, dashboardPath);

      if (role === "STAFF" || role === "CASHIER" || role === "KITCHEN") {
        users.push({
          id: member.id,
          label,
          email: member.mobile ?? member.user?.email ?? "staff",
          role: role as DevUserRole,
          redirectUrl,
          loginUrl: redirectUrl,
          tenantHost: tenantHostFromUrl(redirectUrl),
          description: `${member.displayName} · password Staff@1234`,
        });
        continue;
      }

      if (!member.user) continue;

      users.push({
        id: member.user.id,
        label,
        email: member.user.email,
        role: role as DevUserRole,
        redirectUrl,
        loginUrl: buildDevLoginUrl(redirectUrl, member.user.email, role as DevUserRole),
        tenantHost: tenantHostFromUrl(redirectUrl),
        description: member.user.name,
      });
    }
  }

  const demoTable = demoRestaurant.tables[0];
  const qrSlug = demoTable?.qrSlug || (demoTable ? `T${demoTable.number}` : null);

  if (qrSlug) {
    const redirectUrl = buildTenantUrl(hostKey, `/customer/table/${qrSlug}`);
    users.push({
      id: "customer-demo",
      label: "Customer",
      email: "customer@table.demo",
      role: "CUSTOMER",
      redirectUrl,
      loginUrl: redirectUrl,
      tenantHost: tenantHostFromUrl(redirectUrl),
      description: "Static table QR ordering",
    });
  }

  return users;
}
