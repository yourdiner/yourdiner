"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MenuProductCard } from "@/lib/menu-catalog/types";
import type { ConfigurableProduct } from "@/features/product-config";

export type ProgressiveMenuFetchers = {
  fetchCategoryProducts: (categoryId: string) => Promise<MenuProductCard[]>;
  fetchProductConfig: (productId: string) => Promise<ConfigurableProduct | null>;
  searchProducts?: (query: string) => Promise<MenuProductCard[]>;
};

type CategoryShell = { id: string; products?: MenuProductCard[] };

type Options = {
  categories: CategoryShell[];
  fetchers: ProgressiveMenuFetchers;
  /** When true, auto-load the first category on mount if not already prefetched. */
  prefetchFirst?: boolean;
};

export function useProgressiveMenu({
  categories,
  fetchers,
  prefetchFirst = true,
}: Options) {
  const [productsByCategory, setProductsByCategory] = useState<
    Record<string, MenuProductCard[]>
  >(() => {
    const initial: Record<string, MenuProductCard[]> = {};
    for (const cat of categories) {
      if (cat.products && cat.products.length > 0) {
        initial[cat.id] = cat.products;
      }
    }
    return initial;
  });

  const [configByProductId, setConfigByProductId] = useState<
    Record<string, ConfigurableProduct>
  >({});

  const [loadingCategories, setLoadingCategories] = useState<Set<string>>(new Set());
  const [loadingConfigs, setLoadingConfigs] = useState<Set<string>>(new Set());

  const categoryInflight = useRef<Map<string, Promise<MenuProductCard[]>>>(new Map());
  const configInflight = useRef<Map<string, Promise<ConfigurableProduct | null>>>(new Map());
  const productsByCategoryRef = useRef(productsByCategory);
  const configByProductIdRef = useRef(configByProductId);

  useEffect(() => {
    productsByCategoryRef.current = productsByCategory;
  }, [productsByCategory]);

  useEffect(() => {
    configByProductIdRef.current = configByProductId;
  }, [configByProductId]);

  const fetchersRef = useRef(fetchers);
  fetchersRef.current = fetchers;

  const ensureCategoryProducts = useCallback(async (categoryId: string) => {
    if (!categoryId) return [];
    if (productsByCategoryRef.current[categoryId]) {
      return productsByCategoryRef.current[categoryId];
    }

    const existing = categoryInflight.current.get(categoryId);
    if (existing) return existing;

    setLoadingCategories((prev) => new Set(prev).add(categoryId));

    const promise = fetchersRef.current
      .fetchCategoryProducts(categoryId)
      .then((products) => {
        setProductsByCategory((prev) => {
          if (prev[categoryId]) return prev;
          return { ...prev, [categoryId]: products };
        });
        return products;
      })
      .finally(() => {
        categoryInflight.current.delete(categoryId);
        setLoadingCategories((prev) => {
          const next = new Set(prev);
          next.delete(categoryId);
          return next;
        });
      });

    categoryInflight.current.set(categoryId, promise);
    return promise;
  }, []);

  const ensureProductConfig = useCallback(async (productId: string) => {
    if (!productId) return null;
    if (configByProductIdRef.current[productId]) {
      return configByProductIdRef.current[productId];
    }

    const existing = configInflight.current.get(productId);
    if (existing) return existing;

    setLoadingConfigs((prev) => new Set(prev).add(productId));

    const promise = fetchersRef.current
      .fetchProductConfig(productId)
      .then((config) => {
        if (config) {
          setConfigByProductId((prev) => {
            if (prev[productId]) return prev;
            return { ...prev, [productId]: config };
          });
        }
        return config;
      })
      .finally(() => {
        configInflight.current.delete(productId);
        setLoadingConfigs((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      });

    configInflight.current.set(productId, promise);
    return promise;
  }, []);

  useEffect(() => {
    if (!prefetchFirst) return;
    const firstId = categories[0]?.id;
    if (firstId) {
      void ensureCategoryProducts(firstId);
    }
    // Only on mount / first category id change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories[0]?.id, prefetchFirst, ensureCategoryProducts]);

  return {
    productsByCategory,
    configByProductId,
    loadingCategories,
    loadingConfigs,
    ensureCategoryProducts,
    ensureProductConfig,
    isCategoryLoading: (categoryId: string) => loadingCategories.has(categoryId),
    isConfigLoading: (productId: string) => loadingConfigs.has(productId),
    getCategoryProducts: (categoryId: string) => productsByCategory[categoryId] ?? [],
  };
}
