import { z } from "zod";

const trimmed = z.string().trim();

export const createRestaurantSchema = z.object({
  name: trimmed.min(2, "Restaurant name is required"),
  subdomain: trimmed
    .min(3, "Subdomain must be at least 3 characters")
    .max(32)
    .regex(/^[a-z0-9]+$/, "Subdomain must be lowercase letters and numbers only"),
  ownerName: trimmed.min(2, "Owner name is required"),
  ownerEmail: trimmed
    .toLowerCase()
    .email("Enter a valid owner email address"),
  ownerPhone: trimmed
    .min(10, "Phone must be at least 10 digits")
    .regex(/^[+0-9\s()-]+$/, "Enter a valid phone number"),
  ownerAddress: trimmed.min(5, "Address is required"),
  planSlug: trimmed
    .min(2, "Select a plan")
    .max(64)
    .regex(/^[a-z0-9_-]+$/, "Invalid plan slug"),
});

export const updateRestaurantStatusSchema = z.object({
  restaurantId: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED", "INACTIVE"]),
});

export const updateRestaurantSettingsSchema = z.object({
  name: z.string().min(2).optional(),
  language: z.string().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
  taxPercent: z.number().min(0).max(100).optional(),
  taxInclusive: z.boolean().optional(),
  loyaltySettings: z
    .object({
      enabled: z.boolean(),
      earnPercentOfBill: z.number().min(0).max(100),
      pointValueInRupees: z.number().min(0.01),
    })
    .optional(),
  reservationSettings: z
    .object({
      enabled: z.boolean(),
      averageDiningMinutes: z.number().min(15).max(300),
      holdTimeMinutes: z.number().min(5).max(120),
      cleaningBufferMinutes: z.number().min(0).max(60),
      autoMarkNoShow: z.boolean(),
      autoReleaseOnNoShow: z.boolean(),
      allowWalkInOverride: z.boolean(),
      reservationIntervalMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]),
      reservationConflictPolicy: z.enum(["BLOCK", "WARN"]).default("BLOCK"),
    })
    .optional(),
  orderSettings: z
    .object({
      requireFirstOrderApproval: z.boolean().optional(),
      customerSessionInactivityMinutes: z.number().min(15).max(720).optional(),
    })
    .optional(),
});

export type CreateRestaurantInput = z.infer<typeof createRestaurantSchema>;
export type UpdateRestaurantStatusInput = z.infer<typeof updateRestaurantStatusSchema>;
export type UpdateRestaurantSettingsInput = z.infer<typeof updateRestaurantSettingsSchema>;
