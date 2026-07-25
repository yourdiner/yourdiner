type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

const store = new Map<string, CacheEntry>();

const DEFAULT_TTL_MS = 30_000;

export function getPromoCache<T>(key: string): T | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return null;
  }
  return hit.value as T;
}

export function setPromoCache<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidateRestaurantPromoCache(restaurantId: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(`promos:${restaurantId}:`)) {
      store.delete(key);
    }
  }
}
