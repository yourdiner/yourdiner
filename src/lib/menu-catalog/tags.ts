export const MENU_CACHE_SECONDS = 900;

export function publicMenuCacheTag(restaurantId: string) {
  return `public-menu-${restaurantId}`;
}

export function publicBrandingCacheTag(restaurantId: string) {
  return `public-branding-${restaurantId}`;
}

export function publicCategoryProductsCacheTag(restaurantId: string, categoryId: string) {
  return `public-menu-cat-${restaurantId}-${categoryId}`;
}
