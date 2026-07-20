import { z } from "zod";

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Restaurant name is required"),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "At least 3 characters")
    .max(32, "At most 32 characters")
    .regex(/^[a-z0-9]+$/, "Only lowercase letters and numbers"),
  ownerName: z.string().trim().min(2, "Your name is required"),
  ownerEmail: z.string().trim().email("Enter a valid email"),
  dialCode: z.string().trim().min(1, "Country code is required"),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{6,15}$/, "Enter a valid phone number"),
  address: z.string().trim().min(5, "Address is required"),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().optional().or(z.literal("")),
  postalCode: z.string().trim().optional().or(z.literal("")),
  country: z.string().trim().min(2, "Country is required"),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
