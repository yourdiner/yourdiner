import type { ConfigurableProduct } from "./types";

type PrismaVariant = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  isAvailable?: boolean;
  sku?: string | null;
  prepTimeMinutes?: number | null;
  sortOrder?: number;
};

type PrismaVariantGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  variants: PrismaVariant[];
};

type PrismaModifier = {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  isAvailable?: boolean;
  sortOrder?: number;
};

type PrismaModifierGroup = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  sortOrder: number;
  isActive?: boolean;
  modifiers: PrismaModifier[];
};

export type PrismaProductWithConfig = {
  id: string;
  name: string;
  price: number;
  categoryId?: string;
  description?: string | null;
  shortDescription?: string | null;
  isOutOfStock?: boolean;
  variantGroups?: PrismaVariantGroup[];
  variants?: PrismaVariant[];
  modifierGroups?: Array<{ group: PrismaModifierGroup }>;
  images?: Array<{ media: { url: string } }>;
};

export function mapPrismaProductToConfigurable(
  product: PrismaProductWithConfig
): ConfigurableProduct {
  const variantGroups =
    product.variantGroups?.map((g) => ({
      id: g.id,
      name: g.name,
      isRequired: g.isRequired,
      sortOrder: g.sortOrder,
      variants: g.variants
        .filter((v) => v.isActive)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((v) => ({
          id: v.id,
          name: v.name,
          price: v.price,
          isActive: v.isActive,
          isAvailable: v.isAvailable ?? true,
          sku: v.sku,
          prepTimeMinutes: v.prepTimeMinutes,
        })),
    })) ?? [];

  const flatVariants =
    product.variants?.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      isActive: v.isActive,
      isAvailable: v.isAvailable ?? true,
    })) ?? [];

  const modifierGroups =
    product.modifierGroups
      ?.filter((pmg) => pmg.group.isActive !== false)
      .map((pmg) => pmg.group)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((g) => ({
        id: g.id,
        name: g.name,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        isRequired: g.isRequired,
        sortOrder: g.sortOrder,
        modifiers: g.modifiers
          .filter((m) => m.isActive)
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
          .map((m) => ({
            id: m.id,
            name: m.name,
            price: m.price,
            isActive: m.isActive,
            isAvailable: m.isAvailable ?? true,
          })),
      })) ?? [];

  return {
    id: product.id,
    name: product.name,
    price: product.price,
    categoryId: product.categoryId,
    description: product.description,
    shortDescription: product.shortDescription,
    isOutOfStock: product.isOutOfStock,
    variantGroups,
    variants: flatVariants,
    modifierGroups,
    images: product.images,
  };
}

export const PRODUCT_CONFIG_INCLUDE = {
  variantGroups: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" as const } },
    },
  },
  variants: { where: { isActive: true }, orderBy: { sortOrder: "asc" as const } },
  modifierGroups: {
    include: {
      group: {
        include: {
          modifiers: { where: { isActive: true }, orderBy: { sortOrder: "asc" as const } },
        },
      },
    },
  },
  images: { include: { media: true }, orderBy: { sortOrder: "asc" as const }, take: 5 },
};
