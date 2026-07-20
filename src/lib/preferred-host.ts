import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CustomDomainStatus } from "@prisma/client";
import { buildRestaurantUrl, parseHostname } from "@/lib/hostname";
import type { TenantContext } from "@/lib/tenancy-types";

export function preferredHostRedirectUrl(
  tenant: TenantContext,
  pathname: string,
  search = ""
): string | null {
  const domain = tenant.customDomain?.trim().toLowerCase();
  if (!domain || tenant.customDomainStatus !== CustomDomainStatus.ACTIVE) {
    return null;
  }

  return buildRestaurantUrl(
    {
      tenantKey: tenant.tenantKey,
      customDomain: tenant.customDomain,
      customDomainStatus: tenant.customDomainStatus,
    },
    `${pathname}${search}`
  );
}

/** Redirect platform-subdomain HTML navigations to the ACTIVE custom domain. */
export async function maybeRedirectTenantToCustomDomain(
  tenant: TenantContext,
  pathname: string,
  search = ""
) {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const parsed = parseHostname(host);

  if (parsed.type !== "tenant") return;

  const target = preferredHostRedirectUrl(tenant, pathname, search);
  if (!target) return;

  redirect(target);
}
