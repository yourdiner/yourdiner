import {
  isLikelyCustomHostname,
  normalizeHostname,
} from "@/lib/hostname-utils";

export function getRootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
}

export function parseHostname(host: string): {
  type: "platform" | "tenant" | "custom" | "root";
  tenantKey?: string;
  hostname?: string;
} {
  const rootDomain = getRootDomain();
  const hostname = normalizeHostname(host);
  const rootHost = normalizeHostname(rootDomain);

  if (hostname === "localhost" || hostname === rootHost) {
    return { type: "root" };
  }

  if (hostname === `admin.${rootHost}` || hostname === "admin.localhost") {
    return { type: "platform" };
  }

  if (hostname.endsWith(`.${rootHost}`) || hostname.endsWith(".localhost")) {
    const tenantKey = hostname
      .replace(`.${rootHost}`, "")
      .replace(".localhost", "")
      .toLowerCase();
    if (tenantKey && tenantKey !== "www" && tenantKey !== "admin") {
      return { type: "tenant", tenantKey };
    }
  }

  if (isLikelyCustomHostname(hostname, rootHost)) {
    return { type: "custom", hostname };
  }

  return { type: "root" };
}

export function buildTenantUrl(tenantKey: string, path = ""): string {
  const rootDomain = getRootDomain();
  const protocol = rootDomain.includes("localhost") ? "http" : "https";
  const isLocal = rootDomain.includes("localhost");
  const host = isLocal
    ? `${tenantKey}.localhost:3000`
    : `${tenantKey}.${rootDomain}`;
  return `${protocol}://${host}${path}`;
}

/** Prefer active custom domain; otherwise platform subdomain. */
export function buildRestaurantUrl(
  restaurant: {
    tenantKey: string;
    customDomain?: string | null;
    customDomainStatus?: string | null;
  },
  path = ""
): string {
  const domain = restaurant.customDomain?.trim().toLowerCase();
  if (domain && restaurant.customDomainStatus === "ACTIVE") {
    const protocol = getRootDomain().includes("localhost") ? "http" : "https";
    const host = domain.includes("localhost")
      ? `${domain}${domain.includes(":") ? "" : ":3000"}`
      : domain;
    return `${protocol}://${host}${path}`;
  }
  return buildTenantUrl(restaurant.tenantKey, path);
}

export function buildPlatformUrl(path = ""): string {
  const rootDomain = getRootDomain();
  const protocol = rootDomain.includes("localhost") ? "http" : "https";
  const isLocal = rootDomain.includes("localhost");
  const host = isLocal ? `admin.localhost:3000` : `admin.${rootDomain}`;
  return `${protocol}://${host}${path}`;
}

/** Local dev: keep platform admin on the same origin so auth cookies work. */
export function buildLocalPlatformUrl(path = ""): string {
  const rootDomain = getRootDomain();
  const protocol = rootDomain.includes("localhost") ? "http" : "https";
  if (rootDomain.includes("localhost")) {
    const base = `${protocol}://${rootDomain.split(":")[0]}:3000`;
    const suffix = path === "/" ? "" : path;
    return `${base}/platform${suffix}`;
  }
  return buildPlatformUrl(path);
}

export function isPlatformHostname(hostname: string): boolean {
  const rootHost = normalizeHostname(getRootDomain());
  const host = normalizeHostname(hostname);
  return host === `admin.${rootHost}` || host === "admin.localhost";
}
