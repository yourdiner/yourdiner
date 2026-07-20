import { unstable_cache } from "next/cache";
import {
  listCategoryProductCards,
  listCategoriesWithOptionalFirstProducts,
  getProductConfig,
  searchMenuProductCards,
} from "./queries";
import type { MenuCatalogMode, MenuProductCard, MenuProductConfig } from "./types";
import {
  MENU_CACHE_SECONDS,
  publicMenuCacheTag,
  publicCategoryProductsCacheTag,
} from "./tags";

export function getCachedCategoryProductCards(
  restaurantId: string,
  categoryId: string,
  mode: MenuCatalogMode = "public"
) {
  if (mode !== "public") {
    return listCategoryProductCards(restaurantId, categoryId, mode);
  }
  return unstable_cache(
    () => listCategoryProductCards(restaurantId, categoryId, "public"),
    ["public-menu-category-products", restaurantId, categoryId],
    {
      revalidate: MENU_CACHE_SECONDS,
      tags: [publicMenuCacheTag(restaurantId), publicCategoryProductsCacheTag(restaurantId, categoryId)],
    }
  )();
}

export function getCachedCategoriesWithFirstProducts(restaurantId: string) {
  return unstable_cache(
    () =>
      listCategoriesWithOptionalFirstProducts(restaurantId, "public", {
        prefetchFirstCategory: true,
      }),
    ["public-menu-categories-first", restaurantId],
    { revalidate: MENU_CACHE_SECONDS, tags: [publicMenuCacheTag(restaurantId)] }
  )();
}

export async function getCachedOrFreshProductConfig(
  restaurantId: string,
  productId: string,
  mode: MenuCatalogMode
): Promise<MenuProductConfig | null> {
  if (mode !== "public") {
    return getProductConfig(restaurantId, productId, mode);
  }
  return unstable_cache(
    () => getProductConfig(restaurantId, productId, "public"),
    ["public-menu-product-config", restaurantId, productId],
    { revalidate: MENU_CACHE_SECONDS, tags: [publicMenuCacheTag(restaurantId)] }
  )();
}

export async function searchCachedPublicMenuCards(
  restaurantId: string,
  query: string
): Promise<MenuProductCard[]> {
  return searchMenuProductCards(restaurantId, query, "public");
}
