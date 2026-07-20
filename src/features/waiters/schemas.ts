import { z } from "zod";

export const waiterSchema = z.object({
  displayName: z.string().min(2, "Name is required"),
  mobile: z.string().min(10, "Valid mobile number required"),
  employeeId: z.preprocess(
    (v) => {
      if (typeof v !== "string") return undefined;
      const trimmed = v.trim();
      return trimmed ? trimmed : undefined;
    },
    z.string().optional()
  ),
  /** Cafe team only supports waiters (STAFF). */
  role: z.literal("STAFF").default("STAFF"),
  joiningDate: z.string().optional(),
  isActive: z.boolean().default(true),
  /** When true, reset to the default temporary password. */
  resetPassword: z.boolean().optional(),
});

export type WaiterFormValues = z.infer<typeof waiterSchema>;
