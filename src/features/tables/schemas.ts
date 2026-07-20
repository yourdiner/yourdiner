import { z } from "zod";

export const tableSchema = z.object({
  number: z.coerce.number().int().min(1, "Table number must be at least 1"),
  name: z.string().min(1, "Name is required"),
  capacity: z.coerce.number().int().min(1, "Capacity must be at least 1").max(50),
  shape: z.enum(["SQUARE", "ROUND", "RECTANGLE", "CUSTOM"]).default("SQUARE"),
  status: z.enum(["AVAILABLE", "CLEANING", "DISABLED"]).default("AVAILABLE"),
});

export type TableFormValues = z.infer<typeof tableSchema>;
