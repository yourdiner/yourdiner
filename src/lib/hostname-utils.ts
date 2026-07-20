/** Shared hostname helpers for custom domains (Edge-safe — no DB). */

export function normalizeHostname(host: string): string {
  return host.split(":")[0].trim().toLowerCase().replace(/^www\./, "");
}

export function isLikelyCustomHostname(
  hostname: string,
  rootHost: string
): boolean {
  if (!hostname || !hostname.includes(".")) return false;
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return false;
  if (hostname === rootHost || hostname === `admin.${rootHost}`) return false;
  if (hostname.endsWith(`.${rootHost}`)) return false;
  return true;
}
