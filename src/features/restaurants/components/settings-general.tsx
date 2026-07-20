"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateRestaurantSettings } from "@/lib/settings-client";
import { updateBranding } from "@/lib/branding-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RequiredLabel } from "@/components/ui/required-label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
  TIMEZONE_OPTIONS,
} from "@/lib/settings-options";
import { toast } from "sonner";
import { parseSocialLinks, socialLinksToPayload } from "@/lib/social-links";

const generalInfoSchema = z.object({
  name: z.string().min(2),
  language: z.string(),
  currency: z.string(),
  timezone: z.string(),
  about: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  googleMapsUrl: z.string().url().optional().or(z.literal("")),
  instagram: z.string().url().optional().or(z.literal("")),
  facebook: z.string().url().optional().or(z.literal("")),
  twitter: z.string().url().optional().or(z.literal("")),
  whatsapp: z.string().url().optional().or(z.literal("")),
  youtube: z.string().url().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
});

type GeneralInfoInput = z.infer<typeof generalInfoSchema>;

interface SettingsGeneralProps {
  restaurant: {
    name: string;
    subdomain: string;
    settings: {
      language: string;
      currency: string;
      timezone: string;
    } | null;
  };
  branding: {
    about: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    phone: string | null;
    email: string | null;
    googleMapsUrl: string | null;
    socialLinks?: unknown;
  } | null;
}

export function SettingsGeneral({ restaurant, branding }: SettingsGeneralProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const socialDefaults = parseSocialLinks(branding?.socialLinks);

  const form = useForm<GeneralInfoInput>({
    resolver: zodResolver(generalInfoSchema),
    defaultValues: {
      name: restaurant.name,
      language: restaurant.settings?.language || "en",
      currency: restaurant.settings?.currency || "INR",
      timezone: restaurant.settings?.timezone || "Asia/Kolkata",
      about: branding?.about || "",
      address: branding?.address || "",
      city: branding?.city || "",
      state: branding?.state || "",
      postalCode: branding?.postalCode || "",
      phone: branding?.phone || "",
      email: branding?.email || "",
      googleMapsUrl: branding?.googleMapsUrl || "",
      instagram: socialDefaults.instagram,
      facebook: socialDefaults.facebook,
      twitter: socialDefaults.twitter,
      whatsapp: socialDefaults.whatsapp,
      youtube: socialDefaults.youtube,
      website: socialDefaults.website,
    },
  });

  const onSubmit = async (data: GeneralInfoInput) => {
    setLoading(true);
    try {
      const settingsResult = await updateRestaurantSettings({
        name: data.name,
        language: data.language,
        currency: data.currency,
        timezone: data.timezone,
      });
      if (!settingsResult.ok) {
        toast.error(settingsResult.error);
        return;
      }

      const brandingResult = await updateBranding({
        about: data.about,
        address: data.address,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        phone: data.phone,
        email: data.email,
        googleMapsUrl: data.googleMapsUrl,
        socialLinks: socialLinksToPayload({
          instagram: data.instagram,
          facebook: data.facebook,
          twitter: data.twitter,
          whatsapp: data.whatsapp,
          youtube: data.youtube,
          website: data.website,
        }),
      });
      if (!brandingResult.ok) {
        toast.error(brandingResult.error);
        return;
      }

      toast.success("Settings saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>General & Restaurant Info</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <RequiredLabel>Restaurant Name</RequiredLabel>
              <Input {...form.register("name")} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Subdomain</Label>
              <Input value={restaurant.subdomain} disabled />
              <p className="text-xs text-muted-foreground">
                Subdomain cannot be changed after creation
              </p>
            </div>

            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={form.watch("language")}
                onValueChange={(v) => form.setValue("language", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={form.watch("currency")}
                onValueChange={(v) => form.setValue("currency", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Timezone</Label>
              <Select
                value={form.watch("timezone")}
                onValueChange={(v) => form.setValue("timezone", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-6">
            <p className="mb-4 text-sm font-medium text-muted-foreground">Contact & Location</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>About</Label>
                <Textarea {...form.register("about")} rows={4} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input {...form.register("address")} />
              </div>
              <div className="space-y-2">
                <Label>City</Label>
                <Input {...form.register("city")} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input {...form.register("state")} />
              </div>
              <div className="space-y-2">
                <Label>Postal Code</Label>
                <Input {...form.register("postalCode")} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input {...form.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input {...form.register("email")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Google Maps URL</Label>
                <Input {...form.register("googleMapsUrl")} />
              </div>
            </div>
          </div>

          <div className="border-t pt-6">
            <p className="mb-4 text-sm font-medium text-muted-foreground">Social Media</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Instagram</Label>
                <Input {...form.register("instagram")} placeholder="https://instagram.com/..." />
              </div>
              <div className="space-y-2">
                <Label>Facebook</Label>
                <Input {...form.register("facebook")} placeholder="https://facebook.com/..." />
              </div>
              <div className="space-y-2">
                <Label>X (Twitter)</Label>
                <Input {...form.register("twitter")} placeholder="https://x.com/..." />
              </div>
              <div className="space-y-2">
                <Label>WhatsApp</Label>
                <Input {...form.register("whatsapp")} placeholder="https://wa.me/..." />
              </div>
              <div className="space-y-2">
                <Label>YouTube</Label>
                <Input {...form.register("youtube")} placeholder="https://youtube.com/..." />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input {...form.register("website")} placeholder="https://..." />
              </div>
            </div>
          </div>

          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
