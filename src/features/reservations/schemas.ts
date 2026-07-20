import { z } from "zod";

export const reservationSourceSchema = z.enum(["ADMIN", "PHONE", "WALK_IN", "WEBSITE"]);

export const createReservationSchema = z.object({
  guestName: z.string().min(1),
  guestPhone: z.string().min(10),
  guestEmail: z.string().email().optional().or(z.literal("")),
  guestCount: z.number().int().min(1).max(50),
  reservedAt: z.string().datetime().or(z.string().min(1)),
  tableId: z.string().optional(),
  specialRequest: z.string().optional(),
  source: reservationSourceSchema.default("ADMIN"),
  status: z.enum(["PENDING", "CONFIRMED"]).default("CONFIRMED"),
});

export const updateReservationSchema = z.object({
  guestName: z.string().min(1).optional(),
  guestPhone: z.string().min(10).optional(),
  guestEmail: z.string().email().optional().or(z.literal("")),
  guestCount: z.number().int().min(1).max(50).optional(),
  reservedAt: z.string().optional(),
  tableId: z.string().nullable().optional(),
  specialRequest: z.string().optional(),
  status: z
    .enum(["PENDING", "CONFIRMED", "CHECKED_IN", "DINING", "COMPLETED", "CANCELLED", "NO_SHOW"])
    .optional(),
});

export const changeTableSchema = z.object({
  tableId: z.string(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
