/** Edge-safe tenant host key helpers (no database imports). */

export function toTenantHostKey(uuid: string): string {
  return uuid.replace(/-/g, "").slice(0, 8).toLowerCase();
}
