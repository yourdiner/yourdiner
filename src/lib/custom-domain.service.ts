import { promises as dns } from "dns";
import { CustomDomainStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getErrorMessage } from "@/lib/errors";
import { normalizeHostname } from "@/lib/hostname-utils";
import { getRootDomain } from "@/lib/hostname";
import { requireTenantContext, requireRestaurantStaff } from "@/lib/tenancy";
import { revalidatePath } from "next/cache";

export type ServiceResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

function isValidCustomDomain(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain)) {
    return false;
  }
  const rootHost = normalizeHostname(getRootDomain());
  if (domain === rootHost || domain.endsWith(`.${rootHost}`)) {
    return false;
  }
  if (domain.endsWith(".localhost") || domain === "localhost") {
    return false;
  }
  return true;
}

export async function saveCustomDomainService(
  domainInput: string
): Promise<ServiceResult<{ customDomain: string; customDomainStatus: CustomDomainStatus }>> {
  try {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

    const customDomain = normalizeHostname(domainInput);
    if (!isValidCustomDomain(customDomain)) {
      return {
        ok: false,
        error:
          "Enter a valid domain like homecafe.in (not your platform subdomain).",
      };
    }

    const taken = await prisma.restaurant.findFirst({
      where: {
        customDomain,
        NOT: { id: tenant.restaurantId },
      },
      select: { id: true },
    });
    if (taken) {
      return { ok: false, error: "This domain is already linked to another restaurant" };
    }

    const updated = await prisma.restaurant.update({
      where: { id: tenant.restaurantId },
      data: {
        customDomain,
        customDomainStatus: CustomDomainStatus.PENDING,
      },
      select: { customDomain: true, customDomainStatus: true },
    });

    invalidateCustomDomainOriginsCache();
    revalidatePath("/admin/settings");
    revalidatePath("/dashboard/settings");
    return {
      ok: true,
      data: {
        customDomain: updated.customDomain!,
        customDomainStatus: updated.customDomainStatus,
      },
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

export async function clearCustomDomainService(): Promise<ServiceResult> {
  try {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

    await prisma.restaurant.update({
      where: { id: tenant.restaurantId },
      data: {
        customDomain: null,
        customDomainStatus: CustomDomainStatus.NONE,
      },
    });

    invalidateCustomDomainOriginsCache();
    revalidatePath("/admin/settings");
    revalidatePath("/dashboard/settings");
    return { ok: true, data: undefined };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

async function domainPointsHere(domain: string): Promise<{ ok: boolean; detail: string }> {
  const expectedIp = process.env.CUSTOM_DOMAIN_EXPECTED_IP?.trim();

  try {
    const result = await dns.lookup(domain, { all: true });
    const ips = result.map((r) => r.address);
    if (ips.length === 0) {
      return { ok: false, detail: "Domain did not resolve to any IP address" };
    }

    if (expectedIp) {
      if (!ips.includes(expectedIp)) {
        return {
          ok: false,
          detail: `DNS resolves to ${ips.join(", ")} but expected ${expectedIp}. Point A/CNAME to your VPS first.`,
        };
      }
      return { ok: true, detail: `DNS points to ${expectedIp}` };
    }

    // No expected IP configured — accept any successful resolve (owner confirms Nginx/SSL).
    return { ok: true, detail: `DNS resolves to ${ips.join(", ")}` };
  } catch {
    return {
      ok: false,
      detail: "Could not resolve DNS. Add an A/CNAME record to your VPS and wait for propagation.",
    };
  }
}

export async function verifyCustomDomainService(): Promise<
  ServiceResult<{ customDomain: string; customDomainStatus: CustomDomainStatus; detail: string }>
> {
  try {
    const tenant = await requireTenantContext();
    await requireRestaurantStaff(tenant.restaurantId, ["OWNER", "MANAGER"]);

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: tenant.restaurantId },
      select: { customDomain: true, customDomainStatus: true },
    });

    if (!restaurant?.customDomain) {
      return { ok: false, error: "Save a custom domain first" };
    }

    const check = await domainPointsHere(restaurant.customDomain);
    if (!check.ok) {
      await prisma.restaurant.update({
        where: { id: tenant.restaurantId },
        data: { customDomainStatus: CustomDomainStatus.PENDING },
      });
      return { ok: false, error: check.detail };
    }

    const updated = await prisma.restaurant.update({
      where: { id: tenant.restaurantId },
      data: { customDomainStatus: CustomDomainStatus.ACTIVE },
      select: { customDomain: true, customDomainStatus: true },
    });

    invalidateCustomDomainOriginsCache();
    revalidatePath("/admin/settings");
    revalidatePath("/dashboard/settings");
    return {
      ok: true,
      data: {
        customDomain: updated.customDomain!,
        customDomainStatus: updated.customDomainStatus,
        detail: check.detail,
      },
    };
  } catch (error) {
    return { ok: false, error: getErrorMessage(error) };
  }
}

/** Active custom domain origins for auth trustedOrigins (cached briefly). */
let cachedOrigins: { at: number; origins: string[] } | null = null;

export function invalidateCustomDomainOriginsCache() {
  cachedOrigins = null;
}

export async function listActiveCustomDomainOrigins(): Promise<string[]> {
  const now = Date.now();
  if (cachedOrigins && now - cachedOrigins.at < 60_000) {
    return cachedOrigins.origins;
  }

  const rows = await prisma.restaurant.findMany({
    where: {
      customDomainStatus: CustomDomainStatus.ACTIVE,
      customDomain: { not: null },
      status: { not: "DELETED" },
    },
    select: { customDomain: true },
    take: 500,
  });

  const origins = rows.flatMap((r) => {
    const host = r.customDomain;
    if (!host) return [];
    return [`https://${host}`, `http://${host}`];
  });

  cachedOrigins = { at: now, origins };
  return origins;
}
