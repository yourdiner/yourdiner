import { z } from "zod";
import type { PromotionType } from "@prisma/client";

const hhMm = z
  .string()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm")
  .nullable()
  .optional();

const dayOfWeek = z.number().int().min(0).max(6);

export const promotionTargetInputSchema = z
  .object({
    productId: z.string().min(1).nullable().optional(),
    categoryId: z.string().min(1).nullable().optional(),
  })
  .refine((t) => Boolean(t.productId) !== Boolean(t.categoryId), {
    message: "Each target must have exactly one of productId or categoryId",
  });

export const comboComponentInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  sortOrder: z.number().int().min(0).default(0),
});

export const dayPriceInputSchema = z.object({
  daysOfWeek: z.array(dayOfWeek).min(1),
  fixedPricePaise: z.number().int().min(0),
});

export const promotionUpsertSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(2000).nullable().optional(),
    billLabel: z.string().trim().max(120).nullable().optional(),
    type: z.enum([
      "TIME_PRICE",
      "DAY_PRICE",
      "COMBO",
      "PERCENT",
      "FLAT",
      "BILL_FLAT",
      "BILL_PERCENT",
    ]),
    targetScope: z.enum(["PRODUCTS", "CATEGORIES", "ENTIRE_MENU"]).default("PRODUCTS"),
    priority: z.number().int().min(0).max(10000).default(50),
    stackable: z.boolean().default(false),
    isActive: z.boolean().default(true),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    startTime: hhMm,
    endTime: hhMm,
    daysOfWeek: z.array(dayOfWeek).default([]),
    fixedPricePaise: z.number().int().min(0).nullable().optional(),
    percentOff: z.number().min(0).max(100).nullable().optional(),
    flatOffPaise: z.number().int().min(0).nullable().optional(),
    minOrderAmountPaise: z.number().int().min(0).nullable().optional(),
    targets: z.array(promotionTargetInputSchema).default([]),
    comboComponents: z.array(comboComponentInputSchema).default([]),
    dayPrices: z.array(dayPriceInputSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.startDate && data.endDate && data.endDate < data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after start date",
        path: ["endDate"],
      });
    }

    if (data.startTime && data.endTime && data.startTime === data.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End time must differ from start time",
        path: ["endTime"],
      });
    }

    const type = data.type as PromotionType;

    if (type === "TIME_PRICE") {
      if (data.fixedPricePaise == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Fixed price is required for time-based pricing",
          path: ["fixedPricePaise"],
        });
      }
      if (!data.startTime || !data.endTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Start and end time are required for happy hour",
          path: ["startTime"],
        });
      }
      requireTargets(data, ctx);
    }

    if (type === "DAY_PRICE") {
      if (!data.dayPrices.length && data.fixedPricePaise == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Provide day price bands or a fixed price",
          path: ["dayPrices"],
        });
      }
      requireTargets(data, ctx);
    }

    if (type === "PERCENT" || type === "BILL_PERCENT") {
      if (data.percentOff == null || data.percentOff <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Percent off is required",
          path: ["percentOff"],
        });
      }
      if (type === "PERCENT") requireTargets(data, ctx);
    }

    if (type === "FLAT" || type === "BILL_FLAT") {
      if (data.flatOffPaise == null || data.flatOffPaise <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Flat discount amount is required",
          path: ["flatOffPaise"],
        });
      }
      if (type === "FLAT") requireTargets(data, ctx);
    }

    if (type === "COMBO") {
      if (data.fixedPricePaise == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Combo price is required",
          path: ["fixedPricePaise"],
        });
      }
      if (data.comboComponents.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Combo requires at least 2 products",
          path: ["comboComponents"],
        });
      }
      const ids = data.comboComponents.map((c) => c.productId);
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Duplicate combo products are not allowed",
          path: ["comboComponents"],
        });
      }
    }

    if (
      (type === "BILL_FLAT" || type === "BILL_PERCENT") &&
      data.minOrderAmountPaise != null &&
      data.minOrderAmountPaise < 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum order amount cannot be negative",
        path: ["minOrderAmountPaise"],
      });
    }
  });

function requireTargets(
  data: { targetScope: string; targets: unknown[] },
  ctx: z.RefinementCtx
) {
  if (data.targetScope === "ENTIRE_MENU") return;
  if (!data.targets.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select at least one product or category",
      path: ["targets"],
    });
  }
}

export type PromotionUpsertInput = z.infer<typeof promotionUpsertSchema>;
