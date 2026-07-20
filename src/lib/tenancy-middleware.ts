/** Server-only tenant resolution. Client code must use `@/lib/tenancy-keys` for host keys. */
export {
  resolveTenantByHostLabel,
  resolveTenantBySubdomain,
  resolveTenantByCustomDomain,
} from "@/lib/tenant-resolution";
