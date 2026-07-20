import { prisma } from "@/lib/db";
import {
  mapPrismaProductToConfigurable,
  PRODUCT_CONFIG_INCLUDE,
} from "@/features/product-config/map-product";
import type {
  MenuCatalogMode,
  MenuCategoryShell,
  MenuProductCard,
  MenuProductConfig,
} from "./types";
import { resolveMenuCardDisplayPrice } from "./display-price";

function variantWhere(mode: MenuCatalogMode) {
  return mode === "public"
    ? { isActive: true as const, isAvailable: true as const }
    : { isActive: true as const };
}

function modifierWhere(mode: MenuCatalogMode) {
  return mode === "public"
    ? { isActive: true as const, isAvailable: true as const }
    : { isActive: true as const };
}

export async function listMenuCategories(restaurantId: string): Promise<MenuCategoryShell[]> {
  return prisma.category.findMany({
    where: { restaurantId, isActive: true, isHidden: false },
    select: { id: true, name: true, description: true },
    orderBy: { sortOrder: "asc" },
  });
}

type CardRow = {
  id: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  price: number;
  discountPrice: number | null;
  dietaryType: string;
  spicyLevel: number;
  isOutOfStock: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  isChefSpecial: boolean;
  calories: number | null;
  allergens: string[];
  images: Array<{ media: { url: string } }>;
  variantGroups: Array<{ variants: Array<{ price: number }> }>;
  variants: Array<{ price: number }>;
  _count: {
    variantGroups: number;
    variants: number;
    modifierGroups: number;
  };
};

function mapCardRow(product: CardRow): MenuProductCard {
  const groupedPrices = product.variantGroups.flatMap((g) => g.variants.map((v) => v.price));
  const flatPrices = product.variants.map((v) => v.price);
  // Modifiers/add-ons are intentionally excluded from card display pricing.
  const { amount: displayFromPrice, showFrom: showFromPrice } = resolveMenuCardDisplayPrice({
    basePrice: product.price,
    variantPrices: [...groupedPrices, ...flatPrices],
  });

  const hasVariants =
    product._count.variantGroups > 0 ||
    product._count.variants > 0 ||
    groupedPrices.length > 0 ||
    flatPrices.length > 0;
  const hasModifiers = product._count.modifierGroups > 0;

  return {
    id: product.id,
    name: product.name,
    shortDescription: product.shortDescription,
    description: product.description,
    price: product.price,
    discountPrice: product.discountPrice,
    dietaryType: product.dietaryType,
    spicyLevel: product.spicyLevel,
    isOutOfStock: product.isOutOfStock,
    isFeatured: product.isFeatured,
    isBestSeller: product.isBestSeller,
    isChefSpecial: product.isChefSpecial,
    calories: product.calories,
    allergens: product.allergens,
    images: product.images.map((image) => ({ media: { url: image.media.url } })),
    displayFromPrice,
    showFromPrice,
    hasVariants,
    hasModifiers,
    hasAddOns: hasModifiers,
  };
}

const cardSelect = (mode: MenuCatalogMode) => {
  const vWhere = variantWhere(mode);
  return {
    id: true,
    name: true,
    shortDescription: true,
    description: true,
    price: true,
    discountPrice: true,
    dietaryType: true,
    spicyLevel: true,
    isOutOfStock: true,
    isFeatured: true,
    isBestSeller: true,
    isChefSpecial: true,
    calories: true,
    allergens: true,
    images: {
      orderBy: { sortOrder: "asc" as const },
      take: 1,
      select: { media: { select: { url: true } } },
    },
    // Prices only — enough for displayFromPrice, not the config tree
    variantGroups: {
      select: {
        variants: {
          where: vWhere,
          select: { price: true },
        },
      },
    },
    variants: {
      where: vWhere,
      select: { price: true },
    },
    _count: {
      select: {
        variantGroups: true,
        variants: { where: vWhere },
        modifierGroups: true,
      },
    },
  };
};

export async function listCategoryProductCards(
  restaurantId: string,
  categoryId: string,
  mode: MenuCatalogMode
): Promise<MenuProductCard[]> {
  const category = await prisma.category.findFirst({
    where: {
      id: categoryId,
      restaurantId,
      isActive: true,
      isHidden: false,
    },
    select: { id: true },
  });
  if (!category) return [];

  const products = await prisma.product.findMany({
    where: {
      categoryId,
      restaurantId,
      isAvailable: true,
      isHidden: false,
    },
    select: cardSelect(mode),
    orderBy: [{ sortOrder: "asc" }, { displayPriority: "desc" }],
  });

  return products.map((p) => mapCardRow(p as unknown as CardRow));
}

export async function searchMenuProductCards(
  restaurantId: string,
  query: string,
  mode: MenuCatalogMode,
  take = 20
): Promise<MenuProductCard[]> {
  const q = query.trim();
  if (!q) return [];

  const products = await prisma.product.findMany({
    where: {
      restaurantId,
      isAvailable: true,
      isHidden: false,
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { shortDescription: { contains: q, mode: "insensitive" } },
        { searchKeywords: { has: q.toLowerCase() } },
      ],
    },
    select: cardSelect(mode),
    take,
    orderBy: [{ sortOrder: "asc" }, { displayPriority: "desc" }],
  });

  return products.map((p) => mapCardRow(p as unknown as CardRow));
}

export async function getProductConfig(
  restaurantId: string,
  productId: string,
  mode: MenuCatalogMode
): Promise<MenuProductConfig | null> {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      restaurantId,
      isAvailable: true,
      ...(mode === "public" ? { isHidden: false } : {}),
    },
    include: PRODUCT_CONFIG_INCLUDE,
  });
  if (!product) return null;

  // Public mode: drop unavailable variants/modifiers that staff include may still return
  if (mode === "public") {
    const filtered = {
      ...product,
      variantGroups: product.variantGroups.map((g) => ({
        ...g,
        variants: g.variants.filter((v) => v.isAvailable !== false),
      })),
      variants: product.variants.filter((v) => v.isAvailable !== false),
      modifierGroups: product.modifierGroups.map((mg) => ({
        ...mg,
        group: {
          ...mg.group,
          modifiers: mg.group.modifiers.filter((m) => m.isAvailable !== false),
        },
      })),
    };
    return mapPrismaProductToConfigurable(filtered);
  }

  return mapPrismaProductToConfigurable(product);
}

/** Prefetch first category cards for SSR first paint. */
export async function listCategoriesWithOptionalFirstProducts(
  restaurantId: string,
  mode: MenuCatalogMode,
  options?: { prefetchFirstCategory?: boolean }
): Promise<Array<MenuCategoryShell & { products: MenuProductCard[] }>> {
  const categories = await listMenuCategories(restaurantId);
  if (!options?.prefetchFirstCategory || categories.length === 0) {
    return categories.map((c) => ({ ...c, products: [] }));
  }

  const [first, ...rest] = categories;
  const firstProducts = await listCategoryProductCards(restaurantId, first.id, mode);
  return [
    { ...first, products: firstProducts },
    ...rest.map((c) => ({ ...c, products: [] as MenuProductCard[] })),
  ];
}
