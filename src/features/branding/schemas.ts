import { z } from "zod";

export const brandingSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  fontFamily: z.string().optional(),
  about: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  googleMapsUrl: z.string().url().optional().or(z.literal("")),
  socialLinks: z.record(z.string()).optional(),
  openingHours: z
    .array(
      z.object({
        day: z.string(),
        open: z.string(),
        close: z.string(),
        closed: z.boolean(),
      })
    )
    .optional(),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  invoiceFooter: z.string().optional(),
  receiptFooter: z.string().optional(),
});

export type BrandingInput = z.infer<typeof brandingSchema>;
