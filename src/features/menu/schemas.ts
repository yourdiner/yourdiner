import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  imageId: z.string().optional(),
  isActive: z.boolean().default(true),
  isHidden: z.boolean().default(false),
});

export const productSchema = z.object({
  categoryId: z.string(),
  name: z.string().min(1),
  shortDescription: z.string().optional(),
  description: z.string().optional(),
  price: z.number().int().min(0),
  discountPrice: z.number().int().min(0).optional().nullable(),
  dietaryType: z.enum(["VEG", "NON_VEG", "EGG", "VEGAN"]).default("VEG"),
  spicyLevel: z.number().int().min(0).max(5).default(0),
  prepTimeMinutes: z.number().int().optional().nullable(),
  isAvailable: z.boolean().default(true),
  isOutOfStock: z.boolean().default(false),
  isSeasonal: z.boolean().default(false),
  isFeatured: z.boolean().default(false),
  isRecommended: z.boolean().default(false),
  isChefSpecial: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  isHidden: z.boolean().default(false),
  calories: z.number().int().optional().nullable(),
  allergens: z.array(z.string()).default([]),
  nutritionInfo: z.record(z.unknown()).default({}),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  searchKeywords: z.array(z.string()).default([]),
  displayPriority: z.number().int().default(0),
  schedule: z.record(z.unknown()).default({}),
  taxId: z.string().optional().nullable(),
});

export const variantSchema = z.object({
  name: z.string().min(1),
  price: z.number().int().min(0),
  groupId: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  prepTimeMinutes: z.number().int().optional().nullable(),
  isAvailable: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const variantGroupSchema = z.object({
  name: z.string().min(1),
  isRequired: z.boolean().default(true),
});

export const modifierSchema = z.object({
  name: z.string().min(1),
  price: z.number().int().min(0).default(0),
  groupId: z.string().min(1),
});

export const modifierGroupCreateSchema = z.object({
  name: z.string().min(1),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(0).default(0),
  isRequired: z.boolean().default(false),
});

export const modifierGroupSchema = modifierGroupCreateSchema.extend({
  modifiers: z
    .array(
      z.object({
        name: z.string().min(1),
        price: z.number().int().min(0).default(0),
      })
    )
    .default([]),
});

export const reorderSchema = z.object({
  items: z.array(z.object({ id: z.string(), sortOrder: z.number() })),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
export type VariantGroupInput = z.infer<typeof variantGroupSchema>;
export type ModifierInput = z.infer<typeof modifierSchema>;
export type ModifierGroupCreateInput = z.infer<typeof modifierGroupCreateSchema>;
export type ModifierGroupInput = z.infer<typeof modifierGroupSchema>;
