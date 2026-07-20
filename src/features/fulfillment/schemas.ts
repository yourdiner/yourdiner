import { z } from "zod";

const phoneSchema = z
  .string()
  .min(1, "Phone is required")
  .transform((v) => v.replace(/\D/g, "").slice(-10))
  .refine((v) => v.length >= 10, "Enter a valid 10-digit mobile number");

export const createTakeawayOrderSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().min(1, "Customer name is required"),
  pickupTime: z.union([z.string().datetime(), z.null()]).optional(),
  notes: z.string().optional(),
});

export const createDeliveryOrderSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().min(1, "Customer name is required"),
  address: z.string().trim().min(1, "Delivery address is required"),
  landmark: z.string().optional(),
  instructions: z.string().optional(),
  deliveryCharges: z.number().min(0).default(0),
  estimatedDeliveryAt: z.union([z.string().datetime(), z.null()]).optional(),
  deliveryPartner: z.string().optional(),
  notes: z.string().optional(),
});

export const fulfillmentPaymentSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(["CASH", "CARD", "UPI", "OTHER"]),
  notes: z.string().optional(),
});
