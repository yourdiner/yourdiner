/** Edge-safe hostname parsing for middleware (no Node/database imports). */

import {
  isLikelyCustomHostname,
  normalizeHostname,
} from "@/lib/hostname-utils";

export function parseMiddlewareHostname(host: string): {
  type: "platform" | "tenant" | "custom" | "root";
  tenantKey?: string;
  hostname?: string;
} {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost:3000";
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
