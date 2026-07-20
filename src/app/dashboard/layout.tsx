import type { Metadata } from "next";
import { requireTenantPageContext } from "@/lib/tenancy";
import { getTenantBrandingMetadata } from "@/lib/tenant-branding";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const tenant = await requireTenantPageContext({ skipPreferredHostRedirect: true });
    return getTenantBrandingMetadata(tenant.restaurantId, tenant.name);
  } catch {
    return { title: "Admin" };
  }
}

export { default } from "./layout-shell";
